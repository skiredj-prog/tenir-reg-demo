"""RFC 8785 (bibliothèque) + Ed25519 (cryptography), clés de développement."""
import base64
import hashlib
import json
from pathlib import Path

import rfc8785
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

DOMAIN = b"TENIR-REG-LOCAL-DEMO-v1\x00"


def canonical(value):
    return rfc8785.dumps(value)


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def key_id(public_key):
    return hashlib.sha256(public_key.public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).hexdigest()


def seal(payload, private_key):
    frozen = json.loads(canonical(payload))
    return {"payload": frozen, "integrity": {
        "algorithm": "Ed25519", "canonicalization": "RFC8785",
        "domain": "TENIR-REG-LOCAL-DEMO-v1", "key_id": key_id(private_key.public_key()),
        "payload_sha256": digest(frozen),
        "signature": base64.b64encode(private_key.sign(DOMAIN + canonical(frozen))).decode("ascii")}}


def verify(record, public_key):
    try:
        if set(record) != {"payload", "integrity"} or not isinstance(public_key, Ed25519PublicKey):
            return False
        meta = record["integrity"]
        if set(meta) != {"algorithm", "canonicalization", "domain", "key_id", "payload_sha256", "signature"}:
            return False
        if (meta["algorithm"], meta["canonicalization"], meta["domain"], meta["key_id"]) != (
                "Ed25519", "RFC8785", "TENIR-REG-LOCAL-DEMO-v1", key_id(public_key)):
            return False
        if meta["payload_sha256"] != digest(record["payload"]):
            return False
        public_key.verify(base64.b64decode(meta["signature"], validate=True), DOMAIN + canonical(record["payload"]))
        return True
    except (InvalidSignature, ValueError, TypeError, KeyError, rfc8785.CanonicalizationError):
        return False


def write_public(path, key):
    Path(path).write_bytes(key.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))


def read_public(path):
    key = serialization.load_pem_public_key(Path(path).read_bytes())
    if not isinstance(key, Ed25519PublicKey):
        raise ValueError("Clé Ed25519 publique requise")
    return key


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
