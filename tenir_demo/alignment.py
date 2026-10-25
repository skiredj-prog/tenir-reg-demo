"""Offline source integrity and structural comparison; never import upstream code.

The YAML operands are a reviewed, hash-bound normalization, not a YAML parser or
an execution-compatibility test. Catalogue outcomes are recomputed on every call.
"""
from copy import deepcopy
import hashlib
import itertools
import json
from pathlib import Path, PurePosixPath
import re


SCHEMA = "demo-reference-alignment/v1"
AXIS_ORDER = ("HOST_SCOPE", "DEDUP_LAYER", "CONCURRENCY", "UNCERTAINTY")
CLAUSE_IDS = ("R1a", "R1b", "R1c", "R2a", "R2b", "R2c", "R3a")
PINS = (
    ("reg", "skiredj-prog/reg-conformance", "cd5ab1b616ad59014f4b84d522b57a890a48a088"),
    ("tenir", "skiredj-prog/tenir_governance", "47ef67e3efc5f3008896a7d88bebf929fa0a98f0"),
    ("harness", "skiredj-prog/tenir-conformance-s1-g1", "d29400100b00f7e7a87d229af660f62e51d61f12"),
)
HASH = re.compile(r"[0-9a-f]{64}\Z")


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _alias(value, *keys, default=None):
    found = [value[key] for key in keys if key in value]
    _require(not found or all(item == found[0] for item in found), "Conflicting source metadata aliases")
    return found[0] if found else default


def _loads(content):
    def pairs(items):
        result = {}
        for key, value in items:
            _require(key not in result, "Duplicate JSON key")
            result[key] = value
        return result

    def constant(_value):
        raise ValueError("Non-finite JSON number")
    return json.loads(content, object_pairs_hook=pairs, parse_constant=constant)


def _relative_path(root, value, flat_reference=False):
    _require(isinstance(value, str) and value and "\\" not in value,
             "Invalid relative source path")
    path = PurePosixPath(value)
    _require(bool(path.parts) and not path.is_absolute() and str(path) == value
             and all(part not in (".", "..") and ":" not in part for part in path.parts),
             "Source path must stay within the workspace")
    if flat_reference:
        _require(len(path.parts) == 2 and path.parts[0] == "references",
                 "Source copies must be flat files in references")
    candidate = (root / value).resolve()
    _require(candidate.is_relative_to(root), "Source path escapes the workspace")
    if flat_reference:
        _require(candidate.parent == (root / "references").resolve(),
                 "Source copy escapes references")
    _require(candidate.is_file(), "Source file is missing: " + value)
    return candidate


def _json(root, value):
    return _loads(_relative_path(root, value, True).read_text(encoding="utf-8"))


def _remote_path(value):
    _require(isinstance(value, str) and value and "\\" not in value,
             "Invalid repository source path")
    path = PurePosixPath(value)
    _require(bool(path.parts) and not path.is_absolute() and str(path) == value
             and all(part not in (".", "..") and ":" not in part for part in path.parts),
             "Invalid repository source path")
    return value


def _entry(entry, repository, commit):
    _require(isinstance(entry, dict), "Invalid manifest entry")
    _require(entry.get("repository", repository) == repository,
             "Manifest entry repository differs from its pin")
    _require(_alias(entry, "pinned_commit", "commit", default=commit) == commit,
             "Manifest entry commit differs from its pin")
    path = _remote_path(_alias(entry, "path", "source_path"))
    local_copy = _alias(entry, "local_copy", "local_path")
    sha = entry.get("sha256")
    size = _alias(entry, "bytes", "size_bytes")
    _require(isinstance(sha, str) and HASH.fullmatch(sha), "Invalid source SHA-256")
    _require(type(size) is int and size >= 0, "Invalid source byte count")
    url = _alias(entry, "canonical_blob_url", "url")
    _require(url == f"https://github.com/{repository}/blob/{commit}/{path}",
             "Source URL does not identify the pinned blob")
    blob = _alias(entry, "git_blob_sha", "github_blob_sha", "git_blob_sha1")
    _require(isinstance(blob, str) and re.fullmatch(r"[0-9a-f]{40}", blob),
             "Source Git blob identity is missing or invalid")
    return {"repository": repository, "pinned_commit": commit, "path": path,
            "local_copy": local_copy, "sha256": sha, "bytes": size,
            "canonical_blob_url": url,
            "git_blob_sha": blob}


