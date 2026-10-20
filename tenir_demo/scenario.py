import json
from pathlib import Path

from .engine import Engine, make_request, make_signal
from .evidence import digest, key_id, seal

ROOT = Path(__file__).resolve().parent.parent


def run_scenarios(signing_key, signal_private_key):
    oracle = json.loads((ROOT / "fixtures/acceptance.json").read_text(encoding="utf-8"))
    now = oracle["reference_time"]
    engine = Engine(signing_key, signal_private_key.public_key())
    for case in oracle["scenarios"]:
        signal = make_signal(signal_private_key, now, case["signal"]) if case["signal"] else None
        request = make_request(case["id"], case["amount"], signal, case["outcome"])
        engine.execute(request, now)
        if case["outcome"] == "UNKNOWN":
            engine.execute(request, now + 3600)  # rejouer après expiration ne réécrit pas le verdict historique
    bundle = engine.bundle()
    bundle["signal_public_key_id"] = key_id(signal_private_key.public_key())
    return bundle


def attest(bundle, key):
    core = {k: v for k, v in bundle.items() if k != "attestation"}
    return {**core, "attestation": seal({"schema": "demo-dossier/v1", "bundle_sha256": digest(core),
                                       "record_count": len(core["records"])}, key)}
