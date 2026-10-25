"""Read-only, fail-closed publication preflight for a TENIR/REG consultation ZIP.

This is NOT a verification of Ed25519 signatures, external effects, rights or legal compliance.
Run verify.py on the exact evidence bytes as a separate step.
Do not use --release or upload a kit until both machine and manual release gates pass.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import PurePosixPath, Path

TEXT_SUFFIXES = {".html", ".htm", ".md", ".json", ".yaml", ".yml", ".txt", ".xml",
                 ".js", ".css", ".py", ".toml", ".ps1", ".pem", ".svg", ".csv"}
MAX_TEXT_BYTES = 5_000_000  # fail closed rather than silently ignore oversized candidate sources
PATTERNS = {
    "WINDOWS_USER_PATH": re.compile(r"(?i)(?<![\w])(?:[a-z]:[\\/]{1,2}(?:Users|Documents and Settings)[\\/]{1,2})"),
    "UNIX_USER_PATH": re.compile(r"(?i)(?:/Users/|/home/)[a-z0-9._-]+(?:/|\b)"),
    "LOCAL_FILE_URL": re.compile(r"(?i)file:///(?:[a-z]:|Users/|home/)"),
    "PRIVATE_KEY_PEM": re.compile(r"-----BEGIN (?:[A-Z ]* )?PRIVATE KEY-----"),
}
BANNED_PARTS = {".git", ".venv", ".deps", "node_modules", "__pycache__", ".env", "secrets"}


def _digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def inspect_archive(archive: Path) -> dict:
    """Return audit findings, never private contents; avoid extracting untrusted ZIPs."""
    findings = []
    checked = 0
    def report(code: str, file: str = "<archive>") -> None:
        # Deliberately NEVER include the matched content or local absolute path.
        findings.append({"code": code, "file": file})

    try:
        with zipfile.ZipFile(archive) as zf:
            members = zf.infolist()
            names = [m.filename for m in members]
            if len(names) != len(set(names)):
                report("DUPLICATE_ARCHIVE_ENTRY")
            for member in members:
                name = member.filename
                parts = PurePosixPath(name)
                if (name.startswith("/") or "\\" in name or
                    not parts.parts or ".." in parts.parts or ":" in name or
                    any(part.lower() in BANNED_PARTS for part in parts.parts) or
                    str(parts) != name):
                    report("UNSAFE_ARCHIVE_PATH", name)
                if stat.S_IFMT(member.external_attr >> 16) == stat.S_IFLNK:
                    report("SYMLINK_IN_ARCHIVE", name)
                if member.is_dir():
                    report("DIRECTORY_ENTRY", name)

            if "PACKAGE_MANIFEST.json" not in names:
                report("MISSING_PACKAGE_MANIFEST")
                manifest = {}
            else:
                manifest = json.loads(zf.read("PACKAGE_MANIFEST.json"))
                if not isinstance(manifest, dict):
                    report("MALFORMED_PACKAGE_MANIFEST")
                    manifest = {}

            if manifest:
                if (manifest.get("schema") != "tenir-demo-package/v1" or
                    manifest.get("kind") != "consultation" or
                    manifest.get("signature_status") != "UNSIGNED" or
                    manifest.get("entrypoint") != "index.html"):
                    report("INVALID_PACKAGE_CONTRACT")
                inventory = manifest.get("files")
                if not isinstance(inventory, dict):
                    report("MISSING_PACKAGE_INVENTORY")
                else:
                    if set(inventory) != set(names) - {"PACKAGE_MANIFEST.json"}:
                        report("INVENTORY_MISMATCH")
                    for name, meta in inventory.items():
                        if name not in names:
                            report("MISSING_INVENTORY_FILE", name)
                            continue
                        data = zf.read(name)
                        if not isinstance(meta, dict) or meta.get("sha256") != _digest(data) or meta.get("bytes") != len(data):
                            report("INVALID_INVENTORY_DIGEST", name)

            for name in names:
                if PurePosixPath(name).suffix.lower() not in TEXT_SUFFIXES:
                    continue
                data = zf.read(name)
                if len(data) > MAX_TEXT_BYTES:
                    report("TEXT_TOO_LARGE_TO_AUDIT", name)
                    continue
                try:
                    value = data.decode("utf-8")
                except UnicodeDecodeError:
                    report("UNREADABLE_TEXT", name)
                    continue
                # JSON source paths are escaped with doubled backslashes. Scan both forms.
                inputs = (value, value.replace("\\\\", "\\"))
                for code, pattern in PATTERNS.items():
                    if any(pattern.search(item) for item in inputs):
                        report(code, name)
                checked += 1
    except (OSError, zipfile.BadZipFile, KeyError, ValueError, TypeError, json.JSONDecodeError) as error:
        report("ARCHIVE_UNREADABLE")
    findings.sort(key=lambda item: (item["code"], item["file"]))
    return {
        "schema": "tenir-publication-preflight/v1",
        "archive": archive.name,
        "automated_ready": not findings,
        "manual_release_review_required": True,
        "manual_gates": [
            "Review redistribution/licensing of every included reference and third-party source.",
            "Verify genuine desktop/mobile browser rendering, keyboard navigation and screen-reader basics.",
            "Verify evidence signature against a trusted out-of-band Ed25519 public key.",
            "Confirm customer-facing wording never claims TENIR-Gov runtime execution or certification.",
            "Approve exact release bytes, owner, version and publication destination.",
        ],
        "text_files_scanned": checked,
        "blocker_count": len(findings),
        "findings": findings,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Audit the exact offline consultation ZIP before any public distribution")
    parser.add_argument("archive", type=Path)
    parser.add_argument("--report-only", action="store_true", help="Report blockers without failing CI (not a publication approval)")
    args = parser.parse_args(argv)
    outcome = inspect_archive(args.archive)
    print(json.dumps(outcome, ensure_ascii=False, indent=2))
    if not outcome["automated_ready"] and not args.report_only:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
