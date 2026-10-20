"""Évaluation pure, réservation sous RLock, simulateur sans accès réseau."""
from copy import deepcopy
from threading import RLock

from .evidence import digest, seal, verify
from .structure import violations

VERSION = "0.1.0"
PROFILE = {
    "id": "tenir-reg-local-demo", "version": VERSION, "unit": "demo-unit", "ceiling": 70000,
    "resource": "demo-budget", "signal_issuer": "demo-assure", "max_signal_age_seconds": 300,
    "configuration": {"HOST_SCOPE": "mono-process", "DEDUP_LAYER": "local-registry",
                      "CONCURRENCY": "thread-lock", "UNCERTAINTY": "fail-closed"},
    "policy": "Montant invalide, budget dépassé ou hypothèse affaiblie : HARD_VETO. Signal absent, invalide ou expiré : HOLD. UNKNOWN conserve la réservation."
}
REQUEST_FIELDS = {"operation_id", "amount", "unit", "signal", "simulated_outcome"}


def result(verdict, *reasons):
    return {"verdict": verdict, "reasons": list(reasons)}


def evaluate(request, budget, profile, reference_time, signal_key):
    """Aucune horloge ni mutation implicite. Le profil et le snapshot sont explicites."""
    if type(reference_time) is not int:
        raise ValueError("reference_time doit être un entier Unix en secondes")
    if not isinstance(request, dict) or set(request) != REQUEST_FIELDS:
        return result("HARD_VETO", "REQUEST_INVALID")
    if not isinstance(request["operation_id"], str) or not request["operation_id"].strip():
        return result("HARD_VETO", "OPERATION_ID_INVALID")
    amount = request["amount"]
    if type(amount) is not int or not 0 < amount <= 9007199254740991 or request["unit"] != profile["unit"]:
        return result("HARD_VETO", "AMOUNT_OR_UNIT_INVALID")
    if request["simulated_outcome"] not in ("CONFIRMED", "UNKNOWN"):
        return result("HARD_VETO", "SIMULATOR_MODE_INVALID")
    structural = violations(profile["configuration"])
    if structural:
        return result("HARD_VETO", *[v["clause_id"] for v in structural])
    reasons = []
    if budget["consumed"] + budget["reserved"] + amount > profile["ceiling"]:
        reasons.append("BUDGET_EXCEEDED")
    signal = request["signal"]
    signal_reason = None
    if signal is None:
        signal_reason = "SIGNAL_MISSING"
    elif not verify(signal, signal_key):
        signal_reason = "SIGNAL_INVALID"
    else:
        p = signal["payload"]
        fields = {"schema", "signal_id", "issuer", "resource", "property", "status", "observed_at", "expires_at"}
        if (not isinstance(p, dict) or set(p) != fields or p["schema"] != "demo-signal/v1"
                or p["issuer"] != profile["signal_issuer"] or p["resource"] != profile["resource"]
                or p["property"] != "hypothesis-status" or not isinstance(p["signal_id"], str)
                or not p["signal_id"] or p["status"] not in ("VERIFIED", "HYPOTHESIS_WEAKENED")
                or type(p["observed_at"]) is not int or type(p["expires_at"]) is not int
                or p["observed_at"] > reference_time or p["expires_at"] <= p["observed_at"]):
            signal_reason = "SIGNAL_INVALID"
        elif reference_time >= p["expires_at"] or reference_time - p["observed_at"] > profile["max_signal_age_seconds"]:
            signal_reason = "SIGNAL_EXPIRED"
        elif p["status"] == "HYPOTHESIS_WEAKENED":
            reasons.append("HYPOTHESIS_WEAKENED")
    if reasons:
        return result("HARD_VETO", *reasons, *([signal_reason] if signal_reason else []))
    if signal_reason:
        return result("HOLD", signal_reason)
    return result("PASS", "BUDGET_AND_OBSERVATION_VALID")


def make_signal(key, now, status="VERIFIED", **changes):
    payload = {"schema": "demo-signal/v1", "signal_id": "demo-observation-1", "issuer": "demo-assure",
               "resource": "demo-budget", "property": "hypothesis-status", "status": status,
               "observed_at": now, "expires_at": now + 300}
    payload.update(changes)
    return seal(payload, key)


def make_request(operation_id, amount, signal, outcome="CONFIRMED"):
    return {"operation_id": operation_id, "amount": amount, "unit": "demo-unit",
            "signal": deepcopy(signal), "simulated_outcome": outcome}


class Conflict(ValueError):
    pass


