"""Distribution tests, separate from the signed T/C/P/A acceptance contract."""
from contextlib import redirect_stdout
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import tempfile
import unittest
from urllib.parse import unquote, urljoin, urlsplit
import zipfile

import package_demo


ROOT = Path(__file__).resolve().parent.parent


class Packaging(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Build one fresh, genuine signed fixture. Never depend on the age of
        # output/ or claim these synthetic test results are a new acceptance run.
        from demo import generate
        from tenir_demo.evidence import write_json
        from tests.test_configurator_integration import ConfiguratorIntegration
        cls.scratch_parent = ROOT / "tmp"
        cls.scratch_parent.mkdir(exist_ok=True)
        cls.temporary = tempfile.TemporaryDirectory(prefix="tenir-packaging-test-", dir=cls.scratch_parent)
        if Path(cls.temporary.name).resolve().parent != cls.scratch_parent.resolve():
            raise AssertionError("Test workspace must stay within the project's tmp directory")
        cls.project = Path(cls.temporary.name) / "project"
        cls.project.mkdir()
        for name, source in package_demo.collect_files(ROOT, "developer").items():
            destination = cls.project / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
        results = ConfiguratorIntegration().fixture_results()
        write_json(cls.project / "output/test-results.json", results)
        with redirect_stdout(io.StringIO()):
            if not generate(cls.project / "output", results):
                raise AssertionError("The signed packaging fixture did not generate")
        cls.original_dossier = {name: (cls.project / "output" / name).read_bytes() for name in package_demo.DOSSIER_FILES}

    @classmethod
    def tearDownClass(cls):
        if Path(cls.temporary.name).resolve().parent != cls.scratch_parent.resolve():
            raise AssertionError("Refusing to clean an unexpected test workspace")
        cls.temporary.cleanup()

    def test_allowlists_exclude_workspace_and_installed_runtime(self):
        spies = {
            ".git/config": b"private checkout metadata", ".deps/installed.py": b"installed dependency",
            ".venv/bin/python.exe": b"runtime", "tmp/ffmpeg.exe": b"helper binary",
            ".env": b"SECRET=not-a-real-secret", "tenir_demo/unwanted.exe": b"binary",
            "references/upstream-secret.pem": b"not a public key",
        }
        for name, content in spies.items():
            destination = self.project / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        consultation = package_demo.collect_files(self.project, "consultation")
        developer = package_demo.collect_files(self.project, "developer")
        self.assertTrue(set(consultation) <= set(developer))
        for name in spies:
            self.assertNotIn(name, consultation)
            self.assertNotIn(name, developer)
        self.assertNotIn("demo.py", consultation)
        self.assertNotIn("verify.py", consultation)
        self.assertFalse(any(name.startswith(("tenir_demo/", "tests/", "fixtures/")) for name in consultation))
        self.assertIn("package_demo.py", developer)
        self.assertIn("requirements.txt", developer)
        self.assertIn("tests/test_packaging.py", developer)
        self.assertIn("references/upstream-tenir-composition-governor.py", consultation,
                      "Reviewed source copies remain static provenance, separate from the root runtime")
        with self.assertRaises(package_demo.PackageError):
            package_demo._safe_file(self.project, "../escape.py")
        with self.assertRaises(package_demo.PackageError):
            package_demo.create_packages(self.project, self.project.parent / "outside")

    def test_archives_preserve_receipt_bytes_and_have_closed_product_links(self):
        results = package_demo.create_packages(self.project)
        before = {result["kind"]: (Path(result["path"])).read_bytes() for result in results}
        for result in results:
            with self.subTest(kind=result["kind"]), zipfile.ZipFile(result["path"]) as archive:
                names = archive.namelist()
                self.assertEqual(names, sorted(names))
                self.assertIsNone(archive.testzip())
                self.assertTrue(all(entry.date_time == (1980, 1, 1, 0, 0, 0) for entry in archive.infolist()))
                manifest = json.loads(archive.read("PACKAGE_MANIFEST.json"))
                self.assertEqual(manifest["signature_status"], "UNSIGNED")
                self.assertIs(manifest["dossier_verification"]["valid"], True)
                self.assertIs(manifest["dossier_verification"]["go_local"], True)
                self.assertEqual(set(manifest["files"]), set(names) - {"PACKAGE_MANIFEST.json"})
                for name, entry in manifest["files"].items():
                    data = archive.read(name)
                    self.assertEqual(entry, {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
                for name, expected in self.original_dossier.items():
                    self.assertEqual(archive.read("output/" + name), expected,
                                     "Every original dossier byte, including the signed receipt, must survive packaging")
                receipt = json.loads(archive.read("output/receipt.json"))
                for name, expected in receipt["payload"]["files"].items():
                    self.assertEqual(hashlib.sha256(archive.read("output/" + name)).hexdigest(), expected)
                self.check_local_links(archive)
        repeated = package_demo.create_packages(self.project)
        self.assertEqual(before, {result["kind"]: Path(result["path"]).read_bytes() for result in repeated},
                         "The same files and compression toolchain must produce the same ZIP bytes")

    def check_local_links(self, archive):
        class Links(HTMLParser):
            def __init__(self):
                super().__init__(); self.values = []

            def handle_starttag(self, _tag, attributes):
                self.values.extend(value for key, value in attributes if key in ("href", "src") and value)

        names = set(archive.namelist())
        for source in ("index.html", "output/configurator.html", "output/report.html", *package_demo.ROOT_DOCUMENTS):
            body = archive.read(source).decode("utf-8")
            if source.endswith(".html"):
                parser = Links(); parser.feed(body); links = parser.values
            else:
                links = re.findall(r"\]\(<?([^\s)>]+)>?\)", body)
            for link in links:
                resolved = urlsplit(urljoin("file:///kit/" + source, link))
                if resolved.scheme != "file":
                    continue
                path = unquote(resolved.path)
                self.assertTrue(path.startswith("/kit/"), (source, link))
                self.assertIn(path[len("/kit/"):], names, (source, link))

    def test_missing_or_tampered_critical_files_fail_before_distribution(self):
        for name in ("README.md", "output/report.html", "output/evidence.public.pem"):
            with self.subTest(missing=name):
                path = self.project / name
                original = path.read_bytes()
                try:
                    path.unlink()
                    with self.assertRaises(package_demo.PackageError):
                        package_demo.create_packages(self.project)
                finally:
                    path.write_bytes(original)
        path = self.project / "output/report.html"
        original = path.read_bytes()
        try:
            path.write_bytes(original + b" ")
            with self.assertRaisesRegex(package_demo.PackageError, "signed dossier"):
                package_demo.create_packages(self.project)
        finally:
            path.write_bytes(original)

    def test_stale_developer_source_refuses_packaging(self):
        source = self.project / "demo.py"
        original = source.read_bytes()
        try:
            source.write_bytes(original + b"\n# untested source change\n")
            with self.assertRaisesRegex(package_demo.PackageError, "Source fingerprint mismatch"):
                package_demo.create_packages(self.project)
        finally:
            source.write_bytes(original)

    def test_new_eligible_source_requires_a_new_recipe(self):
        source = self.project / "tenir_demo/unreviewed.py"
        try:
            source.write_bytes(b"# New source file, deliberately never imported or executed.\n")
            with self.assertRaisesRegex(package_demo.PackageError, "inventory differs from the signed recipe"):
                package_demo.create_packages(self.project)
        finally:
            if source.exists():
                source.unlink()


if __name__ == "__main__":
    unittest.main()
