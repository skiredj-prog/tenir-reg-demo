"""Projection des EvidenceRecords ; aucun verdict recalculé dans l'interface."""
import html
import json
from pathlib import Path

from .structure import RULES, selfcheck
from .locales import RULE_EN, TEST_EN
from .configurator import configuration_id
from .theme import apply_theme
from .proof_loop import build_proof_loop
from .contracts import PROOF_LOOP_TEST_IDS, ALIGNMENT_TEST_IDS
from .alignment import build_alignment
from .alignment_view import render_alignment


def report_model(bundle):
    latest = {}
    histories = {}
    for record in bundle["records"]:
        operation_id = record["payload"]["operation_id"]
        latest[operation_id] = record
        histories.setdefault(operation_id, []).append(record)
    return {"operations": list(latest.values()),
            "alignment": build_alignment(),
            "evidence_records": bundle["records"],
            "proof_loops": {operation_id: build_proof_loop(records) for operation_id, records in histories.items()},
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
    evidence_valid = verification.get("valid") is True
    verification_fr = (f'{len(bundle["records"])} preuves chaînées, signées et vérifiées lors de la génération. Le dossier et les fichiers exportés portent aussi une attestation signée.' if evidence_valid else
                       "La vérification des preuves a échoué. Ce dossier est NO-GO ; consultez verification.json avant de vous appuyer sur ces données.")
    verification_en = (f'{len(bundle["records"])} chained evidence records, signed and verified at generation. The dossier and exported files also carry a signed attestation.' if evidence_valid else
                       "Evidence verification failed. This dossier is NO-GO; inspect verification.json before relying on these data.")
    template = (Path(__file__).parent / "report_template.html").read_text(encoding="utf-8")
    # Le modèle ouvert directement conduit au rapport ; le rapport généré ne redirige pas.
    template = template.replace('<meta data-template-only http-equiv="refresh" content="0;url=../output/report.html">\n', '')
    for key, value in {"DATA": data, "GO": "GO LOCAL" if go else "NO-GO", "TESTS": tests,
                       "VERIFICATION_FR": html.escape(verification_fr, quote=True),
                       "VERIFICATION_EN": html.escape(verification_en, quote=True),
                       "REPORT_TITLE_FR": "TENIR/REG · Démonstration locale vérifiée" if evidence_valid else "TENIR/REG · Vérification échouée",
                       "REPORT_TITLE_EN": "TENIR/REG · Verified local demonstration" if evidence_valid else "TENIR/REG · Verification failed",
                       "ALIGNMENT": render_alignment(model["alignment"]),
                       "ALIGNMENT_STYLE": (Path(__file__).parent / "alignment.css").read_text(encoding="utf-8"),
                       "PROOF_LOOP_CLIENT": (Path(__file__).parent / "proof_loop_client.js").read_text(encoding="utf-8"),
                       "PROOF_LOOP_STYLE": (Path(__file__).parent / "proof_loop.css").read_text(encoding="utf-8"),
                       "PROOF_LOOP_PASSED": str(results.get("proof_loop_tests", {}).get("passed", 0)),
                       "PROOF_LOOP_TOTAL": str(len(PROOF_LOOP_TEST_IDS)),
                       "ALIGNMENT_PASSED": str(results.get("alignment_tests", {}).get("passed", 0)),
                       "ALIGNMENT_TOTAL": str(len(ALIGNMENT_TEST_IDS)),
                       "CLAUSES": clauses, "COUNTS": f'{stats["admissible"]} / {stats["configurations"]}',
                       "PASSED": str(results.get("passed", 0)), "RECORDS": str(len(bundle["records"]))}.items():
        template = template.replace("@@" + key + "@@", value)
    Path(destination).write_text(apply_theme(template), encoding="utf-8")