def _manifest(root, name, repository, commit):
    relative = f"references/upstream-{name}-manifest.json"
    data = _json(root, relative)
    schemas = {"demo-upstream-source-manifest/v1"}
    if name == "tenir":
        schemas.add("upstream-source-manifest/v1")
    _require(isinstance(data, dict) and data.get("schema") in schemas,
             "Unsupported source manifest")
    _require(data.get("repository") == repository
             and _alias(data, "pinned_commit", "commit") == commit,
             "Manifest repository or commit differs from the selected reference")
    if "remote_code_executed" in data:
        _require(data["remote_code_executed"] is False, "Manifest claims upstream execution")
    files = data.get("files")
    _require(isinstance(files, list) and files, "Source manifest has no files")
    by_path, by_copy = {}, {}
    for raw in files:
        item = _entry(raw, repository, commit)
        _require(item["path"] not in by_path and item["local_copy"] not in by_copy,
                 "Duplicate source path or copy in manifest")
        path = _relative_path(root, item["local_copy"], True)
        _require(path.name.startswith(f"upstream-{name}-"), "Source copy belongs to a different manifest")
        content = path.read_bytes()
        _require(len(content) == item["bytes"], "Source byte count differs: " + item["local_copy"])
        _require(hashlib.sha256(content).hexdigest() == item["sha256"],
                 "Source SHA-256 differs: " + item["local_copy"])
        if item["git_blob_sha"] is not None:
            expected = hashlib.sha1(b"blob " + str(len(content)).encode("ascii") + b"\0" + content).hexdigest()
            _require(item["git_blob_sha"] == expected, "Source Git blob hash differs: " + item["local_copy"])
        by_path[item["path"]] = item
        by_copy[item["local_copy"]] = item
    tree = data.get("tree_snapshot")
    if tree is not None:
        _require(isinstance(tree, dict), "Invalid tree snapshot")
        path = _relative_path(root, tree.get("local_copy"), True)
        _require(hashlib.sha256(path.read_bytes()).hexdigest() == tree.get("sha256"),
                 "Tree snapshot SHA-256 differs")
        _require(tree.get("canonical_api_url") == f"https://api.github.com/repos/{repository}/git/trees/{commit}?recursive=1",
                 "Tree snapshot does not identify the pinned tree")
        tree_data = _loads(path.read_text(encoding="utf-8"))
        _require(tree.get("truncated") is False and tree_data.get("truncated") is False,
                 "Tree snapshot is truncated")
        tree_files = {item["path"]: item for item in tree_data.get("tree", []) if item.get("type") == "blob"}
        for item in by_path.values():
            upstream = tree_files.get(item["path"], {})
            _require(upstream.get("sha") == item["git_blob_sha"] and upstream.get("size") == item["bytes"],
                     "Manifest entry differs from the pinned tree")
    return {"data": data, "files": list(by_path.values()), "by_path": by_path,
            "by_copy": by_copy, "manifest": relative, "repository": repository,
            "pinned_commit": commit}


def _anchor(root, node, manifest):
    start = _alias(node, "start_line", "line_start", "line")
    end = _alias(node, "end_line", "line_end", default=start)
    _require(type(start) is int and type(end) is int and 1 <= start <= end,
             "Invalid review source line range")
    local = _alias(node, "local_copy", "local_path")
    remote = _alias(node, "repository_path", "path")
    entry = manifest["by_copy"].get(local) if isinstance(local, str) else None
    if entry is None and remote in manifest["by_path"]:
        entry = manifest["by_path"][remote]
        _require(local in (None, entry["local_copy"]), "Review source copy does not match its repository path")
        local = entry["local_copy"]
    if entry is not None:
        _require(remote in (None, entry["path"]), "Review anchor repository path differs from manifest")
        local = entry["local_copy"]
    elif local is None:
        local = remote
    _require((isinstance(local, str) and not local.startswith("references/upstream-")) or entry is not None,
             "Review anchor references an unmanifested upstream copy")
    path = _relative_path(root, local, bool(entry))
    _require(end <= len(path.read_text(encoding="utf-8").splitlines()),
             "Review source line range exceeds the file: " + local)
    if "sha256" in node:
        _require(hashlib.sha256(path.read_bytes()).hexdigest() == node["sha256"],
                 "Review source SHA-256 differs: " + local)
    url = _alias(node, "url", "canonical_url", "canonical_blob_url")
    if url is not None:
        _require(entry is not None, "A local review anchor must not claim an upstream URL")
        base = entry["canonical_blob_url"]
        _require(url in (base + f"#L{start}-L{end}", base + f"#L{start}" if start == end else ""),
                 "Review source URL does not match its pinned line range")


