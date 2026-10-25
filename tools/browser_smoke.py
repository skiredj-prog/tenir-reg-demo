"""Rendered-browser smoke only; not user research, accessibility certification or publication approval."""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def main():
    paths = [ROOT / "index.html", ROOT / "output/configurator.html", ROOT / "output/report.html"]
    for target in paths:
        if not target.is_file():
            raise AssertionError(f"Missing page for browser smoke: {target.name}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for width, height in [(390, 844), (1280, 800)]:
                context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda err: errors.append(str(err)))

                page.goto(paths[0].as_uri(), wait_until="load")
                page.locator("h1").first.wait_for()
                page.locator("#language-en").click()
                assert page.locator("html").get_attribute("lang") == "en", "English translation failed"
                assert page.locator("#language-en").get_attribute("aria-pressed") == "true", "English button not selected"
                page.locator("#language-fr").click()
                assert page.locator("html").get_attribute("lang") == "fr", "French translation failed"

                page.goto(paths[1].as_uri(), wait_until="load")
                assert page.locator("#configurator-model").count() == 1, "Configuration model missing"
                assert page.locator("#field-HOST_SCOPE").count() == 1, "Scope choice missing"
                assert page.locator("#field-UNCERTAINTY").count() == 1, "Uncertainty choice missing"

                page.goto(paths[2].as_uri(), wait_until="load")
                assert page.locator("#signed-model").count() == 1, "Proof model missing"
                assert page.locator("body").is_visible(), "Report body hidden"

                metrics = page.evaluate("""() => ({
                  viewport: document.documentElement.clientWidth,
                  scrollWidth: document.documentElement.scrollWidth
                })""")
                assert not errors, f"Browser JavaScript failures ({width}px): {errors}"
                print(f"Chromium {width}x{height}: rendered 3 offline pages; bilingual switch, configuration fields and signed report; report horizontal overflow={metrics['scrollWidth']-metrics['viewport']}px (informational)")
                context.close()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
