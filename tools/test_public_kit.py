"""Public-minimal distribution tests; never publish test artifacts."""
import hashlib
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import unittest
import zipfile

from package_demo import DOSSIER_FILES, PackageError
from tools.public_kit import ROOT, PUBLIC_PROFILE, build_public_kit
from tools.publication_audit import inspect_archive


class MinimalConsultationKit(unittest.TestCase):
    def test_offline_public_kit_is_minimal_verified_and_reproducible(self):
        with TemporaryDirectory() as folder:
            archive1 = Path(folder) / "one.zip"
            archive2 = Path(folder) / "two.zip"
            first = build_public_kit(destination=archive1)
            second = build_public_kit(destination=archive2)
            self.assertEqual(first["sha256"], second["sha256"])
            self.assertEqual(archive1.read_bytes(), archive2.read_bytes())
            self.assertTrue(first["signed_dossier_verified"])
            self.assertTrue(first["manual_approval_required"])
            self.assertFalse(first["published"])
            audit = inspect_archive(archive1)
            self.assertTrue(audit["automated_ready"], audit["findings"])
            with zipfile.ZipFile(archive1) as archive:
                names = set(archive.namelist())
                self.assertIn("index.html", names)
                self.assertIn("references/manifest.json", names)
                self.assertIn("PACKAGE_MANIFEST.json", names)
                self.assertNotIn("references/architecture-sources.json", names)
                self.assertNotIn("references/architecture-v1.html", names)
                self.assertNotIn("demo.py", names)
                self.assertNotIn("verify.py", names)
                self.assertTrue(all(name.startswith("output/") or
                                    name in {"index.html", "README.md", "PRODUCT.md",
                                             "REFERENCE_ALIGNMENT.md", "references/manifest.json",
                                             "PACKAGE_MANIFEST.json"}
                                    for name in names))
                self.assertEqual({name for name in names if name.startswith("output/")},
                                 {"output/" + x for x in DOSSIER_FILES})
                for name in DOSSIER_FILES:
                    self.assertEqual(archive.read("output/" + name),
                                     (ROOT / "output" / name).read_bytes())
                self.assertNotIn(b"PRIVATE KEY", archive.read("README.md"))
                self.assertIn(b"MANUAL_APPROVAL_REQUIRED", archive.read("PACKAGE_MANIFEST.json"))
                self.assertIn(PUBLIC_PROFILE.encode(), archive.read("PACKAGE_MANIFEST.json"))

    def test_tampered_signed_payload_causes_no_archive(self):
        with TemporaryDirectory() as folder:
            base = Path(folder)
            (base / "output").mkdir()
            (base / "tools").mkdir()
            for name in DOSSIER_FILES:
                shutil.copyfile(ROOT / "output" / name, base / "output" / name)
            shutil.copyfile(ROOT / "tools" / "public_home.html",
                            base / "tools" / "public_home.html")
            file = base / "output" / "report.html"
            file.write_bytes(file.read_bytes() + b" ")
            destination = base / "dist" / "candidate.zip"
            with self.assertRaises(PackageError):
                build_public_kit(root=base, destination=destination)
            self.assertFalse(destination.exists())


if __name__ == "__main__":
    unittest.main()
