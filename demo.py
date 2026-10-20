"""Point d'entrée CLI ; utiliser run.ps1 sous Windows."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".deps"))

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from tenir_demo.acceptance import run_tests, source_fingerprint
from tenir_demo.configurator_view import render_configurator
from tenir_demo.contracts import CONFIGURATOR_TEST_IDS, PROOF_LOOP_TEST_IDS
from tenir_demo.evidence import seal, write_json, write_public
from tenir_demo.report import render
from tenir_demo.scenario import attest, run_scenarios
from tenir_demo.verification import verify_bundle


def generate(destination, results):
    destination.mkdir(parents=True, exist_ok=True)
    signing_key, observation_key = Ed25519PrivateKey.generate(), Ed25519PrivateKey.generate()
    bundle = run_scenarios(signing_key, observation_key)
    bundle["build"] = {"source_sha256": source_fingerprint()["sha256"],
                       "test_results_sha256": hashlib.sha256((destination / "test-results.json").read_bytes()).hexdigest()}
    bundle = attest(bundle, signing_key)
    verification = verify_bundle(bundle, signing_key.public_key(), observation_key.public_key())
    write_json(destination / "evidence.json", bundle)
    write_public(destination / "evidence.public.pem", signing_key.public_key())
    write_public(destination / "signal.public.pem", observation_key.public_key())
    write_json(destination / "verification.json", verification)
    render(bundle, results, verification, destination / "report.html")
    configurator_verification = {**verification, "valid": bool(verification["valid"] and results["go"])}
    render_configurator(bundle, configurator_verification, destination / "configurator.html")
    names = ["evidence.json", "evidence.public.pem", "signal.public.pem", "test-results.json", "verification.json", "report.html",
             "configurator.html", "configuration-catalogue.json"]
    receipt = {"schema": "demo-files/v2", "files": {name: hashlib.sha256((destination / name).read_bytes()).hexdigest() for name in names},
               "go_local": bool(results["go"] and verification["valid"]), "production": False}
    write_json(destination / "receipt.json", seal(receipt, signing_key))
    print("GO LOCAL" if receipt["go_local"] else "NO-GO")
    print(f'{results["passed"]}/10 tests ; {verification.get("records", 0)} preuves vérifiées ; {verification.get("provider_calls", 0)} appels simulés.')
    print(f'{results["product_tests"]["passed"]}/{len(CONFIGURATOR_TEST_IDS)} tests du configurateur ; 144 configurations explorées.')
    if "proof_loop_tests" in results:
        print(f'{results["proof_loop_tests"]["passed"]}/{len(PROOF_LOOP_TEST_IDS)} tests de la boucle de preuve.')
    print(f'Configurateur : {destination / "configurator.html"}')
    print(f'Rapport : {destination / "report.html"}')
    return receipt["go_local"]


def main():
    parser = argparse.ArgumentParser(description="TENIR/REG — prototype local non officiel")
    parser.add_argument("command", choices=["all", "test", "demo", "verify"], nargs="?", default="all")
    parser.add_argument("--output", type=Path, default=ROOT / "output")
    args = parser.parse_args()
    destination = args.output.resolve()
    if args.command == "verify":
        from verify import verify_directory
        result = verify_directory(destination, destination / "evidence.public.pem")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["valid"] else 1
    results = run_tests(destination / ("test-only-results.json" if args.command == "test" else "test-results.json"))
    if args.command == "test":
        return 0 if results["go"] else 1
    return 0 if generate(destination, results) else 1


if __name__ == "__main__":
    sys.exit(main())
