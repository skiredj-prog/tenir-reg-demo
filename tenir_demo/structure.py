import itertools
import json
from pathlib import Path

REFERENCE = Path(__file__).resolve().parent.parent / "references"
RULES = json.loads((REFERENCE / "rules.json").read_text(encoding="utf-8"))
AXES = json.loads((REFERENCE / "axes.json").read_text(encoding="utf-8"))


def violations(config):
    errors = []
    for field, values in AXES.items():
        if config.get(field) not in values:
            errors.append({"clause_id": "INPUT", "message": f"{field} absent ou inconnu"})
    for rule in RULES:
        if config.get(rule["cf"]) == rule["cv"] and config.get(rule["rf"]) not in rule["av"]:
            errors.append({"clause_id": rule["clause_id"], "message": rule["desc"]})
    return errors


def selfcheck():
    counts = {scope: 0 for scope in AXES["HOST_SCOPE"]}
    total = 0
    for values in itertools.product(*AXES.values()):
        config = dict(zip(AXES, values))
        total += 1
        if not violations(config):
            counts[config["HOST_SCOPE"]] += 1
    return {"label": "Énumération interne des règles extraites du HTML ; catalogue externe NON ÉVALUÉ",
            "configurations": total, "admissible": sum(counts.values()), "by_scope": counts}
