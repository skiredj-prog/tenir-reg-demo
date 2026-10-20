"""Deterministic, unsigned configuration drafts from the extracted local rules.

Structural admissibility is separate from execution support and from evidence
already verified by the caller. This module neither runs nor signs a scenario.
"""
from copy import deepcopy
from itertools import product

from .engine import PROFILE
from .evidence import digest
from .structure import AXES, RULES, violations
from .proof_loop import STAGE_IDS
from .alignment import build_alignment


SCHEMA = "demo-configurator/v1"
DRAFT_SCHEMA = "demo-configuration-draft/v1"
RULES_VERSION = "extracted-html-v1"


def configuration_id(configuration):
    """A value-based identifier independent of the enumeration's position."""
    return "cfg-" + digest(configuration)[:16]


def _distance(left, right):
    return sum(left[field] != right[field] for field in AXES)


def _verified_runtime(bundle, verification):
    profile = bundle.get("profile") if isinstance(bundle, dict) else None
    return (isinstance(profile, dict)
            and profile.get("configuration") == PROFILE["configuration"]
            and isinstance(verification, dict)
            and verification.get("valid") is True)


def _verification_summary(verification):
    # Only the verifier's JSON-safe counters are projected, never caller data.
    return {field: value if type(value) is int and value >= 0 else None
            for field in ("records", "operations", "provider_calls")
            for value in (verification.get(field),)}


def build_model(bundle=None, verification=None):
    """Enumerate all drafts and all nearest valid corrections without mutation.

    ``verification`` must be the result of the independent bundle verifier for
    the supplied ``bundle``. No positive verification is inferred from merely
    selecting the runtime's configuration or from passing the structural rules.
    """
    runtime_configuration = PROFILE["configuration"]
    alignment = build_alignment()
    verified_runtime = _verified_runtime(bundle, verification)
    rule_by_id = {rule["clause_id"]: rule for rule in RULES}
    entries = []
    for values in product(*AXES.values()):
        configuration = dict(zip(AXES, values))
        rejected = violations(configuration)
        violated_clauses = {rejection["clause_id"] for rejection in rejected}
        details = []
        for rejection in rejected:
            rule = rule_by_id[rejection["clause_id"]]
            details.append({**rejection, "fields": [rule["cf"], rule["rf"]]})
        involved = {field for detail in details for field in detail["fields"]}
        runtime_supported = configuration == runtime_configuration
        entries.append({
            "id": configuration_id(configuration),
            "configuration": configuration,
            "admissible": not details,
            "violations": details,
            "rule_results": [{
                "clause_id": rule["clause_id"],
                "rule_id": rule["rule_id"],
                "message": rule["desc"],
                "fields": [rule["cf"], rule["rf"]],
                "condition": {"field": rule["cf"], "value": rule["cv"],
                              "actual": configuration[rule["cf"]]},
                "requirement": {"field": rule["rf"], "allowed": list(rule["av"]),
                                "actual": configuration[rule["rf"]]},
                "status": ("VIOLATED" if rule["clause_id"] in violated_clauses
                           else "SATISFIED" if configuration[rule["cf"]] == rule["cv"]
                           else "NOT_APPLICABLE"),
            } for rule in RULES],
            "highlighted_fields": [field for field in AXES if field in involved],
            "runtime_supported": runtime_supported,
            "guarantees_status": ("LOCAL_DEMO_TESTED" if runtime_supported and verified_runtime
                                  else "NOT_DEMONSTRATED"),
            "suggestions": [],
        })

    admissible = [entry for entry in entries if entry["admissible"]]
    for entry in entries:
        if entry["admissible"]:
            continue
        source = entry["configuration"]
        distances = [(target, _distance(source, target["configuration"]))
                     for target in admissible]
        minimum = min(distance for _, distance in distances)
        nearest = [target for target, distance in distances if distance == minimum]
        # Python's stable sort keeps AXES product order inside the two groups.
        nearest.sort(key=lambda target: target["configuration"]["HOST_SCOPE"] != source["HOST_SCOPE"])
        for target in nearest:
            destination = target["configuration"]
            entry["suggestions"].append({
                "target_id": target["id"],
                "changes": [{"field": field, "from": source[field], "to": destination[field]}
                            for field in AXES if source[field] != destination[field]],
                "distance": minimum,
            })

    return {
        "schema": SCHEMA,
        "draft_schema": DRAFT_SCHEMA,
        "signature_status": "UNSIGNED",
        "unsigned": True,
        "axes": deepcopy(AXES),
        "rules": deepcopy(RULES),
        "alignment": alignment,
        "provenance": {
            "rules_version": RULES_VERSION,
            "rules_sha256": digest(RULES),
            "axes_sha256": digest(AXES),
            "rules_source": "references/rules.json",
            "axes_source": "references/axes.json",
            "label": "Règles extraites des HTML ; comparaison structurelle épinglée, revue statique des contrats.",
            "external_catalogue": alignment["structural"]["status"],
            "invariants": "STATIC_REVIEW_PARTIAL_SCOPE" if alignment["runtime_review"] else "NOT_ASSESSED",
            "invariant_references": ["references/reg-specification-guide.pdf", "references/tenir-gov-operationalization-guide.pdf"],
            "alignment_target": {"runtime": "TENIR-Gov", "version": "5.7",
                                 "status": "BASE_CONFIRMED_PROMOTION_PLANNED", "base_version": "5.6.1",
                                 "base_commit": "41fae550c1e0a3632e2bde473db6d31b450d4269",
                                 "execution_compatibility": "NOT_VERIFIED",
                                 "source_manifest": "references/architecture-sources.json"},
        },
        "configurations": entries,
        "statistics": {"total": len(entries), "admissible": len(admissible),
                       "rejected": len(entries) - len(admissible)},
        "runtime_configuration": deepcopy(runtime_configuration),
        "demo": {
            "available": verified_runtime,
            "status": "VERIFIED_LOCAL_DEMO" if verified_runtime else "UNAVAILABLE",
            "report_href": "report.html" if verified_runtime else None,
            "configuration_id": configuration_id(runtime_configuration),
            "instructions": ("Ouvrir le rapport pour examiner les quatre parcours et leurs preuves vérifiées."
                             if verified_runtime else
                             "Produire et vérifier le dossier local avec .\\run.ps1 all, puis ouvrir le configurateur généré."),
            "verification": _verification_summary(verification) if verified_runtime else None,
            "operation_ids": list(bundle.get("operations", {})) if verified_runtime else [],
            "loop_stage_ids": list(STAGE_IDS),
        },
    }
