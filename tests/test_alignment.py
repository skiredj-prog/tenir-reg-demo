"""Offline structural diagnostic: independent oracle and provenance failures."""
from copy import deepcopy
from contextlib import redirect_stdout
from hashlib import sha1, sha256
from itertools import product
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from tenir_demo.alignment import build_alignment
from tenir_demo.alignment_view import render_alignment


ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = "references/upstream-reg-catalog-valid-configurations-v1.json"
REG_MANIFEST = "references/upstream-reg-manifest.json"
REG_REVIEW = "references/upstream-reg-review.json"


def read(root, name):
    return json.loads((root / name).read_text(encoding="utf-8"))


def write(root, name, data):
    (root / name).write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


class Alignment(unittest.TestCase):
    def scratch(self):
        parent = ROOT / "tmp"
        parent.mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(prefix="alignment-", dir=parent)
        destination = Path(temporary.name)
        self.assertTrue(destination.resolve().is_relative_to(parent.resolve()))
        self.addCleanup(temporary.cleanup)
        (destination / "references").mkdir()
        for source in (ROOT / "references").iterdir():
            if source.is_file() and (source.name.startswith("upstream-") or source.name in ("axes.json", "rules.json")):
                shutil.copy2(source, destination / "references" / source.name)
        (destination / "tenir_demo").mkdir()
        for source in (ROOT / "tenir_demo").glob("*.py"):
            shutil.copy2(source, destination / "tenir_demo" / source.name)
        return destination

    def fail_closed(self, result):
        self.assertEqual(result["structural"]["status"], "SOURCE_INVALID")
        self.assertTrue(result["structural"]["errors"])
        self.assertEqual(result["structural"]["configurations_compared"], 0)
        self.assertEqual(result["structural"]["clause_results_compared"], 0)
        self.assertEqual(result["execution_compatibility"], "NOT_VERIFIED")
        self.assertEqual(result["full_conformance"], "NOT_DEMONSTRATED")
        self.assertIs(result["remote_code_executed"], False)
        panel = render_alignment(result)
        self.assertNotIn('data-structural-status="STRUCTURAL_MATCH"', panel)
        self.assertNotIn("matching clause outcomes", panel)
        self.assertNotIn("Les 144 décisions et 1 008 résultats de clause concordent", panel)

    @staticmethod
    def refresh_local_input(root, path):
        review = read(root, REG_REVIEW)
        next(entry for entry in review["local_inputs"] if entry["path"] == path)["sha256"] = sha256((root / path).read_bytes()).hexdigest()
        write(root, REG_REVIEW, review)

    @staticmethod
    def refresh_catalogue_identity(root):
        data = (root / CATALOGUE).read_bytes()
        identity = {"sha256": sha256(data).hexdigest(), "bytes": len(data),
                    "git_blob_sha": sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()}
        for name, key in ((REG_MANIFEST, "files"), (REG_REVIEW, "source_basis")):
            document = read(root, name)
            entry = next(item for item in document[key] if item["local_copy"] == CATALOGUE)
            entry.update(identity)
            if name == REG_MANIFEST and document.get("tree_snapshot"):
                tree_info = document["tree_snapshot"]
                tree = read(root, tree_info["local_copy"])
                tree_entry = next(item for item in tree["tree"] if item["path"] == entry["path"])
                tree_entry.update(sha=identity["git_blob_sha"], size=identity["bytes"])
                write(root, tree_info["local_copy"], tree)
                tree_info["sha256"] = sha256((root / tree_info["local_copy"]).read_bytes()).hexdigest()
            write(root, name, document)

    def test_A01_independent_closed_catalogue_oracle(self):
        """Les 144 configurations et 1 008 résultats sont recalculés et comparés aux sources."""
        axes, rules, catalogue = read(ROOT, "references/axes.json"), read(ROOT, "references/rules.json"), read(ROOT, CATALOGUE)
        fields = tuple(axes)
        rows = {tuple(row["config"][field] for field in fields): row for row in catalogue["configurations"]}
        self.assertEqual(len(rows), 144)
        configurations = clauses = admissible = 0
        for values in product(*(axes[field] for field in fields)):
            config = dict(zip(fields, values))
            violated = set()
            for rule in rules:
                clauses += 1
                if config[rule["cf"]] == rule["cv"] and config[rule["rf"]] not in rule["av"]:
                    violated.add(rule["clause_id"])
            row = rows[values]
            self.assertEqual(violated, {item["clause_id"] for item in row["violations"]})
            self.assertIs(row["admissible_structural"], not violated)
            self.assertIsNone(row["effective_guarantee_demonstrated"])
            configurations += 1
            admissible += not violated
        self.assertEqual((configurations, clauses, admissible), (144, 1008, 42))
        result = build_alignment(ROOT)
        structural = result["structural"]
        self.assertEqual(result["schema"], "demo-reference-alignment/v1")
        self.assertEqual(structural["status"], "STRUCTURAL_MATCH")
        self.assertEqual((structural["configurations_compared"], structural["clause_results_compared"], structural["admissible"], structural["rejected"]), (144, 1008, 42, 102))
        self.assertTrue(structural["axes_match"] and structural["rules_match"])
        self.assertEqual(structural["mismatches"], [])
        self.assertEqual(structural["errors"], [])

    def test_A02_invalid_source_identity_fails_closed(self):
        """Source altérée, absente, dupliquée ou mal formée : aucune concordance revendiquée."""
        for failure in ("hash", "missing", "duplicate", "malformed", "pin", "path", "git_blob", "review_title", "review_invariants"):
            with self.subTest(failure=failure):
                root = self.scratch()
                if failure == "hash":
                    path = root / "references/upstream-reg-catalog-hypotheses-v1.yaml"
                    path.write_bytes(path.read_bytes() + b" ")
                elif failure == "missing":
                    entry = read(root, "references/upstream-tenir-manifest.json")["files"][0]
                    (root / entry["local_copy"]).unlink()
                elif failure == "duplicate":
                    name = "references/upstream-harness-manifest.json"
                    manifest = read(root, name)
                    manifest["files"].append(deepcopy(manifest["files"][0]))
                    write(root, name, manifest)
                elif failure == "malformed":
                    (root / REG_REVIEW).write_bytes(b'{"schema":')
                elif failure == "git_blob":
                    name = "references/upstream-tenir-manifest.json"
                    manifest = read(root, name)
                    for alias in ("git_blob_sha", "github_blob_sha", "git_blob_sha1"):
                        manifest["files"][0].pop(alias, None)
                    write(root, name, manifest)
                elif failure in ("review_title", "review_invariants"):
                    name = "references/upstream-tenir-review.json"
                    review = read(root, name)
                    if failure == "review_title":
                        del review["contracts"][0]["title"]
                    else:
                        review["invariants"] = []
                    write(root, name, review)
                else:
                    manifest = read(root, REG_MANIFEST)
                    if failure == "pin":
                        manifest["files"][0]["pinned_commit"] = "0" * 40
                    else:
                        manifest["files"][0]["local_copy"] = "../outside-workspace.yaml"
                    write(root, REG_MANIFEST, manifest)
                self.fail_closed(build_alignment(root))

    def test_A03_local_axes_and_rules_differences_are_detected(self):
        """Une divergence locale valide reste un écart, même avec une provenance cohérente."""
        for changed in ("axes", "rules"):
            with self.subTest(changed=changed):
                root = self.scratch()
                path = "references/" + changed + ".json"
                data = read(root, path)
                if changed == "axes":
                    data["UNCERTAINTY"].remove("fail-open")
                else:
                    next(rule for rule in data if rule["clause_id"] == "R1a")["av"].append("file-lock")
                write(root, path, data)
                self.refresh_local_input(root, path)
                result = build_alignment(root)
                self.assertEqual(result["structural"]["status"], "STRUCTURAL_DIFFERENCE")
                self.assertFalse(result["structural"][changed + "_match"])
                if changed == "rules":
                    self.assertTrue(result["structural"]["mismatches"])
                panel = render_alignment(result)
                self.assertNotIn("matching clause outcomes", panel)
                self.assertNotIn("Les 144 décisions et 1 008 résultats de clause concordent", panel, "Historical computed review wording must not override a fresh difference")

    def test_A04_catalogue_outcomes_are_compared_not_cached(self):
        """Admissibilité et clauses du catalogue sont comparées au calcul, sans reprendre un ancien résultat."""
        for changed in ("admissibility", "clause"):
            with self.subTest(changed=changed):
                root = self.scratch()
                catalogue = read(root, CATALOGUE)
                if changed == "admissibility":
                    catalogue["configurations"][0]["admissible_structural"] = False
                    catalogue["summary"]["admissible_structural"] -= 1
                    catalogue["summary"]["rejected"] += 1
                    catalogue["summary"]["breakdown_by_host_scope"]["mono-process"] -= 1
                else:
                    row = next(row for row in catalogue["configurations"] if row["violations"])
                    row["violations"][0]["clause_id"] = "R1b"
                write(root, CATALOGUE, catalogue)
                self.refresh_catalogue_identity(root)
                result = build_alignment(root)
                self.assertEqual(result["structural"]["status"], "STRUCTURAL_DIFFERENCE")
                self.assertTrue(result["structural"]["mismatches"])
                self.assertEqual(result["structural"]["configurations_compared"], 144)

    def test_A05_reviewed_scopes_never_claim_runtime_equivalence(self):
        """Concordance structurelle, budgets et UNKNOWN conservent leurs limites de contrat."""
        result = build_alignment(ROOT)
        self.assertEqual(result["execution_compatibility"], "NOT_VERIFIED")
        self.assertEqual(result["full_conformance"], "NOT_DEMONSTRATED")
        self.assertIs(result["remote_code_executed"], False)
        runtime = result["runtime_review"]
        self.assertEqual({item["id"] for item in runtime["invariants"]}, {"I" + str(number) for number in range(1, 10)})
        self.assertTrue(all(item["status"] in {"LOCAL_SUBSET", "NOT_IMPLEMENTED", "NOT_ASSESSED"} for item in runtime["invariants"]))
        budget = next(item for item in runtime["contracts"] if item["id"] == "BUDGET_ACCOUNTING_PHASES")
        self.assertEqual(budget["comparison_status"], "DIFFERENT_CONTRACT")
        harness = result["harness_review"]
        self.assertIs(harness["support_flags"]["S1_conformance_demonstrated"], False)
        unknown = next(item for item in harness["scenarios"] if item["id"] == "issue-inconnue")
        self.assertEqual(unknown["status"], "DIFFERENT_RETURN_CONTRACT")
        self.assertEqual((unknown["local"]["historical_verdict"], unknown["upstream"]["disposition"]), ("PASS", "HOLD"))
        self.assertFalse(next(item for item in harness["scenarios"] if item["id"] == "attente")["support_flags"]["equivalent_to_S2_qualification_timeout"])
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from tenir_demo.report import render
        from tenir_demo.scenario import attest, run_scenarios
        from tests.test_configurator_integration import ConfiguratorIntegration
        key, signal_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
        bundle = attest(run_scenarios(key, signal_key), key)
        destination = self.scratch() / "verification-failed-report.html"
        render(bundle, ConfiguratorIntegration().fixture_results(), {"valid": False}, destination)
        page = destination.read_text(encoding="utf-8")
        self.assertIn("TENIR/REG · Verification failed", page)
        self.assertIn("TENIR/REG · Vérification échouée", page)
        self.assertIn("Evidence verification failed", page)
        self.assertNotIn("signed and verified at generation", page)
        self.assertNotIn("signées et vérifiées lors de la génération", page)

    def test_A06_deterministic_read_only_detached_diagnostic(self):
        """Diagnostic déterministe, détaché des appels précédents et sans écriture des sources."""
        paths = [path for path in (ROOT / "references").iterdir() if path.is_file() and (path.name.startswith("upstream-") or path.name in ("axes.json", "rules.json"))]
        paths += list((ROOT / "tenir_demo").glob("*.py"))
        before = {path: sha256(path.read_bytes()).hexdigest() for path in paths}
        first = build_alignment(ROOT)
        self.assertEqual(first, build_alignment(ROOT))
        self.assertEqual(first, build_alignment())
        original = deepcopy(first)
        first["runtime_review"]["invariants"][0]["status"] = "FALSE_EQUIVALENCE"
        self.assertEqual(original, build_alignment(ROOT))
        self.assertEqual(before, {path: sha256(path.read_bytes()).hexdigest() for path in paths})
        # Optional diagnostics must not break legacy dossiers, and a signed bad test section cannot claim GO.
        from demo import generate
        from tenir_demo.evidence import write_json
        from tests.test_configurator_integration import ConfiguratorIntegration
        from verify import verify_directory
        destination = self.scratch() / "dossier"
        destination.mkdir()
        results = ConfiguratorIntegration().fixture_results()
        write_json(destination / "test-results.json", results)
        with redirect_stdout(io.StringIO()):
            self.assertTrue(generate(destination, results))
        legacy = verify_directory(destination, destination / "evidence.public.pem")
        self.assertTrue(legacy["valid"], legacy)
        results["alignment_tests"] = {"go": True, "passed": 6, "tests": [
            {"id": "A" + str(number).zfill(2), "status": "PASS"} for number in range(1, 7)]}
        results["alignment_tests"]["tests"][-1]["id"] = "A01"
        write_json(destination / "test-results.json", results)
        with redirect_stdout(io.StringIO()):
            generate(destination, results)
        self.assertFalse(verify_directory(destination, destination / "evidence.public.pem")["valid"],
                         "A signed duplicate/missing alignment test ID must invalidate the claimed GO")


if __name__ == "__main__":
    unittest.main()
