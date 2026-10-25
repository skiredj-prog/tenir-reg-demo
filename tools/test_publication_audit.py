"""Synthetic unit tests: prove the publication gate refuses unsafe content and forgery."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import zipfile

from tools.publication_audit import inspect_archive


class PublicationAudit(unittest.TestCase):
    def make_zip(self, root, files, *, extra=None, dishonest=False):
        path = Path(root) / "sample.zip"
        manifest = {
            "schema": "tenir-demo-package/v1", "kind": "consultation",
            "signature_status": "UNSIGNED", "entrypoint": "index.html",
            "files": {name: {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
                      for name, data in files.items()},
        }
        if dishonest:
            manifest["files"]["index.html"]["sha256"] = "0" * 64
        with zipfile.ZipFile(path, "w") as zf:
            for name, data in files.items():
                zf.writestr(name, data)
            zf.writestr("PACKAGE_MANIFEST.json", json.dumps(manifest))
            if extra:
                for name, data in extra.items():
                    zf.writestr(name, data)
        return inspect_archive(path)

    def test_clean_synthetic_kit_is_machine_eligible_but_not_manually_approved(self):
        with TemporaryDirectory() as d:
            result = self.make_zip(d, {"index.html": b"<h1>Simulated only</h1>"})
        self.assertTrue(result["automated_ready"])
        self.assertTrue(result["manual_release_review_required"])
        self.assertEqual(result["findings"], [])

    def test_windows_and_unix_user_profiles_are_blockers_without_leaking_values(self):
        with TemporaryDirectory() as d:
            content = json.dumps({"path": r"C:\Users\private-user\Downloads\source.md",
                                  "another": "/home/private-user/source.md"}).encode()
            result = self.make_zip(d, {"index.html": b"<p>Simulated</p>", "references/manifest.json": content})
        self.assertFalse(result["automated_ready"])
        self.assertEqual({x["code"] for x in result["findings"]},
                         {"WINDOWS_USER_PATH", "UNIX_USER_PATH"})
        self.assertNotIn("private-user", json.dumps(result))

    def test_tampered_manifest_blocks_distribution(self):
        with TemporaryDirectory() as d:
            result = self.make_zip(d, {"index.html": b"Demo"}, dishonest=True)
        self.assertIn("INVALID_INVENTORY_DIGEST", {x["code"] for x in result["findings"]})

    def test_private_key_or_added_file_blocks_distribution(self):
        with TemporaryDirectory() as d:
            result = self.make_zip(
                d, {"index.html": b"<html>demo</html>",
                    "output/secret.pem": b"-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----"},
                extra={"extra.txt": b"unexpected"})
        self.assertIn("PRIVATE_KEY_PEM", {x["code"] for x in result["findings"]})
        self.assertIn("INVENTORY_MISMATCH", {x["code"] for x in result["findings"]})

    def test_path_traversal_is_rejected_without_extracting(self):
        with TemporaryDirectory() as d:
            result = self.make_zip(d, {"index.html": b"demo"}, extra={"../evil.txt": b"test"})
        self.assertIn("UNSAFE_ARCHIVE_PATH", {x["code"] for x in result["findings"]})


if __name__ == "__main__":
    unittest.main()
