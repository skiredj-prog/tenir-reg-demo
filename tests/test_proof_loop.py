"""Evidence-loop contracts checked against the signed envelopes themselves."""
from copy import deepcopy
import re
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from tenir_demo.proof_loop import build_proof_loop, resolve_source
from tenir_demo.report import report_model
from tenir_demo.scenario import attest, run_scenarios
from tenir_demo.engine import Engine, make_request, make_signal


STAGES = ("question", "theoretical-model", "observation-model", "observation",
          "interpretation", "execution", "knowledge", "restitution")


def raw_value(records, source):
    """Independent RFC6901 traversal; do not use the production resolver."""
    matches = [record for record in records if record["payload"]["sequence"] == source["record_sequence"]]
    if len(matches) != 1:
        raise ValueError("The source must identify one envelope")
    pointer = source["pointer"]
    if not isinstance(pointer, str) or not pointer.startswith("/") or re.search(r"~(?:[^01]|$)", pointer):
        raise ValueError("Invalid JSON pointer")
    value = matches[0]
    for encoded in pointer[1:].split("/"):
        token = encoded.replace("~1", "/").replace("~0", "~")
        if isinstance(value, list):
            if not re.fullmatch(r"0|[1-9][0-9]*", token):
                raise ValueError("Invalid array index")
            value = value[int(token)]
        else:
            value = value[token]
    return value