class SimulatedProvider:
    def __init__(self):
        self._lock = RLock()
        self._calls = []

    def dispatch(self, request):
        with self._lock:
            self._calls.append({"call_id": len(self._calls) + 1, "operation_id": request["operation_id"],
                                "request_hash": digest(request), "amount": request["amount"],
                                "outcome": request["simulated_outcome"]})
        return request["simulated_outcome"]

    def journal(self):
        with self._lock:
            return deepcopy(self._calls)


class Engine:
    def __init__(self, signing_key, signal_key, provider=None, profile=None):
        self._lock = RLock()
        self._profile = deepcopy(profile if profile is not None else PROFILE)
        if self._profile["configuration"] != PROFILE["configuration"]:
            raise ValueError("Le runtime de démo supporte uniquement son profil mono-processus/local-registry/thread-lock/fail-closed")
        if type(self._profile["ceiling"]) is not int or not 0 < self._profile["ceiling"] <= 9007199254740991:
            raise ValueError("Plafond entier positif requis")
        self._signing_key, self._signal_key = signing_key, signal_key
        self.provider = provider if provider is not None else SimulatedProvider()
        self._operations, self._records = {}, []

    def _budget(self):
        consumed = sum(o["request"]["amount"] for o in self._operations.values() if o["state"] == "CONFIRMED")
        reserved = sum(o["request"]["amount"] for o in self._operations.values() if o["state"] in ("DISPATCHING", "UNKNOWN"))
        ceiling = self._profile["ceiling"]
        assert consumed + reserved <= ceiling
        return {"ceiling": ceiling, "consumed": consumed, "reserved": reserved, "available": ceiling - consumed - reserved}

    def _record(self, op, before, now, event):
        payload = {"schema": "demo-evidence/v1", "prototype_version": VERSION, "sequence": len(self._records) + 1,
                   "previous_hash": digest(self._records[-1]) if self._records else None,
                   "reference_time": now, "profile": deepcopy(self._profile), "profile_hash": digest(self._profile),
                   "operation_id": op["request"]["operation_id"], "request": deepcopy(op["request"]),
                   "request_hash": op["request_hash"], "decision": deepcopy(op["decision"]),
                   "operation_state": op["state"], "event": event,
                   "budget_before": before, "budget_after": self._budget(),
                   "provider_journal": self.provider.journal(), "simulation_only": True}
        record = seal(payload, self._signing_key)
        self._records.append(record)
        op["latest_evidence_sequence"] = payload["sequence"]

    def execute(self, request, reference_time):
        if type(reference_time) is not int:
            raise ValueError("Temps explicite requis")
        # Geler avant empreinte et verrou : l'appelant ne peut plus modifier notre copie.
        request = deepcopy(request)
        request_hash = digest(request)
        if not isinstance(request, dict) or not isinstance(request.get("operation_id"), str) or not request["operation_id"].strip():
            raise ValueError("operation_id non vide requis")
        oid = request["operation_id"]
        with self._lock:
            if oid in self._operations:
                existing = self._operations[oid]
                if request_hash != existing["request_hash"]:
                    raise Conflict(f"operation_id déjà utilisé avec un autre payload : {oid}")
                return deepcopy(existing)
            before = self._budget()
            decision = evaluate(request, before, self._profile, reference_time, self._signal_key)
            state = {"PASS": "DISPATCHING", "HOLD": "HELD", "HARD_VETO": "BLOCKED"}[decision["verdict"]]
            op = {"request": request, "request_hash": request_hash, "decision": decision, "state": state}
            self._operations[oid] = op
            self._record(op, before, reference_time, "RESERVED_FOR_DISPATCH" if state == "DISPATCHING" else "NOT_SENT")
            if state != "DISPATCHING":
                return deepcopy(op)
        # Aucun verrou d'état durant l'appel : les doublons voient DISPATCHING.
        try:
            outcome = self.provider.dispatch(deepcopy(request))
        except Exception:
            outcome = "UNKNOWN"  # Une exception ne prouve pas l'absence d'effet fournisseur.
        with self._lock:
            before_completion = self._budget()
            op["state"] = "CONFIRMED" if outcome == "CONFIRMED" else "UNKNOWN"
            self._record(op, before_completion, reference_time, "PROVIDER_RESULT")
            return deepcopy(op)

    def bundle(self):
        with self._lock:
            return deepcopy({"schema": "demo-bundle/v1", "prototype_version": VERSION,
                             "profile": self._profile, "operations": self._operations,
                             "records": self._records, "provider_journal": self.provider.journal(),
                             "final_budget": self._budget()})
