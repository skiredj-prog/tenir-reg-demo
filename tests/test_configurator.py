"""Product configuration checks; they do not certify the external catalogue."""
from copy import deepcopy
from itertools import product
import json
from pathlib import Path
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from tenir_demo.configurator import build_model
from tenir_demo.engine import PROFILE
from tenir_demo.evidence import digest
from tenir_demo.scenario import attest, run_scenarios
from tenir_demo.structure import AXES, RULES, violations
from tenir_demo.verification import verify_bundle


ROOT = Path(__file__).resolve().parent.parent


class Configurator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = build_model()

    def test_C01_exhaustive_enumeration(self):
        """All 144 configurations agree with the structural evaluator."""
        model = self.model
        expected = [dict(zip(AXES, values)) for values in product(*AXES.values())]
        self.assertEqual([entry["configuration"] for entry in model["configurations"]], expected)
        self.assertEqual(model["statistics"], {"total": 144, "admissible": 42, "rejected": 102})
        self.assertEqual(len({entry["id"] for entry in model["configurations"]}), 144)
        for entry in model["configurations"]:
            errors = violations(entry["configuration"])
            self.assertEqual(entry["admissible"], not errors)
            self.assertEqual([{key: item[key] for key in ("clause_id", "message")}
                              for item in entry["violations"]], errors)
            self.assertEqual(len(entry["rule_results"]), 7)
            self.assertEqual([item["clause_id"] for item in entry["rule_results"]],
                             [rule["clause_id"] for rule in RULES])
            self.assertEqual([item["clause_id"] for item in entry["rule_results"]
                              if item["status"] == "VIOLATED"],
                             [error["clause_id"] for error in errors])
        self.assertEqual(json.loads(json.dumps(model, allow_nan=False)), model)

    def test_C02_clauses_and_highlights(self):
        """Clauses retain their fields, applicability and evaluated operands."""
        rules = {rule["clause_id"]: rule for rule in RULES}
        fixtures = json.loads((ROOT / "fixtures/structure.json").read_text(encoding="utf-8"))
        for fixture in fixtures:
            configuration = {"HOST_SCOPE": fixture["host"], "DEDUP_LAYER": fixture["dedup"],
                             "CONCURRENCY": fixture["concurrency"], "UNCERTAINTY": "fail-closed"}
            entry = next(item for item in self.model["configurations"] if item["configuration"] == configuration)
            self.assertEqual([item["clause_id"] for item in entry["violations"]], fixture["expected"], fixture["name"])
        for entry in self.model["configurations"]:
            involved = set()
            violated_ids = {item["clause_id"] for item in entry["violations"]}
            configuration = entry["configuration"]
            for violation in entry["violations"]:
                rule = rules[violation["clause_id"]]
                self.assertEqual(violation["fields"], [rule["cf"], rule["rf"]])
                self.assertEqual(violation["message"], rule["desc"])
                involved.update((rule["cf"], rule["rf"]))
            self.assertEqual(entry["highlighted_fields"], [field for field in AXES if field in involved])
            for result, rule in zip(entry["rule_results"], RULES):
                applicable = configuration[rule["cf"]] == rule["cv"]
                status = ("VIOLATED" if rule["clause_id"] in violated_ids
                          else "SATISFIED" if applicable else "NOT_APPLICABLE")
                self.assertEqual(result, {
                    "clause_id": rule["clause_id"], "rule_id": rule["rule_id"],
                    "message": rule["desc"], "fields": [rule["cf"], rule["rf"]],
                    "condition": {"field": rule["cf"], "value": rule["cv"],
                                  "actual": configuration[rule["cf"]]},
                    "requirement": {"field": rule["rf"], "allowed": rule["av"],
                                    "actual": configuration[rule["rf"]]},
                    "status": status,
                })
                if not applicable:
                    self.assertEqual(result["status"], "NOT_APPLICABLE")
                elif result["status"] == "SATISFIED":
                    self.assertIn(configuration[rule["rf"]], rule["av"])

    def test_C03_nearest_corrections(self):
        """Every suggestion is valid, minimum-distance, complete and stable."""
        entries = self.model["configurations"]
        lookup = {entry["id"]: entry for entry in entries}
        independently_valid = [dict(zip(AXES, values)) for values in product(*AXES.values())
                               if not violations(dict(zip(AXES, values)))]
        found_scope_tie = False
        for entry in entries:
            if entry["admissible"]:
                self.assertEqual(entry["suggestions"], [])
                continue
            source = entry["configuration"]
            distance = lambda target: sum(source[field] != target[field] for field in AXES)
            minimum = min(map(distance, independently_valid))
            nearest = [target for target in independently_valid if distance(target) == minimum]
            nearest.sort(key=lambda target: target["HOST_SCOPE"] != source["HOST_SCOPE"])
            self.assertEqual([lookup[item["target_id"]]["configuration"] for item in entry["suggestions"]], nearest)
            same_scope = [target["HOST_SCOPE"] == source["HOST_SCOPE"] for target in nearest]
            found_scope_tie |= any(same_scope) and not all(same_scope)
            for suggestion in entry["suggestions"]:
                target = lookup[suggestion["target_id"]]["configuration"]
                self.assertEqual(suggestion["distance"], minimum)
                self.assertEqual(suggestion["changes"], [
                    {"field": field, "from": source[field], "to": target[field]}
                    for field in AXES if source[field] != target[field]])
                corrected = dict(source)
                corrected.update({change["field"]: change["to"] for change in suggestion["changes"]})
                self.assertEqual(corrected, target)
                self.assertEqual(violations(corrected), [])
        self.assertTrue(found_scope_tie, "The tie preference must be exercised by the catalogue")

    def test_C04_runtime_and_guarantees_are_separate(self):
        """An admissible multi-host draft does not gain runtime support."""
        supported = [entry for entry in self.model["configurations"] if entry["runtime_supported"]]
        self.assertEqual(len(supported), 1)
        self.assertEqual(supported[0]["configuration"], PROFILE["configuration"])
        multi_host = [entry for entry in self.model["configurations"]
                      if entry["admissible"] and entry["configuration"]["HOST_SCOPE"] == "multi-host"]
        self.assertEqual(len(multi_host), 15)
        self.assertTrue(all(not entry["runtime_supported"] for entry in multi_host))
        self.assertTrue(all(entry["guarantees_status"] == "NOT_DEMONSTRATED" for entry in self.model["configurations"]))
        self.assertFalse(self.model["demo"]["available"])
        self.assertIsNone(self.model["demo"]["report_href"])
        self.assertIn("run.ps1 all", self.model["demo"]["instructions"])

    def test_C05_verified_bundle_gate(self):
        """Only the matching runtime with explicit verified evidence is linked."""
        key, signal_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
        bundle = attest(run_scenarios(key, signal_key), key)
        verification = verify_bundle(bundle, key.public_key(), signal_key.public_key())
        self.assertIs(verification["valid"], True)
        model = build_model(bundle, verification)
        demonstrated = [entry for entry in model["configurations"] if entry["guarantees_status"] == "LOCAL_DEMO_TESTED"]
        self.assertEqual(len(demonstrated), 1)
        self.assertEqual(demonstrated[0]["configuration"], PROFILE["configuration"])
        self.assertTrue(model["demo"]["available"])
        self.assertEqual(model["demo"]["report_href"], "report.html")
        self.assertEqual(model["demo"]["verification"], {key: verification[key] for key in ("records", "operations", "provider_calls")})
        wrong_bundle = deepcopy(bundle)
        wrong_bundle["profile"]["configuration"]["HOST_SCOPE"] = "multi-host"
        for candidate, summary in ((None, verification), (bundle, None), (wrong_bundle, verification),
                                   (bundle, {"valid": False}), (bundle, {"valid": "true"}),
                                   (bundle, {"valid": 1}), ({}, verification), ([], verification)):
            blocked = build_model(candidate, summary)
            self.assertFalse(blocked["demo"]["available"])
            self.assertIsNone(blocked["demo"]["report_href"])
            self.assertTrue(all(entry["guarantees_status"] == "NOT_DEMONSTRATED" for entry in blocked["configurations"]))

    def test_C06_no_mutation_or_hidden_execution(self):
        """Building and editing a draft leaves bundle, profile and rules intact."""
        bundle = {"profile": deepcopy(PROFILE), "operations": {"sentinel": "unchanged"}}
        verification = {"valid": True, "records": 6, "operations": 4, "provider_calls": 2}
        before = deepcopy((bundle, verification, PROFILE, AXES, RULES))
        draft = build_model(bundle, verification)
        self.assertEqual((bundle, verification, PROFILE, AXES, RULES), before)
        draft["axes"]["HOST_SCOPE"].append("new-scope")
        draft["rules"][0]["desc"] = "changed locally"
        draft["runtime_configuration"]["HOST_SCOPE"] = "multi-host"
        draft["configurations"][0]["configuration"]["HOST_SCOPE"] = "changed locally"
        self.assertEqual((bundle, verification, PROFILE, AXES, RULES), before)
        self.assertEqual(build_model(), self.model)

    def test_C07_unsigned_provenance_and_reproducibility(self):
        """Exports identify their extracted rules and carry no signed claim."""
        model = self.model
        self.assertEqual(model["schema"], "demo-configurator/v1")
        self.assertEqual(model["draft_schema"], "demo-configuration-draft/v1")
        self.assertEqual(model["signature_status"], "UNSIGNED")
        self.assertIs(model["unsigned"], True)
        self.assertEqual(model["provenance"]["rules_version"], "extracted-html-v1")
        self.assertEqual(model["provenance"]["rules_sha256"], digest(RULES))
        self.assertEqual(model["provenance"]["axes_sha256"], digest(AXES))
        self.assertEqual(model["provenance"]["external_catalogue"], "NOT_EVALUATED")
        self.assertEqual(model["provenance"]["invariants"], "GUIDES_RECEIVED_NOT_MAPPED")
        self.assertEqual(model["provenance"]["alignment_target"]["version"], "5.7")
        self.assertEqual(model["provenance"]["alignment_target"]["status"], "BASE_CONFIRMED_PROMOTION_PLANNED")
        self.assertEqual(model["provenance"]["alignment_target"]["base_version"], "5.6.1")
        self.assertEqual(model["provenance"]["alignment_target"]["execution_compatibility"], "NOT_VERIFIED")
        self.assertNotIn("integrity", model)
        self.assertNotIn("signature", model)
        self.assertEqual(digest(build_model()), digest(model))


if __name__ == "__main__":
    unittest.main()