class ProofLoop(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        key, signal_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
        cls.bundle = attest(run_scenarios(key, signal_key), key)

    def operation_records(self, operation_id):
        return [record for record in self.bundle["records"] if record["payload"]["operation_id"] == operation_id]

    @staticmethod
    def by_stage(loop):
        return {stage["id"]: stage for stage in loop["stages"]}

    def test_P01_deterministic_projection_without_mutation(self):
        """Projection déterministe des huit étapes, sans modifier le dossier signé."""
        before = deepcopy(self.bundle)
        report = report_model(self.bundle)
        self.assertEqual(report["evidence_records"], self.bundle["records"])
        self.assertEqual(set(report["proof_loops"]), set(self.bundle["operations"]))
        for operation_id in self.bundle["operations"]:
            records = self.operation_records(operation_id)
            first = build_proof_loop(records)
            second = build_proof_loop(records)
            self.assertEqual(first, second)
            self.assertEqual(first, build_proof_loop(list(reversed(records))))
            self.assertEqual(report["proof_loops"][operation_id], first)
            self.assertEqual(first["schema"], "demo-proof-loop/v1")
            self.assertEqual(first["operation_id"], operation_id)
            self.assertEqual(first["record_sequence"], records[-1]["payload"]["sequence"])
            self.assertEqual(tuple(stage["id"] for stage in first["stages"]), STAGES)
            for stage in first["stages"]:
                self.assertEqual(stage["explanation_kind"], "DOCUMENTARY")
                for field in ("title", "description"):
                    self.assertEqual(set(stage[field]), {"fr", "en"})
                    self.assertTrue(all(isinstance(text, str) and text.strip() for text in stage[field].values()))
        self.assertEqual(self.bundle, before)

    def test_P02_every_source_resolves_to_its_signed_envelope(self):
        """Chaque référence restitue le champ exact et distingue payload et métadonnées."""
        before = deepcopy(self.bundle)
        for operation_id in self.bundle["operations"]:
            records = self.operation_records(operation_id)
            loop = build_proof_loop(records)
            kinds = set()
            for stage in loop["stages"]:
                for source in stage["sources"]:
                    self.assertEqual(set(source["label"]), {"fr", "en"})
                    self.assertTrue(all(source["label"].values()))
                    self.assertIn(source["kind"], {"SIGNED_PAYLOAD", "ENVELOPE_METADATA"})
                    if source["kind"] == "SIGNED_PAYLOAD":
                        self.assertTrue(source["pointer"] == "/payload" or source["pointer"].startswith("/payload/"), source)
                    else:
                        self.assertTrue(source["pointer"] == "/integrity" or source["pointer"].startswith("/integrity/"), source)
                    kinds.add(source["kind"])
                    self.assertEqual(resolve_source(records, source), raw_value(records, source), source)
            self.assertEqual(kinds, {"SIGNED_PAYLOAD", "ENVELOPE_METADATA"})
            detached = resolve_source(records, {"record_sequence": records[0]["payload"]["sequence"],
                "pointer": "/payload/profile", "kind": "SIGNED_PAYLOAD"})
            detached["ceiling"] = -1
        self.assertEqual(self.bundle, before)

    def test_P03_documentary_question_and_initial_budget(self):
        """Question documentaire explicite ; le raisonnement utilise le budget avant réservation."""
        for operation_id in self.bundle["operations"]:
            records = self.operation_records(operation_id)
            stages = self.by_stage(build_proof_loop(records))
            self.assertEqual(stages["question"]["status"], "DOCUMENTARY")
            self.assertEqual(stages["restitution"]["status"], "DOCUMENTARY")
            for stage in stages.values():
                self.assertFalse(any("question_id" in source["pointer"] for source in stage["sources"]))
            budget_sources = [source for source in stages["interpretation"]["sources"]
                              if source["pointer"].startswith("/payload/budget_before")]
            self.assertTrue(budget_sources, "Interpretation must expose the budget used to decide")
            self.assertTrue(all(source["record_sequence"] == records[0]["payload"]["sequence"] for source in budget_sources))
        authorized = self.operation_records("autorisation")
        self.assertEqual(authorized[0]["payload"]["budget_before"]["reserved"], 0)
        self.assertEqual(authorized[-1]["payload"]["budget_before"]["reserved"], 20000)
        key, signal_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
        now = 1792404000
        tampered = make_signal(signal_key, now)
        tampered["payload"]["status"] = "HYPOTHESIS_WEAKENED"
        for index, (signal, expected) in enumerate(((None, "MISSING"), ("malformed", "INVALID"),
                ({"payload": "malformed"}, "INVALID"), (tampered, "INVALID"),
                (make_signal(signal_key, now - 301), "EXPIRED"))):
            with self.subTest(observation=expected, variant=index):
                engine = Engine(key, signal_key.public_key())
                engine.execute(make_request("observation-" + str(index), 20, signal), now)
                records = engine.bundle()["records"]
                observation = self.by_stage(build_proof_loop(records))["observation"]
                self.assertEqual(observation["status"], expected)
                whole_signal = [source for source in observation["sources"] if source["pointer"] == "/payload/request/signal"]
                self.assertEqual(len(whole_signal), 1)
                self.assertEqual(resolve_source(records, whole_signal[0]), signal)

    def test_P04_pass_does_not_mean_confirmed_execution(self):
        """PASS est conservé pour UNKNOWN ; l'issue inconnue conserve sa réservation."""
        expected = {"autorisation": ("CONFIRMED", 0), "issue-inconnue": ("UNKNOWN", 10000)}
        for operation_id, (state, reserved) in expected.items():
            records = self.operation_records(operation_id)
            loop = build_proof_loop(records)
            latest = records[-1]["payload"]
            self.assertEqual(latest["decision"]["verdict"], "PASS")
            self.assertEqual(latest["operation_state"], state)
            self.assertEqual(latest["budget_after"]["reserved"], reserved)
            self.assertEqual(loop["timeline"], [{"record_sequence": record["payload"]["sequence"],
                "event": record["payload"]["event"], "operation_state": record["payload"]["operation_state"],
                "verdict": record["payload"]["decision"]["verdict"]} for record in records])
            stages = self.by_stage(loop)
            self.assertEqual(stages["interpretation"]["status"], "RECORDED")
            self.assertEqual(stages["execution"]["status"], "CONFIRMED" if state == "CONFIRMED" else "UNCONFIRMED")
            self.assertEqual(stages["knowledge"]["status"], "RECORDED" if state == "CONFIRMED" else "UNCONFIRMED")
            decision_sources = [source for source in stages["interpretation"]["sources"]
                                if source["pointer"].startswith("/payload/decision")]
            execution_sources = [source for source in stages["execution"]["sources"]
                                 if source["pointer"] == "/payload/operation_state"]
            self.assertTrue(decision_sources)
            self.assertTrue(any(source["record_sequence"] == latest["sequence"]
                                and resolve_source(records, source) == state for source in execution_sources))
            self.assertEqual({entry["verdict"] for entry in loop["timeline"]}, {"PASS"})

    def test_P05_veto_and_hold_stop_before_dispatch(self):
        """Veto et attente arrêtent l'envoi sans confondre les appels cumulés des autres opérations."""
        for operation_id, verdict, state in (("blocage", "HARD_VETO", "BLOCKED"), ("attente", "HOLD", "HELD")):
            records = self.operation_records(operation_id)
            loop = build_proof_loop(records)
            self.assertEqual(len(loop["timeline"]), 1)
            entry = loop["timeline"][0]
            self.assertEqual((entry["event"], entry["verdict"], entry["operation_state"]), ("NOT_SENT", verdict, state))
            payload = records[0]["payload"]
            self.assertEqual(payload["budget_before"], payload["budget_after"])
            self.assertFalse(any(call["operation_id"] == operation_id for call in payload["provider_journal"]))
            self.assertTrue(payload["provider_journal"], "Fixture must exercise a non-empty cumulative journal")
            execution = self.by_stage(loop)["execution"]
            self.assertEqual(execution["status"], state)
            self.assertEqual(self.by_stage(loop)["interpretation"]["status"], state)
            self.assertTrue(any(source["pointer"] == "/payload/operation_state"
                                and resolve_source(records, source) == state for source in execution["sources"]))

    def test_P06_reject_unknown_missing_and_invalid_sources(self):
        """Références inconnues, absentes, ambiguës ou mal formées rejetées explicitement."""
        records = self.operation_records("autorisation")
        sample = {"record_sequence": records[0]["payload"]["sequence"], "pointer": "/payload/operation_id",
                  "kind": "SIGNED_PAYLOAD", "label": {"fr": "Opération", "en": "Operation"}}
        for altered in ({**sample, "record_sequence": 999}, {**sample, "pointer": "/payload/absent"},
                        {**sample, "pointer": "payload/operation_id"}, {**sample, "pointer": "/payload/~2"},
                        {**sample, "pointer": "/payload/~"}, {**sample, "pointer": "/payload/provider_journal/-"},
                        {**sample, "pointer": "/payload/provider_journal/01"},
                        {**sample, "pointer": "/integrity/payload_sha256"},
                        {**sample, "record_sequence": True}, {}, None):
            with self.subTest(source=altered), self.assertRaises(ValueError):
                resolve_source(records, altered)
        with self.assertRaises(ValueError):
            build_proof_loop([])
        with self.assertRaises(ValueError):
            build_proof_loop(records + self.operation_records("attente"))
        with self.assertRaises(ValueError):
            build_proof_loop(records + [deepcopy(records[0])])
        missing = deepcopy(records)
        del missing[0]["payload"]["budget_before"]
        with self.assertRaises(ValueError):
            build_proof_loop(missing)
        missing_signal = deepcopy(records)
        del missing_signal[0]["payload"]["request"]["signal"]
        with self.assertRaises(ValueError):
            build_proof_loop(missing_signal)
        escaped = deepcopy(records)
        escaped[0]["payload"]["request"]["a/b~c"] = {"value": 7}
        source = {**sample, "pointer": "/payload/request/a~1b~0c/value"}
        self.assertEqual(resolve_source(escaped, source), 7)


if __name__ == "__main__":
    unittest.main()
