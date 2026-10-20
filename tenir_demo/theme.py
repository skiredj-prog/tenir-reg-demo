"""Shared offline brand and appearance; signed data is never rewritten here."""
from pathlib import Path
import re


def apply_theme(page):
    """Embed the common assets, replacing only their own marked blocks."""
    source = Path(__file__).parent
    for tag, identity in (("style", "tenir-theme-style"), ("script", "tenir-theme-script")):
        page = re.sub(rf'<{tag} id="{identity}">[\s\S]*?</{tag}>\n?', '', page)
    css = (source / "theme.css").read_text(encoding="utf-8")
    script = (source / "theme_client.js").read_text(encoding="utf-8")
    page = page.replace('</head>', f'<style id="tenir-theme-style">{css}</style>\n</head>', 1)
    return page.replace('</body>', f'<script id="tenir-theme-script">{script}</script>\n</body>', 1)
