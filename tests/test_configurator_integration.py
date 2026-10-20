from contextlib import redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import re
import tempfile
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from tenir_demo.configurator_view import render_configurator
from tenir_demo.contracts import CORE_TEST_IDS, CONFIGURATOR_TEST_IDS
from tenir_demo.evidence import write_json
from tenir_demo.scenario import attest, run_scenarios
from tenir_demo.verification import verify_bundle

ROOT = Path(__file__).resolve().parent.parent


class ConfiguratorIntegration(unittest.TestCase):
    def scratch(self):
        (ROOT / "output").mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(dir=ROOT / "output")
        self.assertTrue(Path(temporary.name).resolve().is_relative_to(ROOT.resolve()))
        self.addCleanup(temporary.cleanup)
        return Path(temporary.name)

    def fixture_results(self):
        from tenir_demo.acceptance import source_fingerprint
        return {"go": True, "passed": 10, "source": source_fingerprint(),
                "tests": [{"id": value, "status": "PASS", "description": "Fixture d'intégration"} for value in CORE_TEST_IDS],
                "product_tests": {"go": True, "passed": len(CONFIGURATOR_TEST_IDS),
                                  "tests": [{"id": value, "status": "PASS", "description": "Fixture d'intégration"} for value in CONFIGURATOR_TEST_IDS]}}

    def test_C08_standalone_page_projection(self):
        """Page autonome, sans marqueurs ni redirection, fidèle au catalogue."""
        key, signal_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
        bundle = attest(run_scenarios(key, signal_key), key)
        verification = verify_bundle(bundle, key.public_key(), signal_key.public_key())
        destination = self.scratch() / "configurator.html"
        before = deepcopy(bundle)
        model = render_configurator(bundle, verification, destination)
        page = destination.read_text(encoding="utf-8")
        embedded = re.search(r'<script type="application/json" id="configurator-model">(.*?)</script>', page, re.S)
        self.assertEqual(json.loads(embedded.group(1)), model)
        self.assertEqual(json.loads(destination.with_name("configuration-catalogue.json").read_text(encoding="utf-8")), model)
        self.assertNotIn("@@", page)
        self.assertNotIn('http-equiv="refresh"', page)
        self.assertNotIn('<script src=', page)
        self.assertNotIn('fetch(', page)
        self.assertEqual(bundle, before)

    def test_C09_signed_dossier_covers_product_files(self):
        """Reçu v2 valide puis altération des nouveaux fichiers détectée."""
        from demo import generate
        from verify import verify_directory
        directory = self.scratch()
        results = self.fixture_results()
        write_json(directory / "test-results.json", results)
        with redirect_stdout(io.StringIO()):
            self.assertTrue(generate(directory, results))
        checked = verify_directory(directory, directory / "evidence.public.pem")
        self.assertTrue(checked["valid"], checked)
        self.assertTrue(checked["go_local"])
        self.assertEqual(checked["files_verified"], 8)
        for name in ("configurator.html", "configuration-catalogue.json"):
            path = directory / name
            original = path.read_bytes()
            path.write_bytes(original + b" ")
            invalid = verify_directory(directory, directory / "evidence.public.pem")
            self.assertFalse(invalid["valid"])
            self.assertIn(name, invalid["error"])
            path.write_bytes(original)

    def test_C10_failing_product_recipe_remains_no_go(self):
        """Recette produit en échec : dossier valide, aucune démo revendiquée."""
        from demo import generate
        from verify import verify_directory
        directory = self.scratch()
        results = self.fixture_results()
        results["go"] = False
        results["product_tests"]["go"] = False
        results["product_tests"]["passed"] -= 1
        results["product_tests"]["tests"][0]["status"] = "FAIL"
        write_json(directory / "test-results.json", results)
        with redirect_stdout(io.StringIO()):
            self.assertFalse(generate(directory, results))
        checked = verify_directory(directory, directory / "evidence.public.pem")
        self.assertTrue(checked["valid"], checked)
        self.assertFalse(checked["go_local"])
        model = json.loads((directory / "configuration-catalogue.json").read_text(encoding="utf-8"))
        self.assertFalse(model["demo"]["available"])
        self.assertIsNone(model["demo"]["report_href"])
        self.assertTrue(all(item["guarantees_status"] == "NOT_DEMONSTRATED" for item in model["configurations"]))