def _review(root, name, manifest):
    data = _json(root, f"references/upstream-{name}-review.json")
    schemas = {"reg": {"demo-upstream-reg-review/v1"},
               "tenir": {"demo-upstream-tenir-review/v1", "upstream-tenir-review/v1"},
               "harness": {"demo-upstream-harness-review/v1"}}[name]
    _require(isinstance(data, dict) and data.get("schema") in schemas, "Unsupported review schema")
    _require(data.get("repository") == manifest["repository"]
             and _alias(data, "pinned_commit", "commit") == manifest["pinned_commit"],
             "Review repository or commit differs from its manifest")
    for field in ("remote_code_executed", "upstream_code_executed"):
        if field in data:
            _require(data[field] is False, "Review claims upstream execution")
    if "execution_compatibility" in data:
        _require(data["execution_compatibility"] == "NOT_VERIFIED", "Review claims execution compatibility")
    if name == "harness":
        _require(data.get("conformance_status") == "NOT_EVALUATED"
                 and data.get("production_status") == "NOT_EVALUATED", "Static review claims conformance")
        flags = data.get("support_flags")
        _require(isinstance(flags, dict) and all(value is False for value in flags.values()),
                 "Static harness review claims a demonstrated capability")
    if "source_manifest" in data:
        _require(data["source_manifest"] == manifest["manifest"], "Review names a different source manifest")

    def bilingual(value):
        _require(isinstance(value, dict) and all(isinstance(value.get(lang), str) and value[lang]
                 for lang in ("fr", "en")), "Review text must be bilingual")

    def identified_rows(key, expected):
        rows = data.get(key)
        _require(isinstance(rows, list) and all(isinstance(row, dict) for row in rows),
                 "Review rows are missing or invalid: " + key)
        ids = [row.get("id") for row in rows]
        _require(all(isinstance(identity, str) for identity in ids) and len(ids) == len(set(ids))
                 and set(ids) == expected, "Review rows are incomplete or duplicated: " + key)
        return rows

    if name == "tenir":
        for row in identified_rows("invariants", {f"I{number}" for number in range(1, 10)}):
            _require(row.get("status") in {"LOCAL_SUBSET", "NOT_IMPLEMENTED", "NOT_ASSESSED"},
                     "Static invariant review claims an unsupported status")
            _require(isinstance(row.get("reference_label"), str) and isinstance(row.get("reference_source"), dict),
                     "Invariant review is missing its definition or source")
            _require(isinstance(row.get("local_test_ids"), list) and all(
                isinstance(identity, str) and re.fullmatch(r"T(?:0[1-9]|10)", identity)
                for identity in row["local_test_ids"]), "Invariant cites an unknown local test")
            bilingual(row.get("notes"))
        contract_ids = {"VERSION_AND_AUTHORITY", "OBSERVATION_AND_EVALUATION_INPUTS", "DECISION_VOCABULARY",
                        "IDENTITY_AND_LIFECYCLE", "BUDGET_ACCOUNTING_PHASES", "PROVIDER_AND_RECONCILIATION",
                        "EVIDENCE_AND_CANONICAL_EXPORT"}
        for row in identified_rows("contracts", contract_ids):
            _require(row.get("comparison_status") in {"LOCAL_SUBSET", "DIFFERENT_CONTRACT"},
                     "Contract review claims an unsupported status")
            bilingual(row.get("title"))
            bilingual(row.get("description"))
            _require(isinstance(row.get("reference_sources"), list) and row["reference_sources"],
                     "Contract review has no reference sources")
        for row in identified_rows("source_inconsistencies", {"GUIDE_INVARIANT_NUMBER_DRIFT", "MANUSCRIPT_HMAC_VS_COMPOSITION_LEDGER"}):
            bilingual(row.get("description"))
            _require(isinstance(row.get("sources"), list) and row["sources"], "Source inconsistency has no anchors")
    elif name == "harness":
        for row in identified_rows("scenarios", {"autorisation", "blocage", "attente", "issue-inconnue"}):
            _require(row.get("status") in {"PARTIAL_BEHAVIORAL_ANALOGY", "HOLD_DISPOSITION_ONLY", "DIFFERENT_RETURN_CONTRACT"},
                     "Scenario review claims an unsupported status")
            bilingual(row.get("finding"))
            _require(isinstance(row.get("sources"), list) and row["sources"], "Scenario review has no sources")
    else:
        findings = data.get("findings")
        _require(isinstance(findings, list), "REG findings are missing")
        for finding in findings:
            _require(isinstance(finding, dict) and finding.get("basis") in {"REVIEWED_SOURCE", "COMPUTED_LOCAL_COMPARISON"},
                     "REG finding basis is invalid")
            bilingual(finding.get("summary"))
    basis = data.get("source_basis", [])
    _require(isinstance(basis, list), "Invalid review source basis")
    seen = set()
    for raw in basis:
        item = _entry(raw, manifest["repository"], manifest["pinned_commit"])
        _require(item["path"] not in seen, "Duplicate review source basis")
        seen.add(item["path"])
        _require(item == manifest["by_path"].get(item["path"]), "Review source basis differs from the manifest")
    if name == "reg":
        _require({"catalog/hypotheses-v1.yaml", "catalog/compatibility-rules-v1.yaml",
                  "catalog/valid-configurations-v1.json", "catalog/capabilities-v1.yaml"} <= seen,
                 "REG review is missing its structural source basis")
    local_inputs = data.get("local_inputs", [])
    _require(isinstance(local_inputs, list), "Invalid review local inputs")
    seen = set()
    for item in local_inputs:
        _require(isinstance(item, dict) and item.get("path") not in seen, "Duplicate or invalid review local input")
        seen.add(item["path"])
        path = _relative_path(root, item.get("path"))
        _require(hashlib.sha256(path.read_bytes()).hexdigest() == item.get("sha256"),
                 "Review local input SHA-256 differs: " + item["path"])
    if name == "reg":
        _require({"references/axes.json", "references/rules.json"} <= seen,
                 "REG review is missing its local input hashes")

    def walk(value):
        if isinstance(value, dict):
            if any(key in value for key in ("start_line", "line_start", "line")) and any(
                    key in value for key in ("path", "repository_path", "local_copy", "local_path")):
                _anchor(root, value, manifest)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(data)
    return data


