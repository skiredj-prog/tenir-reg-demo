import hashlib
import io
import json
import platform
import sys
import unittest
from importlib.metadata import version
from pathlib import Path

from .engine import VERSION
from .contracts import CORE_TEST_IDS, CONFIGURATOR_TEST_IDS, PROOF_LOOP_TEST_IDS
from .evidence import digest, write_json

ROOT = Path(__file__).resolve().parent.parent


def source_fingerprint():
    paths = sorted([*ROOT.glob("tenir_demo/*.py"), *ROOT.glob("tenir_demo/*.html"), *ROOT.glob("tenir_demo/*.js"), *ROOT.glob("tenir_demo/*.css"), *ROOT.glob("tests/*.py"), *ROOT.glob("tests/*.cjs"),
                    *ROOT.glob("fixtures/*.json"), ROOT / "demo.py", ROOT / "verify.py", ROOT / "requirements.txt",
                    ROOT / "run.ps1", ROOT / "README.md", ROOT / "PRODUCT.md", ROOT / "ALIGNMENT.md", ROOT / "UX_REVIEW.md", ROOT / "USER_WALKTHROUGH.md", ROOT / "index.html",
                    *[p for p in ROOT.glob("references/*") if p.is_file()]])
    files = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    return {"sha256": digest(files), "files": files}


class Results(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.entries = []

    def entry(self, test, status, detail=None):
        item = {"id": test._testMethodName.split("_")[1], "description": test.shortDescription(), "status": status}
        if detail:
            item["detail"] = detail
        self.entries.append(item)

    def addSuccess(self, test):
        super().addSuccess(test)
        self.entry(test, "PASS")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.entry(test, "FAIL", self._exc_info_to_string(err, test))

    def addError(self, test, err):
        super().addError(test, err)
        self.entry(test, "ERROR", self._exc_info_to_string(err, test))

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.entry(test, "NON EXÉCUTÉ", reason)


def run_tests(destination):
    from tests.test_acceptance import Acceptance
    from tests.test_configurator import Configurator
    from tests.test_configurator_integration import ConfiguratorIntegration
    from tests.test_proof_loop import ProofLoop
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2, resultclass=Results).run(unittest.defaultTestLoader.loadTestsFromTestCase(Acceptance))
    passed = sum(t["status"] == "PASS" for t in result.entries)
    expected_ids = set(CORE_TEST_IDS)
    go = result.wasSuccessful() and passed == 10 and {t["id"] for t in result.entries} == expected_ids
    product_stream = io.StringIO()
    product_suite = unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(Configurator),
                                      unittest.defaultTestLoader.loadTestsFromTestCase(ConfiguratorIntegration)])
    product = unittest.TextTestRunner(stream=product_stream, verbosity=2, resultclass=Results).run(product_suite)
    product_passed = sum(t["status"] == "PASS" for t in product.entries)
    product_ids = set(CONFIGURATOR_TEST_IDS)
    product_go = product.wasSuccessful() and product_passed == len(CONFIGURATOR_TEST_IDS) and {t["id"] for t in product.entries} == product_ids
    proof_stream = io.StringIO()
    proof = unittest.TextTestRunner(stream=proof_stream, verbosity=2, resultclass=Results).run(unittest.defaultTestLoader.loadTestsFromTestCase(ProofLoop))
    proof_passed = sum(t["status"] == "PASS" for t in proof.entries)
    proof_go = proof.wasSuccessful() and proof_passed == len(PROOF_LOOP_TEST_IDS) and {t["id"] for t in proof.entries} == set(PROOF_LOOP_TEST_IDS)
    report = {"prototype_version": VERSION, "environment": {"python": sys.version, "platform": platform.platform(),
              "cryptography": version("cryptography"), "rfc8785": version("rfc8785")},
              "source": source_fingerprint(), "qa": "Recette auto-exécutée ; aucune indépendance QA revendiquée",
              "concurrency": {"competing_budget_races": 50, "duplicate_conflict_races": 20, "in_flight_duplicate": True},
              "go": go and product_go and proof_go, "passed": passed, "tests": result.entries, "unittest_output": stream.getvalue(),
              "product_tests": {"go": product_go, "passed": product_passed, "tests": product.entries,
                                "unittest_output": product_stream.getvalue()},
              "proof_loop_tests": {"go": proof_go, "passed": proof_passed, "tests": proof.entries,
                                   "unittest_output": proof_stream.getvalue()}}
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    write_json(destination, report)
    print(stream.getvalue())
    print(product_stream.getvalue())
    print(proof_stream.getvalue())
    return report
