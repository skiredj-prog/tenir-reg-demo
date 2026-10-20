"""Vérificateur autonome : aucun import du moteur ni du générateur de rapport."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / ".deps"))
from tenir_demo.evidence import read_public, verify
from tenir_demo.contracts import CORE_TEST_IDS, CONFIGURATOR_TEST_IDS, PROOF_LOOP_TEST_IDS, ALIGNMENT_TEST_IDS
from tenir_demo.verification import verify_bundle


def verify_directory(directory, public_key_path):
    try:
        directory = Path(directory)
        public_key = read_public(public_key_path)
        receipt = json.loads((directory / "receipt.json").read_text(encoding="utf-8"))
        if not verify(receipt, public_key) or receipt["payload"]["schema"] not in ("demo-files/v1", "demo-files/v2"):
            raise ValueError("Reçu signé invalide")
        files = receipt["payload"]["files"]
        required = {"evidence.json", "evidence.public.pem", "signal.public.pem", "test-results.json", "verification.json", "report.html"}
        product_dossier = receipt["payload"]["schema"] == "demo-files/v2"
        if product_dossier:
            required |= {"configurator.html", "configuration-catalogue.json"}
        if set(files) != required:
            raise ValueError("Inventaire des fichiers incomplet")
        for name, expected in files.items():
            if hashlib.sha256((directory / name).read_bytes()).hexdigest() != expected:
                raise ValueError(f"Fichier altéré : {name}")
        bundle = json.loads((directory / "evidence.json").read_text(encoding="utf-8"))
        result = verify_bundle(bundle, public_key, read_public(directory / "signal.public.pem"))
        if not result["valid"]:
            return result
        tests_bytes = (directory / "test-results.json").read_bytes()
        tests = json.loads(tests_bytes)
        if (bundle["build"]["test_results_sha256"] != hashlib.sha256(tests_bytes).hexdigest()
                or bundle["build"]["source_sha256"] != tests["source"]["sha256"]):
            raise ValueError("Recette non rattachée à cette version")
        ids = set(CORE_TEST_IDS)
        go = tests["go"] is True and tests["passed"] == 10 and len(tests["tests"]) == 10
        go = go and {t["id"] for t in tests["tests"]} == ids and all(t["status"] == "PASS" for t in tests["tests"])
        # Optional for older v1/v2 dossiers; new generated recipes include it.
        if "proof_loop_tests" in tests:
            proof = tests["proof_loop_tests"]
            proof_ids = set(PROOF_LOOP_TEST_IDS)
            go = (go and proof["go"] is True and proof["passed"] == len(proof_ids)
                  and len(proof["tests"]) == len(proof_ids)
                  and {t["id"] for t in proof["tests"]} == proof_ids
                  and all(t["status"] == "PASS" for t in proof["tests"]))
        if "alignment_tests" in tests:
            alignment = tests["alignment_tests"]
            alignment_ids = set(ALIGNMENT_TEST_IDS)
            go = (go and alignment["go"] is True and alignment["passed"] == len(alignment_ids)
                  and len(alignment["tests"]) == len(alignment_ids)
                  and {t["id"] for t in alignment["tests"]} == alignment_ids
                  and all(t["status"] == "PASS" for t in alignment["tests"]))
        if product_dossier:
            product = tests["product_tests"]
            product_ids = set(CONFIGURATOR_TEST_IDS)
            product_go = (product["go"] is True and product["passed"] == len(product_ids) and len(product["tests"]) == len(product_ids)
                          and {t["id"] for t in product["tests"]} == product_ids
                          and all(t["status"] == "PASS" for t in product["tests"]))
            go = go and product_go
            catalogue = json.loads((directory / "configuration-catalogue.json").read_text(encoding="utf-8"))
            if (catalogue["schema"] != "demo-configurator/v1"
                    or catalogue["runtime_configuration"] != bundle["profile"]["configuration"]
                    or catalogue["demo"]["available"] is not go
                    or catalogue["demo"]["verification"] != ({k: result[k] for k in ("records", "operations", "provider_calls")} if go else None)):
                raise ValueError("Configurateur non rattaché à cette démonstration")
        if receipt["payload"]["go_local"] != go or receipt["payload"]["production"] is not False:
            raise ValueError("Conclusion du reçu incohérente")
        recorded = json.loads((directory / "verification.json").read_text(encoding="utf-8"))
        if recorded != result:
            raise ValueError("Résultat de vérification enregistré incohérent")
        return {**result, "files_verified": len(files), "go_local": go, "production": False}
    except (OSError, ValueError, KeyError, TypeError) as error:
        return {"valid": False, "error": str(error)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vérifier les signatures et les fichiers sans lancer le moteur")
    parser.add_argument("directory", type=Path)
    parser.add_argument("--public-key", type=Path, required=True, help="Clé publique du signataire à laquelle le vérificateur fait confiance")
    args = parser.parse_args()
    result = verify_directory(args.directory, args.public_key)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["valid"] else 1)