def _axes(value):
    _require(isinstance(value, dict) and set(value) == set(AXIS_ORDER), "Unknown or missing structural axis")
    for values in value.values():
        _require(isinstance(values, list) and values and all(isinstance(item, str) and item for item in values)
                 and len(set(values)) == len(values), "Invalid or duplicate axis values")
    return {name: list(value[name]) for name in AXIS_ORDER}


def _rules(value, axes, local=False):
    _require(isinstance(value, list), "Invalid structural rules")
    output = {}
    for item in value:
        _require(isinstance(item, dict), "Invalid clause")
        identity = item.get("clause_id")
        _require(identity in CLAUSE_IDS and identity not in output, "Unknown or duplicate structural clause")
        condition = {"field": item.get("cf"), "value": item.get("cv")} if local else item.get("condition")
        requirement = {"field": item.get("rf"), "allowed_values": item.get("av")} if local else item.get("requires")
        _require(isinstance(condition, dict) and isinstance(requirement, dict), "Invalid clause operands")
        field, value = condition.get("field"), condition.get("value")
        target, allowed = requirement.get("field"), requirement.get("allowed_values")
        _require(field in axes and target in axes and value in axes[field], "Clause references an unknown axis or value")
        _require(isinstance(allowed, list) and allowed and all(isinstance(v, str) and v in axes[target] for v in allowed)
                 and len(set(allowed)) == len(allowed), "Clause requires unknown or duplicate values")
        family = item.get("rule_id")
        _require(isinstance(family, str) and family, "Clause family is missing")
        description = item.get("desc") if local else item.get("description")
        _require(isinstance(description, str), "Clause description is missing")
        output[identity] = {"rule_id": family, "condition": {"field": field, "value": value},
                            "requires": {"field": target, "allowed_values": sorted(allowed)},
                            "description": description}
    if not local:
        _require(set(output) == set(CLAUSE_IDS), "Reviewed normalization must contain all seven clauses")
    return output


