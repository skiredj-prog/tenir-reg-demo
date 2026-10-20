"""Projection des EvidenceRecords ; aucun verdict recalculé dans l'interface."""
import html
import json
from pathlib import Path

from .structure import RULES, selfcheck
from .locales import RULE_EN, TEST_EN
from .configurator import configuration_id
from .theme import apply_theme


def report_model(bundle):
    latest = {}
    for record in bundle["records"]:
        latest[record["payload"]["operation_id"]] = record
    return {"operations": list(latest.values()),
            "runtime_configuration_id": configuration_id(bundle["profile"]["configuration"]),
            "final_budget": bundle["records"][-1]["payload"]["budget_after"],
            "provider_calls": len(bundle["records"][-1]["payload"]["provider_journal"])}


def render(bundle, results, verification, destination):
    model = report_model(bundle)
    go = (results.get("go") is True and verification.get("valid") is True)
    data = json.dumps(model, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    tests = "".join(f'<tr><td>{html.escape(t["id"])}</td><td data-fr="{html.escape(t["description"], quote=True)}" data-en="{html.escape(TEST_EN.get(t["id"], t["description"]), quote=True)}">{html.escape(t["description"])}</td><td>{html.escape(t["status"])}</td></tr>' for t in results.get("tests", []))
    clauses = "".join(f'<li><code>{r["clause_id"]}</code> <span data-fr="{html.escape(r["desc"], quote=True)}" data-en="{html.escape(RULE_EN[r["clause_id"]], quote=True)}">{html.escape(r["desc"])}</span></li>' for r in RULES)
    stats = selfcheck()
    template = (Path(__file__).parent / "report_template.html").read_text(encoding="utf-8")
    # Le modèle ouvert directement conduit au rapport ; le rapport généré ne redirige pas.
    template = template.replace('<meta data-template-only http-equiv="refresh" content="0;url=../output/report.html">\n', '')
    for key, value in {"DATA": data, "GO": "GO LOCAL" if go else "NO-GO", "TESTS": tests,
                       "CLAUSES": clauses, "COUNTS": f'{stats["admissible"]} / {stats["configurations"]}',
                       "PASSED": str(results.get("passed", 0)), "RECORDS": str(len(bundle["records"]))}.items():
        template = template.replace("@@" + key + "@@", value)
    Path(destination).write_text(apply_theme(template), encoding="utf-8")
