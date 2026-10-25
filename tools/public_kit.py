"""Create a minimal offline public-candidate ZIP from existing, unchanged, verified signed output.
Private upstream files and developer source are NOT redistributed. No publication occurs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import zipfile

from package_demo import DOSSIER_FILES, PackageError, _PageLinks, _local_target
from tools.publication_audit import inspect_archive
from verify import verify_directory

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_NAME = "TENIR-REG-public-consultation.zip"
PUBLIC_PROFILE = "tenir-reg-public-minimal/v1"

PUBLIC_README = """# TENIR / REG — Diagnostic & Evidence Workbench

Edition publique minimale / Minimal public consultation edition.

FR : ouvrez index.html et commencez par UNKNOWN. Le verdict historique PASS ne prouve
pas la confirmation de l'effet chez le fournisseur simulé. Quatre scénarios fictifs,
quatre axes de configuration et une boucle de preuve en huit étapes sont disponibles.

EN: Open index.html and start with UNKNOWN. A historical PASS does not establish a
confirmed external provider effect. Explore four fictional scenarios, four configuration
axes and an eight-stage evidence walkthrough.

## Local routes / Parcours
- index.html — bilingual, unsigned editorial entry.
- output/configurator.html — standalone controls/configurations.
- output/report.html — standalone simulated signed-record browser.
- PRODUCT.md and REFERENCE_ALIGNMENT.md — PUBLIC editorial summaries, unsigned;
  these are NOT the full original private documents.
- references/manifest.json — public summary only, not the original source reference record.
- PACKAGE_MANIFEST.json — unsigned inventory and file digests.

## What the signature establishes / Ce que la signature établit
The original signed dossier and receipt are preserved byte for byte. Their
Ed25519 signatures prove data consistency relative to the supplied public key,
not the independent identity of the signer, truth of observations, or external effect.
Obtain the public key or fingerprint through an independent trusted channel.

La clé publique du dossier doit être authentifiée par un canal indépendant.
La page HTML ne vérifie pas elle-même les signatures cryptographiques.
La recette enregistrée est une simulation locale, pas un test indépendant du runtime.

## Limits / Limites
- No live TENIR-Gov connection; the runtime reference is v5.7.0.
- No persistent state, remote provider, production deployment or certification.
- UNKNOWN is unresolved and cannot justify a blind retry.
- Structural admissibility is NOT effective runtime conformance.
- The complete source fingerprint refers to a separate private source tree
  NOT distributed by this slim consultation archive.
- No developer code, third-party reference PDFs, private path manifests or licenses
  are re-exported by this minimal ZIP.
- The generated HTML works offline. Optional GitHub source links require network access.
"""

PUBLIC_PRODUCT = """# TENIR/REG — Public scope / Périmètre public

This is a NEW, UNSIGNED, PUBLIC editorial companion, not the private product
specification. The offline workbench serves architecture and governance workshops.
It contains a four-axis structural [configurator](output/configurator.html) and an
[existing synthetic evidence report](output/report.html).

FR : choisir un contrôle candidat et relire une trace simulée n'exécute aucune action.
EN: selecting a candidate configuration or scenario does not dispatch any action.
There is no live gateway, customer-facing production proof or certification.
"""

PUBLIC_ALIGNMENT = """# Runtime alignment — public summary

New unsigned editorial companion; not the private source-alignment analysis.

The bounded REG catalogue comparison reports 144 configurations, 1,008 clause
outcomes and 42 structurally admissible selections. This does NOT demonstrate
effective guarantees. TENIR-Gov 5.7.0 is a REFERENCE, not this simulator engine.
Execution compatibility remains NOT_VERIFIED.

Known contract differences concern budget commitment, HOLD reservations, UNKNOWN
reconciliation and current-disposition responses on retry. See the separate
[configurator](output/configurator.html) and [simulated report](output/report.html).