def _violated(config, rule):
    return (config[rule["condition"]["field"]] == rule["condition"]["value"]
            and config[rule["requires"]["field"]] not in rule["requires"]["allowed_values"])


def _compare(root, review, manifest):
    reviewed_axes = _axes(review.get("derived_axes"))
    local_axes = _axes(_json(root, "references/axes.json"))
    reviewed_rules = _rules(review.get("normalized_rules"), reviewed_axes)
    local_rules = _rules(_json(root, "references/rules.json"), local_axes, True)
    source = manifest["by_path"].get("catalog/valid-configurations-v1.json")
    _require(source is not None, "Pinned structural catalogue is missing")
    catalogue = _json(root, source["local_copy"])
    _require(isinstance(catalogue, dict) and catalogue.get("catalog_version") == "1.0.0"
             and catalogue.get("rules_version") == "1.0.0", "Unsupported pinned catalogue version")
    rows = catalogue.get("configurations")
    _require(isinstance(rows, list), "Catalogue configurations are missing")
    expected_keys = set(itertools.product(*(reviewed_axes[name] for name in AXIS_ORDER)))
    _require(len(expected_keys) == 144, "Reviewed structural domain is not the pinned 144 configurations")
    entries = {}
    for row in rows:
        _require(isinstance(row, dict), "Invalid catalogue row")
        config = row.get("config")
        _require(isinstance(config, dict) and set(config) == set(AXIS_ORDER), "Catalogue row has unknown or missing axes")
        _require(all(isinstance(config[name], str) and config[name] in reviewed_axes[name] for name in AXIS_ORDER),
                 "Catalogue row contains an unknown axis value")
        key = tuple(config[name] for name in AXIS_ORDER)
        _require(key not in entries, "Duplicate catalogue configuration")
        _require(type(row.get("admissible_structural")) is bool, "Catalogue admissibility is not boolean")
        _require("effective_guarantee_demonstrated" in row and row["effective_guarantee_demonstrated"] is None,
                 "Catalogue must keep effective guarantees unassessed")
        raw_violations = row.get("violations")
        _require(isinstance(raw_violations, list), "Catalogue violations are missing")
        found = {}
        for violation in raw_violations:
            _require(isinstance(violation, dict), "Invalid catalogue violation")
            identity = violation.get("clause_id")
            _require(identity in reviewed_rules and identity not in found, "Unknown or duplicate catalogue clause")
            _require(isinstance(violation.get("rule_id"), str), "Catalogue violation family is missing")
            found[identity] = violation["rule_id"]
        entries[key] = (row, found)
    _require(set(entries) == expected_keys, "Catalogue is missing structural configurations")
    mismatches = []
    axes_match = all(set(local_axes[name]) == set(reviewed_axes[name]) for name in AXIS_ORDER)
    semantic = lambda rules: {key: {field: value for field, value in rule.items() if field != "description"}
                              for key, rule in rules.items()}
    rules_match = semantic(local_rules) == semantic(reviewed_rules)
    if not axes_match:
        mismatches.append({"kind": "AXES", "local": local_axes, "reviewed": reviewed_axes})
    if not rules_match:
        mismatches.append({"kind": "RULE_OPERANDS_OR_IDS", "local": semantic(local_rules),
                           "reviewed": semantic(reviewed_rules)})
    count = 0
    admissible = rejected = 0
    host_counts, uncertainty_counts = {}, {}
    for key in itertools.product(*(reviewed_axes[name] for name in AXIS_ORDER)):
        row, found = entries[key]
        config = row["config"]
        local_valid_input = all(config[name] in local_axes[name] for name in AXIS_ORDER)
        local_violations = {identity for identity, rule in local_rules.items() if _violated(config, rule)}
        upstream_violations = set(found)
        local_admissible = local_valid_input and not local_violations
        if local_admissible:
            admissible += 1
            host_counts[config["HOST_SCOPE"]] = host_counts.get(config["HOST_SCOPE"], 0) + 1
            uncertainty_counts[config["UNCERTAINTY"]] = uncertainty_counts.get(config["UNCERTAINTY"], 0) + 1
        else:
            rejected += 1
        if local_admissible != row["admissible_structural"] or row["admissible_structural"] != (not upstream_violations):
            mismatches.append({"kind": "ADMISSIBILITY", "configuration": deepcopy(config),
                               "local": local_admissible, "catalogue": row["admissible_structural"]})
        for identity in CLAUSE_IDS:
            count += 1
            actual = identity in local_violations
            listed = identity in upstream_violations
            reviewed = _violated(config, reviewed_rules[identity])
            if actual != listed or reviewed != listed:
                mismatches.append({"kind": "CLAUSE_OUTCOME", "configuration": deepcopy(config),
                                   "clause_id": identity, "local_violated": actual,
                                   "catalogue_violated": listed, "reviewed_violated": reviewed})
            if listed and found[identity] != reviewed_rules[identity]["rule_id"]:
                mismatches.append({"kind": "CLAUSE_FAMILY", "configuration": deepcopy(config), "clause_id": identity})
    return {"status": "STRUCTURAL_DIFFERENCE" if mismatches else "STRUCTURAL_MATCH",
            "configurations_compared": len(entries), "clause_results_compared": count,
            "admissible": admissible, "rejected": rejected, "mismatches": mismatches, "errors": [],
            "axes_match": axes_match, "rules_match": rules_match,
            "rule_descriptions_match": local_rules == reviewed_rules,
            "axes_order_match": local_axes == reviewed_axes,
            "catalogue_version": catalogue["catalog_version"], "rules_version": catalogue["rules_version"],
            "rule_operand_basis": "REVIEWED_HASH_BOUND_NORMALIZATION",
            "outcome_method": "RECOMPUTED_OFFLINE_FROM_LOCAL_RULES_AND_PINNED_JSON",
            "effective_guarantees": "NOT_ASSESSED",
            "admissible_by_host_scope": host_counts, "admissible_by_uncertainty": uncertainty_counts}


