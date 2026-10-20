"""Attentes du plan et fixtures fixes ; recette auto-exécutée, non indépendante."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
from pathlib import Path
import re
import tempfile
from threading import Barrier, Event
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from tenir_demo.engine import Conflict, Engine, PROFILE, SimulatedProvider, evaluate, make_request, make_signal
from tenir_demo.evidence import canonical, digest, seal, verify
from tenir_demo.report import render, report_model
from tenir_demo.scenario import attest, run_scenarios
from tenir_demo.structure import selfcheck, violations
from tenir_demo.verification import verify_bundle

ROOT = Path(__file__).resolve().parent.parent


class Acceptance(unittest.TestCase):
    def setUp(self):
        self.key = Ed25519PrivateKey.generate()
        self.signal_key = Ed25519PrivateKey.generate()
        self.now = 1792404000
        self.signal = make_signal(self.signal_key, self.now)

    def engine(self, ceiling=70000, provider=None):
        profile = deepcopy(PROFILE)
        profile["ceiling"] = ceiling
        return Engine(self.key, self.signal_key.public_key(), provider, profile)

    def request(self, oid="operation-1", amount=20, signal="default", outcome="CONFIRMED"):
        return make_request(oid, amount, self.signal if signal == "default" else signal, outcome)

    def test_T01_structure(self):
        """Clauses R1a–R3a et violations multiples ; test interne."""
        fixtures = json.loads((ROOT / "fixtures/structure.json").read_text(encoding="utf-8"))
        for f in fixtures:
            config = {"HOST_SCOPE": f["host"], "DEDUP_LAYER": f["dedup"], "CONCURRENCY": f["concurrency"], "UNCERTAINTY": "fail-closed"}
            self.assertEqual([v["clause_id"] for v in violations(config)], f["expected"], f["name"])
        counts = selfcheck()
        self.assertEqual((counts["configurations"], counts["admissible"], counts["by_scope"]),
                         (144, 42, {"mono-process": 9, "mono-host": 18, "multi-host": 15}))
        self.assertTrue(violations({}))
        bad = deepcopy(PROFILE)
        bad["configuration"]["HOST_SCOPE"] = "mono-host"
        with self.assertRaises(ValueError):
            Engine(self.key, self.signal_key.public_key(), profile=bad)

    def test_T02_budget(self):
        """Budget nominal, limite exacte, montants et unités invalides."""
        engine = self.engine(100)
        self.assertEqual(engine.execute(self.request("a", 40), self.now)["state"], "CONFIRMED")
        self.assertEqual(engine.execute(self.request("b", 60), self.now)["state"], "CONFIRMED")
        self.assertEqual(engine.bundle()["final_budget"], {"ceiling": 100, "consumed": 100, "reserved": 0, "available": 0})
        self.assertEqual(len(engine.provider.journal()), 2)
        for amount in (0, -1, True, 0.5, "20", None):
            fresh = self.engine(100)
            op = fresh.execute(self.request(amount=amount), self.now)
            self.assertEqual(op["decision"], {"verdict": "HARD_VETO", "reasons": ["AMOUNT_OR_UNIT_INVALID"]})
            self.assertEqual(fresh.bundle()["final_budget"]["reserved"], 0)
            self.assertEqual(fresh.provider.journal(), [])
        fresh = self.engine()
        invalid = self.request()
        invalid["unit"] = "EUR"
        self.assertEqual(fresh.execute(invalid, self.now)["state"], "BLOCKED")
        with self.assertRaises(ValueError):
            fresh.execute(self.request("oversize", 2**53), self.now)
        self.assertEqual(fresh.provider.journal(), [])

    def test_T03_veto(self):
        """Dépassement et signal affaibli : aucun appel ni réservation."""
        for amount, signal, expected in ((101, self.signal, ["BUDGET_EXCEEDED"]),
                (10, make_signal(self.signal_key, self.now, "HYPOTHESIS_WEAKENED"), ["HYPOTHESIS_WEAKENED"]),
                (101, make_signal(self.signal_key, self.now, "HYPOTHESIS_WEAKENED"), ["BUDGET_EXCEEDED", "HYPOTHESIS_WEAKENED"])):
            engine = self.engine(100)
            op = engine.execute(self.request(amount=amount, signal=signal), self.now)
            self.assertEqual(op["decision"], {"verdict": "HARD_VETO", "reasons": expected})
            self.assertEqual(engine.provider.journal(), [])
            self.assertEqual(engine.bundle()["final_budget"]["available"], 100)

    def test_T04_hold(self):
        """Signaux absent, expiré et invalide distingués avant envoi."""
        broken = deepcopy(self.signal)
        broken["payload"]["status"] = "HYPOTHESIS_WEAKENED"
        expired = make_signal(self.signal_key, self.now - 300)
        stale = make_signal(self.signal_key, self.now - 301, expires_at=self.now + 100)
        invalids = [broken, make_signal(Ed25519PrivateKey.generate(), self.now),
                    make_signal(self.signal_key, self.now + 1),
                    make_signal(self.signal_key, self.now, issuer="other"),
                    make_signal(self.signal_key, self.now, resource="other"),
                    make_signal(self.signal_key, self.now, status="UNKNOWN")]
        for signal, reason in [(None, "SIGNAL_MISSING"), (expired, "SIGNAL_EXPIRED"), (stale, "SIGNAL_EXPIRED")] + [(s, "SIGNAL_INVALID") for s in invalids]:
            engine = self.engine()
            op = engine.execute(self.request(signal=signal), self.now)
            self.assertEqual(op["decision"], {"verdict": "HOLD", "reasons": [reason]})
            self.assertEqual((op["state"], engine.provider.journal(), engine.bundle()["final_budget"]["reserved"]), ("HELD", [], 0))

    def test_T05_unknown(self):
        """UNKNOWN conserve la réservation et le verdict au rejeu."""
        engine = self.engine(100)
        request = self.request(amount=60, outcome="UNKNOWN")
        first = engine.execute(request, self.now)
        replay = engine.execute(request, self.now + 3600)
        self.assertEqual(first, replay)
        self.assertEqual((first["state"], first["decision"]["verdict"]), ("UNKNOWN", "PASS"))
        self.assertEqual(engine.bundle()["final_budget"], {"ceiling":100,"consumed":0,"reserved":60,"available":40})
        self.assertEqual(engine.execute(self.request("new", 41), self.now)["decision"]["verdict"], "HARD_VETO")
        self.assertEqual(len(engine.provider.journal()), 1)
        class UncertainProvider(SimulatedProvider):
            def dispatch(self, req):
                super().dispatch(req)
                raise TimeoutError("Réponse perdue après réception")
        uncertain = self.engine(100, UncertainProvider())
        self.assertEqual(uncertain.execute(request, self.now)["state"], "UNKNOWN")
        self.assertEqual(uncertain.bundle()["final_budget"]["reserved"], 60)
        self.assertEqual(uncertain.execute(request, self.now), uncertain.execute(request, self.now + 1))
        self.assertEqual(len(uncertain.provider.journal()), 1)

    def test_T06_concurrency(self):
        """50 courses synchronisées : contrôle atomique du plafond."""
        for repetition in range(50):
            engine, barrier = self.engine(100), Barrier(2)
            requests = [self.request(f"race-{repetition}-{i}", 60) for i in range(2)]
            snapshot = engine.bundle()["final_budget"]
            race_profile = {**deepcopy(PROFILE), "ceiling": 100}
            for req in requests:
                self.assertEqual(evaluate(req, snapshot, race_profile, self.now, self.signal_key.public_key())["verdict"], "PASS")
            def send(req):
                barrier.wait(timeout=5)
                return engine.execute(req, self.now)
            with ThreadPoolExecutor(max_workers=2) as pool:
                outcomes = list(pool.map(send, requests))
            self.assertEqual(sorted(o["decision"]["verdict"] for o in outcomes), ["HARD_VETO", "PASS"])
            self.assertEqual(len(engine.provider.journal()), 1)
            self.assertEqual(engine.bundle()["final_budget"], {"ceiling":100,"consumed":60,"reserved":0,"available":40})

    def test_T07_idempotency(self):
        """Doublons, conflits et doublons pendant un envoi en cours."""
        engine = self.engine(100)
        request = self.request(amount=60)
        first = engine.execute(request, self.now)
        snapshot = engine.bundle()
        self.assertEqual(engine.execute(request, self.now + 1), first)
        with self.assertRaises(Conflict):
            engine.execute(self.request(amount=61), self.now)
        self.assertEqual(engine.bundle(), snapshot)
        for repetition in range(20):
            concurrent, barrier = self.engine(100), Barrier(8)
            def duplicate(i):
                barrier.wait(timeout=5)
                try:
                    return concurrent.execute(self.request(amount=60 if i < 4 else 61), self.now)
                except Conflict:
                    return "CONFLICT"
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(duplicate, range(8)))
            self.assertEqual(results.count("CONFLICT"), 4)
            self.assertEqual(len(concurrent.provider.journal()), 1)
            self.assertIn(concurrent.bundle()["final_budget"]["consumed"], (60, 61))
        entered, release = Event(), Event()
        class SlowProvider(SimulatedProvider):
            def dispatch(self, req):
                outcome = super().dispatch(req)
                entered.set()
                if not release.wait(timeout=10):
                    raise TimeoutError("Test non libéré")
                return outcome
        slow = self.engine(100, SlowProvider())
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(slow.execute, request, self.now)
            try:
                self.assertTrue(entered.wait(timeout=5))
                duplicate = slow.execute(request, self.now)
                self.assertEqual((duplicate["state"], slow.bundle()["final_budget"]["reserved"]), ("DISPATCHING", 60))
                before = slow.bundle()
                with self.assertRaises(Conflict):
                    slow.execute(self.request(amount=61), self.now)
                self.assertEqual(slow.bundle(), before)
            finally:
                release.set()
            self.assertEqual(future.result(timeout=5)["state"], "CONFIRMED")
        self.assertEqual(len(slow.provider.journal()), 1)

    def test_T08_determinism(self):
        """Même entrée, état, profil et temps : décision reproductible."""
        engine = self.engine()
        budget = engine.bundle()["final_budget"]
        request, profile = self.request(), deepcopy(PROFILE)
        original = deepcopy((request, budget, profile))
        expected = {"verdict":"PASS","reasons":["BUDGET_AND_OBSERVATION_VALID"]}
        for _ in range(100):
            self.assertEqual(evaluate(request, budget, profile, self.now, self.signal_key.public_key()), expected)
        self.assertEqual((request, budget, profile), original)
        self.assertEqual(evaluate(request, budget, profile, self.now + 300, self.signal_key.public_key())["reasons"], ["SIGNAL_EXPIRED"])
        op = engine.execute(request, self.now)
        op["decision"]["verdict"] = "FORGED"
        request["amount"] = 999
        bundle = engine.bundle()
        bundle["operations"].clear()
        self.assertEqual(engine.bundle()["operations"]["operation-1"]["decision"]["verdict"], "PASS")

    def test_T09_integrity(self):
        """Signature, altération, autre clé, ordre JSON et chaîne tronquée."""
        record = seal({"z": 1, "a": {"é": "preuve", "a": [True, None]}}, self.key)
        self.assertTrue(verify(record, self.key.public_key()))
        reordered = {"integrity": dict(reversed(list(record["integrity"].items()))),
                     "payload": dict(reversed(list(record["payload"].items())))}
        self.assertEqual(canonical(record), canonical(reordered))
        self.assertTrue(verify(reordered, self.key.public_key()))
        tampered = deepcopy(record)
        tampered["payload"]["z"] = 2
        tampered["integrity"]["payload_sha256"] = digest(tampered["payload"])
        self.assertFalse(verify(tampered, self.key.public_key()))
        self.assertFalse(verify(record, Ed25519PrivateKey.generate().public_key()))
        bundle = attest(run_scenarios(self.key, self.signal_key), self.key)
        self.assertTrue(verify_bundle(bundle, self.key.public_key(), self.signal_key.public_key())["valid"])
        for change in ("truncate", "reorder", "budget", "calls"):
            bad = deepcopy(bundle)
            if change == "truncate": bad["records"].pop()
            if change == "reorder": bad["records"][0], bad["records"][1] = bad["records"][1], bad["records"][0]
            if change == "budget": bad["final_budget"]["reserved"] = 0
            if change == "calls": bad["provider_journal"].clear()
            self.assertFalse(verify_bundle(bad, self.key.public_key(), self.signal_key.public_key())["valid"], change)

    def test_T10_end_to_end(self):
        """Quatre parcours : rapport, preuves, appels et budget concordent."""
        oracle = json.loads((ROOT / "fixtures/acceptance.json").read_text(encoding="utf-8"))
        bundle = attest(run_scenarios(self.key, self.signal_key), self.key)
        verification = verify_bundle(bundle, self.key.public_key(), self.signal_key.public_key())
        self.assertEqual(verification, {"valid":True,"records":6,"operations":4,"provider_calls":2})
        self.assertEqual(bundle["final_budget"], oracle["final"])
        self.assertEqual(len(bundle["provider_journal"]), oracle["total_calls"])
        model = report_model(bundle)
        self.assertEqual(model["final_budget"], oracle["final"])
        for expected, record in zip(oracle["scenarios"], model["operations"]):
            p = record["payload"]
            op = bundle["operations"][expected["id"]]
            self.assertEqual((p["operation_id"], p["decision"]["verdict"], p["operation_state"]), (expected["id"], expected["verdict"], expected["state"]))
            self.assertEqual((op["decision"], op["state"]), (p["decision"], p["operation_state"]))
            self.assertEqual(sum(c["operation_id"] == expected["id"] for c in bundle["provider_journal"]), expected["calls"])
            self.assertTrue(verify(record, self.key.public_key()))
        scratch = ROOT / "output"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(ROOT.resolve()))
            report = Path(directory) / "report.html"
            render(bundle, {"go": True, "passed": 10, "tests": []}, verification, report)
            text = report.read_text(encoding="utf-8")
            embedded = re.search(r'<script type="application/json" id="signed-model">(.*?)</script>', text, re.S).group(1)
            self.assertEqual(json.loads(embedded), model)
            self.assertIn("GO LOCAL", text)
            self.assertNotIn("@@", text)
            self.assertIn("NON ÉVALUÉE", text)