FR : concordance structurelle ne signifie ni équivalence à TENIR-Gov v5.7.0,
ni certification ni confirmation d'un effet externe.
"""

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def public_reference_summary() -> bytes:
    value = {
        "schema": "tenir-public-reference-summary/v1",
        "status": "UNSIGNED_PUBLIC_SUMMARY",
        "original_reference_files": "INTENTIONALLY_NOT_DISTRIBUTED",
        "reason": "Local private provenance and possible third-party redistribution limits",
        "runtime_reference": "TENIR-Gov v5.7.0",
        "execution_compatibility": "NOT_VERIFIED",
        "structural_catalogue": {"configurations": 144, "clauses_per_configuration": 7,
                                 "admissible_structural": 42,
                                 "effective_guarantee_demonstrated": False},
        "signed": False
    }
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def build_public_kit(root: Path = ROOT, destination: Path | None = None) -> dict:
    root = Path(root).resolve()
    output = (Path(destination).resolve() if destination else root / "dist" / ARCHIVE_NAME)
    if output.is_relative_to(root / "output"):
        raise PackageError("Cannot overwrite signed output")
    evidence_dir = root / "output"
    verified = verify_directory(evidence_dir, evidence_dir / "evidence.public.pem")
    if verified.get("valid") is not True or verified.get("go_local") is not True or verified.get("production") is not False:
        raise PackageError("Synthetic signed dossier is not verified GO LOCAL")
    files = {
        **{"output/" + name: (evidence_dir / name).read_bytes() for name in DOSSIER_FILES},
        "index.html": (root / "tools" / "public_home.html").read_bytes(),
        "README.md": PUBLIC_README.encode("utf-8"),
        "PRODUCT.md": PUBLIC_PRODUCT.encode("utf-8"),
        "REFERENCE_ALIGNMENT.md": PUBLIC_ALIGNMENT.encode("utf-8"),
        "references/manifest.json": public_reference_summary(),
    }
    for page_name in ("index.html", "output/configurator.html", "output/report.html"):
        parser = _PageLinks()
        parser.feed(files[page_name].decode("utf-8"))
        for href in parser.links:
            target = _local_target(page_name, href)
            if target is not None and target not in files:
                raise PackageError("Broken public offline link: " + page_name + " -> " + target)
    meta = {
        "schema": "tenir-demo-package/v1",
        "kind": "consultation",
        "distribution_profile": PUBLIC_PROFILE,
        "signature_status": "UNSIGNED",
        "entrypoint": "index.html",
        "signed_dossier_preserved": True,
        "signed_receipt_sha256": sha(files["output/receipt.json"]),
        "dossier_verification": verified,
        "source_fingerprint_scope": "PRIVATE_SOURCE_NOT_DISTRIBUTED",
        "public_editorial_companions_unsigned": True,
        "third_party_reference_files": "OMITTED",
        "publication_authorization": "MANUAL_APPROVAL_REQUIRED",
        "files": {name: {"sha256": sha(value), "bytes": len(value)}
                  for name, value in sorted(files.items())},
    }
    package = {**files, "PACKAGE_MANIFEST.json":
               (json.dumps(meta, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".tenir-public-", suffix=".zip", dir=output.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, value in sorted(package.items()):
                entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, value, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        outcome = inspect_archive(temporary)
        if not outcome["automated_ready"]:
            raise PackageError("Machine preflight failed: " + json.dumps(outcome["findings"], ensure_ascii=False))
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "schema": "tenir-public-kit-build/v1",
        "archive": output.name, "sha256": sha(output.read_bytes()),
        "bytes": output.stat().st_size,
        "files": len(package), "signed_dossier_verified": True,
        "machine_preflight": "PASS", "manual_approval_required": True,
        "published": False
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build but DO NOT publish a machine-audited offline consultation candidate")
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / ARCHIVE_NAME)
    args = parser.parse_args()
    try:
        result = build_public_kit(destination=args.output)
    except (PackageError, OSError, ValueError, TypeError, KeyError) as exc:
        print("NO-GO: " + str(exc), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