def build_alignment(root=None):
    """Return fail-closed diagnostics from saved sources, with no side effects."""
    root = Path(root).resolve() if root is not None else Path(__file__).resolve().parent.parent
    structural = {"status": "SOURCE_INVALID", "configurations_compared": 0, "clause_results_compared": 0,
                  "admissible": 0, "rejected": 0, "mismatches": [], "errors": [],
                  "axes_match": None, "rules_match": None}
    result = {"schema": SCHEMA, "structural": structural, "sources": [],
              "execution_compatibility": "NOT_VERIFIED", "full_conformance": "NOT_DEMONSTRATED",
              "remote_code_executed": False, "remote_repositories_modified": False,
              "reg_review": {}, "runtime_review": {}, "harness_review": {}}
    manifests, reviews, errors = {}, {}, []
    for name, repository, commit in PINS:
        summary = {"repository": repository, "pinned_commit": commit,
                   "manifest": f"references/upstream-{name}-manifest.json", "file_count": 0,
                   "files_count": 0, "integrity_status": "INVALID", "errors": []}
        try:
            manifest = _manifest(root, name, repository, commit)
            manifests[name] = manifest
            summary.update(file_count=len(manifest["files"]), files_count=len(manifest["files"]), integrity_status="VALID")
            summary["files"] = deepcopy(manifest["files"])
            reviews[name] = _review(root, name, manifest)
            summary["review_status"] = "VALIDATED_STATIC_REVIEW"
        except (ValueError, OSError, TypeError, KeyError, IndexError, RuntimeError, OverflowError) as error:
            message = name + ": " + str(error)
            errors.append(message)
            summary["errors"].append(message)
            summary["review_status"] = "INVALID"
        result["sources"].append(summary)
    if not errors:
        try:
            result["structural"] = _compare(root, reviews["reg"], manifests["reg"])
        except (ValueError, OSError, TypeError, KeyError, IndexError, RuntimeError, OverflowError) as error:
            errors.append("structural: " + str(error))
    if errors:
        result["structural"] = structural
        structural["errors"] = errors
    else:
        result.update(reg_review=deepcopy(reviews["reg"]), runtime_review=deepcopy(reviews["tenir"]),
                      harness_review=deepcopy(reviews["harness"]))
    result["source_integrity"] = "INVALID" if errors else "VALID"
    result["status"] = result["structural"]["status"]
    return result
