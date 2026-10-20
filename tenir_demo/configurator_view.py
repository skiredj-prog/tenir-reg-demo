"""Page autonome : les décisions structurelles viennent du modèle Python testé."""
import json
from pathlib import Path

from .configurator import build_model
from .evidence import write_json
from .locales import RULE_EN, bilingual_static
from .theme import apply_theme


def render_configurator(bundle, verification, destination):
    destination = Path(destination)
    source = Path(__file__).parent
    model = build_model(bundle, verification)
    embedded = json.dumps(model, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    page = (source / "configurator_template.html").read_text(encoding="utf-8")
    page = page.replace('<meta data-template-only http-equiv="refresh" content="0;url=../output/configurator.html">\n', '')
    page = bilingual_static(page)
    page = page.replace("@@RULE_EN@@", json.dumps(RULE_EN, ensure_ascii=False).replace("<", "\\u003c"))
    page = page.replace("@@STYLE@@", (source / "configurator.css").read_text(encoding="utf-8")
                        + "\n" + (source / "rules_scope.css").read_text(encoding="utf-8")
                        + "\n" + (source / "configurator_ux.css").read_text(encoding="utf-8"))
    page = page.replace("@@MODEL@@", embedded)
    page = page.replace("@@SCRIPT@@", (source / "configurator_client.js").read_text(encoding="utf-8"))
    destination.write_text(apply_theme(page), encoding="utf-8")
    write_json(destination.with_name("configuration-catalogue.json"), model)
    return model
