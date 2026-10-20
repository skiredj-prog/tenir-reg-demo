"""Build two offline distribution kits from explicit file allowlists.

Packaging preserves the existing signed dossier. Its own inventory is unsigned
distribution metadata, not an additional evidence or certification claim.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile


ROOT = Path(__file__).resolve().parent
ROOT_DOCUMENTS = (
    "README.md", "PRODUCT.md", "ALIGNMENT.md", "REFERENCE_ALIGNMENT.md",
    "UX_REVIEW.md", "USER_WALKTHROUGH.md", "GUIDE_CONSULTATION.md",
    "REVIEW_ACTIONS.md", "DIAGNOSTIC_ATELIER.md",
)
DOSSIER_FILES = (
    "configuration-catalogue.json", "configurator.html", "evidence.json",
    "evidence.public.pem", "receipt.json", "report.html", "signal.public.pem",
    "test-results.json", "verification.json",
)
DEVELOPER_ROOT_FILES = (
    "demo.py", "verify.py", "package_demo.py", "run.ps1", "requirements.txt",
    ".gitignore", ".gitattributes",
)
DEVELOPER_TREES = {
    "tenir_demo": {".py", ".html", ".css", ".js"},
    "tests": {".py", ".cjs"},
    "fixtures": {".json"},
}
REFERENCE_SUFFIXES = {".json", ".yaml", ".yml", ".md", ".html", ".pdf", ".png", ".py", ".toml"}
EXCLUDED_PARTS = {".git", ".deps", ".venv", "venv", "env", ".env", "tmp", "dist",
                  "__pycache__", ".pytest_cache", ".mypy_cache", "node_modules", "ffmpeg"}
ARCHIVE_NAMES = {"consultation": "TENIR-REG-consultation.zip", "developer": "TENIR-REG-developer.zip"}
HEX64 = re.compile(r"[0-9a-f]{64}\Z")


class PackageError(ValueError):
    """The current project cannot produce a complete, verified kit."""


def _sha256(content):
    return hashlib.sha256(content).hexdigest()


def _safe_file(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise PackageError("Invalid package path")
    pure = PurePosixPath(relative)
    if (pure.is_absolute() or str(pure) != relative or not pure.parts
            or any(part in (".", "..") or ":" in part for part in pure.parts)
            or any(part.lower() in EXCLUDED_PARTS for part in pure.parts)):
        raise PackageError("Excluded or unsafe package path: " + relative)
    cursor = root
    for part in pure.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise PackageError("Symbolic links are not packaged: " + relative)
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise PackageError("Required file is missing or outside the project: " + relative)
    return path


def collect_files(root, kind):
    """Return sorted relative names and safe existing files; never scan Git/deps."""
    root = Path(root).resolve()
    if kind not in ARCHIVE_NAMES:
        raise PackageError("Unknown package kind: " + str(kind))
    names = {"index.html", *ROOT_DOCUMENTS, *("output/" + name for name in DOSSIER_FILES)}
    references = root / "references"
    if not references.is_dir() or references.is_symlink():
        raise PackageError("The flat references directory is missing or unsafe")
    for path in sorted(references.iterdir()):
        if path.is_file() and (path.suffix.lower() in REFERENCE_SUFFIXES or path.name.endswith("-LICENSE")):
            names.add(path.relative_to(root).as_posix())
    if kind == "developer":
        names.update(DEVELOPER_ROOT_FILES)
        for directory, suffixes in DEVELOPER_TREES.items():
            top = root / directory
            if not top.is_dir() or top.is_symlink():
                raise PackageError("Required developer source directory is missing or unsafe: " + directory)
            for parent, directories, files in os.walk(top, followlinks=False):
                directories[:] = sorted(name for name in directories if name.lower() not in EXCLUDED_PARTS)
                for name in sorted(files):
                    path = Path(parent) / name
                    if path.suffix.lower() in suffixes:
                        names.add(path.relative_to(root).as_posix())
    return {name: _safe_file(root, name) for name in sorted(names)}


class _PageLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, _tag, attributes):
        self.links.extend(value for name, value in attributes if name in ("href", "src") and value)


def _local_target(source, link):
    parts = urlsplit(link)
    if parts.scheme or parts.netloc or not parts.path:
        return None
    path = unquote(parts.path)
    if "\\" in path or path.startswith("/"):
        raise PackageError("Non-portable local link in " + source + ": " + link)
    target = posixpath.normpath(posixpath.join(posixpath.dirname(source), path))
    if target == ".." or target.startswith("../"):
        raise PackageError("Local link leaves the package: " + source + " -> " + link)
    return target


def _check_consultation_links(files):
    # Original reference HTML remains documentary source material. Product pages
    # and delivered root guides must have complete local file destinations.
    for name in ("index.html", "output/configurator.html", "output/report.html", *ROOT_DOCUMENTS):
        text = files[name].decode("utf-8")
        if name.endswith(".html"):
            parser = _PageLinks(); parser.feed(text)
            links = parser.links
        else:
            links = re.findall(r"\]\(<?([^\s)>]+)>?\)", text)
        for link in links:
            target = _local_target(name, link)
            if target is not None and target not in files:
                raise PackageError("Local consultation link is missing from the kit: " + name + " -> " + target)


def _verified_dossier(dossier, root):
    """Verify precisely the captured bytes, including the unchanged receipt."""
    sys.path.insert(0, str(ROOT / ".deps"))
    try:
        from verify import verify_directory
    except ImportError as error:
        raise PackageError("Install the developer requirements before packaging: python -m pip install -r requirements.txt") from error
    scratch = root / "tmp"
    if scratch.is_symlink() or not scratch.resolve().is_relative_to(root):
        raise PackageError("The private verification workspace must remain within the project")
    scratch.mkdir(exist_ok=True)
    snapshot = Path(tempfile.mkdtemp(prefix="tenir-package-verify-", dir=scratch))
    if snapshot.resolve().parent != scratch.resolve():
        raise PackageError("Invalid verification workspace")
    try:
        for name, content in dossier.items():
            (snapshot / name).write_bytes(content)
        checked = verify_directory(snapshot, snapshot / "evidence.public.pem")
    finally:
        # Only our nine fixed files and our fresh directory are removed.
        # Never recurse into an existing workspace or clean the user's tmp/.
        for name in DOSSIER_FILES:
            (snapshot / name).unlink(missing_ok=True)
        snapshot.rmdir()
    if checked.get("valid") is not True or checked.get("go_local") is not True:
        raise PackageError("The signed dossier must verify with GO LOCAL before packaging: " + json.dumps(checked, ensure_ascii=False))
    receipt = json.loads(dossier["receipt.json"])
    if receipt["payload"].get("schema") != "demo-files/v2" or len(receipt["payload"]["files"]) != 8:
        raise PackageError("The two kits require the current nine-file v2 dossier")
    return checked


def _check_source_snapshot(files):
    tests = json.loads(files["output/test-results.json"])
    source = tests.get("source", {})
    expected = source.get("files")
    if not isinstance(expected, dict) or not expected:
        raise PackageError("The signed test recipe has no source fingerprint")
    from tenir_demo.evidence import digest
    if digest(expected) != source.get("sha256"):
        raise PackageError("The signed source inventory does not match its fingerprint")
    eligible = set(files) - {"output/" + name for name in DOSSIER_FILES} - {".gitignore", ".gitattributes"}
    if eligible != set(expected):
        extra, missing = sorted(eligible - set(expected)), sorted(set(expected) - eligible)
        raise PackageError("Developer source inventory differs from the signed recipe; regenerate before packaging: "
                           + json.dumps({"untested_files": extra, "missing_files": missing}, ensure_ascii=False))
    for name, fingerprint in expected.items():
        if name not in files or not isinstance(fingerprint, str) or not HEX64.fullmatch(fingerprint):
            raise PackageError("The signed source is missing from the developer allowlist: " + str(name))
        if _sha256(files[name]) != fingerprint:
            raise PackageError("Source fingerprint mismatch; regenerate and verify the dossier before packaging: " + name)
    return source["sha256"]


def _manifest(kind, files, checked, source_fingerprint):
    return {
        "schema": "tenir-demo-package/v1", "kind": kind, "signature_status": "UNSIGNED",
        "purpose": "Distribution inventory only; not a certification or a new signed EvidenceRecord.",
        "entrypoint": "index.html", "start_guide": "GUIDE_CONSULTATION.md",
        "dossier_verification": checked,
        "signed_receipt_sha256": _sha256(files["output/receipt.json"]),
        "tested_source_fingerprint": source_fingerprint,
        "receipt_covered_files_preserved": 8,
        "reference_python_files": "Static upstream provenance; not imported by the consultation pages.",
        "dependencies": "Install requirements.txt in the developer kit; no installed dependencies or runtime binaries are bundled.",
        "inventory_excludes": ["PACKAGE_MANIFEST.json"],
        "files": {name: {"sha256": _sha256(content), "bytes": len(content)} for name, content in sorted(files.items())},
    }


def _write_zip(destination, files, manifest):
    content = {**files, "PACKAGE_MANIFEST.json": (json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")}
    handle = tempfile.NamedTemporaryFile(prefix=".tenir-package-", suffix=".zip", dir=destination.parent, delete=False)
    temporary = Path(handle.name); handle.close()
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(content.items()):
                entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {"kind": manifest["kind"], "path": str(destination), "bytes": destination.stat().st_size,
            "sha256": _sha256(destination.read_bytes()), "file_count": len(content),
            "uncompressed_bytes": sum(len(data) for data in content.values()), "signature_status": "UNSIGNED"}


def create_packages(root=ROOT, output_directory="dist"):
    """Validate first, then atomically write the two named ZIPs, without cleanup."""
    root = Path(root).resolve()
    output = Path(output_directory)
    output = (root / output).resolve() if not output.is_absolute() else output.resolve()
    if (not output.is_relative_to(root) or any(part.lower() in EXCLUDED_PARTS - {"dist"} for part in output.relative_to(root).parts)
            or output == root / "output" or any(output.is_relative_to(root / name) for name in ("references", *DEVELOPER_TREES))):
        raise PackageError("Package output must stay in a project distribution directory, outside sources and the signed dossier")
    consultation_paths = collect_files(root, "consultation")
    developer_paths = collect_files(root, "developer")
    developer_files = {name: path.read_bytes() for name, path in developer_paths.items()}
    consultation_files = {name: developer_files[name] for name in consultation_paths}
    checked = _verified_dossier({name: developer_files["output/" + name] for name in DOSSIER_FILES}, root)
    fingerprint = _check_source_snapshot(developer_files)
    _check_consultation_links(consultation_files)
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for kind, files in (("consultation", consultation_files), ("developer", developer_files)):
        results.append(_write_zip(output / ARCHIVE_NAMES[kind], files, _manifest(kind, files, checked, fingerprint)))
    return results


def main():
    parser = argparse.ArgumentParser(description="Build verified TENIR/REG consultation and developer ZIPs; inventory metadata is unsigned")
    parser.add_argument("--output", default="dist", help="Distribution folder within this project (default: dist)")
    args = parser.parse_args()
    try:
        results = create_packages(output_directory=args.output)
    except (PackageError, OSError, ValueError, KeyError, TypeError) as error:
        print("Packaging failed: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
