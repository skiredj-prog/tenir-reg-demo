"""Browser smoke for exact minimal-public ZIP bytes. No network integration required."""
from pathlib import Path
from tempfile import TemporaryDirectory
import zipfile

from playwright.sync_api import sync_playwright
from tools.publication_audit import inspect_archive
from tools.public_kit import ROOT, ARCHIVE_NAME


def main():
    archive = ROOT / "dist" / ARCHIVE_NAME
    audited = inspect_archive(archive)
    assert audited["automated_ready"], audited["findings"]
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(root)  # Safe only because strict archive-path preflight passed.
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for width, height in ((390, 844), (1280, 800)):
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    failures = []
                    page.on("pageerror", lambda error: failures.append(str(error)))
                    page.goto((root / "index.html").as_uri(), wait_until="load")
                    page.locator("#hero-title").wait_for()
                    assert page.locator("html").get_attribute("lang") == "fr"
                    assert page.locator("a[href^='output/report.html']").count() >= 1
                    page.locator("#lang-en").click()
                    assert page.locator("html").get_attribute("lang") == "en"
                    assert page.locator("#lang-en").get_attribute("aria-pressed") == "true"
                    assert "outcome remains unknown" in page.locator("#hero-title").inner_text()
                    page.locator("#lang-fr").click()
                    assert page.locator("html").get_attribute("lang") == "fr"
                    metrics = page.evaluate("() => ({viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth})")
                    assert metrics["page"] <= metrics["viewport"] + 2, "Public landing clipped horizontally"
                    page.locator("a.cta[href*='report.html']").first.click()
                    assert page.url.startswith("file:")
                    assert "report.html" in page.url
                    assert page.locator("#signed-model").count() == 1
                    page.goto((root / "output" / "configurator.html").as_uri(), wait_until="load")
                    assert page.locator("#configurator-model").count() == 1
                    assert page.locator("#field-HOST_SCOPE").count() == 1
                    assert not failures, "Offline browser errors: " + repr(failures)
                    print(f"Public ZIP Chromium {width}x{height}: FR/EN, first visitor action, sealed report, configurator; no browser exception, no landing horizontal overflow.")
                    context.close()
            finally:
                browser.close()


if __name__ == "__main__":
    main()
