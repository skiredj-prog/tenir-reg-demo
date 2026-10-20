"""Static bilingual explanation of the offline reference diagnostic."""
from html import escape


def _text(fr, en, tag="span"):
    return f'<{tag} data-fr="{escape(str(fr), quote=True)}" data-en="{escape(str(en), quote=True)}">{escape(str(fr))}</{tag}>'


def _bilingual(value, tag="p"):
    return _text(value.get("fr", ""), value.get("en", ""), tag)


def _sources(sources):
    links = []
    for source in sources:
        url = source.get("canonical_url") or source.get("url")
        if not url or not url.startswith("https://github.com/skiredj-prog/"):
            continue
        path = source.get("path") or source.get("repository_path", "Source")
        start = source.get("line_start", source.get("start_line"))
        label = f'{path}:L{start}' if start else path
        links.append(f'<a href="{escape(url, quote=True)}">{escape(label)} ↗</a>')
    return '<p class="alignment-sources">' + " · ".join(links) + '</p>' if links else ""


def render_alignment(model):
    """Explanations are documentary; never part of a signed event payload."""
    structural = model["structural"]
    if structural["status"] == "SOURCE_INVALID":
        import json
        return ('<section id="reference-alignment" class="reference-alignment" aria-labelledby="alignment-heading"'
                ' data-structural-status="SOURCE_INVALID" data-execution-compatibility="NOT_VERIFIED"'
                ' data-full-conformance="NOT_DEMONSTRATED">' +
                _text("Diagnostic indisponible", "Diagnostic unavailable", "h2").replace('<h2 ', '<h2 id="alignment-heading" ') +
                _text("Les sources ou la revue ont échoué au contrôle d'intégrité. Aucun résultat positif d'alignement n'est affiché. Restaurez les fichiers indiqués depuis leur commit épinglé, puis régénérez le dossier.",
                      "Source or review integrity checks failed. No positive alignment result is shown. Restore the listed files from their pinned commit, then regenerate the dossier.", "p") +
                '<pre>' + escape(json.dumps(structural.get("errors", []), ensure_ascii=False, indent=2)) + '</pre>' +
                '<a href="../REFERENCE_ALIGNMENT.md">' + _text("Sources et méthode", "Sources and method") + '</a></section>')
    match = structural["status"] == "STRUCTURAL_MATCH"
    summary = (_text("Structure concordante · exécution non vérifiée", "Matching structure · execution unverified") if match else
               _text("Alignement à examiner · exécution non vérifiée", "Alignment needs review · execution unverified"))
    result = (_text(f'{structural["configurations_compared"]} configurations et {structural["clause_results_compared"]} résultats de clause concordants.',
                    f'{structural["configurations_compared"]} configurations and {structural["clause_results_compared"]} matching clause outcomes.', "p") if match else
              _text("La comparaison ne permet pas de conclure à une concordance structurelle. Consultez les écarts et les sources ci-dessous.",
                    "The comparison cannot establish a structural match. Inspect the differences and sources below.", "p"))
    parts = ['<section id="reference-alignment" class="reference-alignment" aria-labelledby="alignment-heading"'
             f' data-structural-status="{escape(structural["status"], quote=True)}"'
             f' data-execution-compatibility="{escape(model["execution_compatibility"], quote=True)}"'
             f' data-full-conformance="{escape(model["full_conformance"], quote=True)}">',
             _text("BASE 5.6.1 → CIBLE 5.7", "5.6.1 BASE → 5.7 TARGET", "p").replace('<p ', '<p class="eyebrow" '),
             _text("Où en est l'alignement ?", "Where does alignment stand?", "h2").replace('<h2 ', '<h2 id="alignment-heading" '),
             '<p class="alignment-status">' + summary + '</p>', result,
             _text("Comparaison locale avec trois commits épinglés. Le catalogue est comparé automatiquement ; les contrats et invariants font l'objet d'une revue statique. Aucun code amont exécuté.",
                   "Local comparison against three pinned commits. The catalogue is compared automatically; contracts and invariants receive static source review. No upstream code executed.", "p"),
             '<details><summary>' + _text("Voir les écarts, invariants et sources", "Inspect differences, invariants and sources") + '</summary>',
             '<div class="alignment-detail">',
             _text("Contrats d'exécution : adaptations nécessaires", "Execution contracts: adaptations required", "h3"),
             _text("Les preuves locales conservent leur sens actuel. La concordance du catalogue ne valide ni le runtime de référence ni la conformité S1.",
                   "Local evidence retains its current meaning. Catalogue agreement validates neither the reference runtime nor S1 conformance.", "p")]
    runtime = model.get("runtime_review") or {}
    for contract in runtime.get("contracts", []):
        parts += ['<article class="alignment-item">', _bilingual(contract["title"], "h4"),
                  _bilingual(contract["description"]), _sources(contract.get("reference_sources", [])), '</article>']
    parts += ['<details><summary>' + _text("Lire les neuf invariants", "Read the nine invariants") + '</summary>',
              _text("Les tests cités vérifient le prototype. Ils n'exécutent pas les gardes de référence.",
                    "Cited tests check the prototype. They do not execute reference guards.", "p")]
    statuses = {"LOCAL_SUBSET": ("Sous-ensemble local", "Local subset"),
                "NOT_IMPLEMENTED": ("Non implémenté", "Not implemented"),
                "NOT_ASSESSED": ("Non évalué dans cette revue", "Not assessed in this review")}
    invariant_names = {"I1": "Effet au plus une fois, sous hypothèses", "I2": "Définition à préciser dans ce périmètre",
                       "I3": "Terminalité d'une tentative", "I4": "Effets par dispatch autorisé",
                       "I5": "Définition à préciser dans ce périmètre", "I6": "Admission sous quarantaine",
                       "I7": "Intégrité de délégation", "I8": "Budget agrégé", "I9": "Cohérence temporelle de trajectoire"}
    for invariant in runtime.get("invariants", []):
        status = statuses.get(invariant["status"], ("À examiner", "Needs review"))
        parts += ['<article class="alignment-item"><h4>' + escape(invariant["id"]) + ' · ' +
                  _text(invariant_names[invariant["id"]], invariant["reference_label"]) + '</h4><p>' + _text(*status) + '</p>',
                  _bilingual(invariant["notes"]), _sources([invariant["reference_source"]])]
        if invariant.get("local_test_ids"):
            parts += ['<p>' + _text("Tests locaux : ", "Local tests: ") + '<code>' + escape(", ".join(invariant["local_test_ids"])) + '</code></p>']
        parts += ['</article>']
    parts += ['</details>', '<details><summary>' + _text("Comparer les quatre parcours au harnais", "Compare the four scenarios with the harness") + '</summary>']
    for scenario in (model.get("harness_review") or {}).get("scenarios", []):
        parts += ['<article class="alignment-item"><h4>' + escape(scenario["id"]) + '</h4>',
                  _bilingual(scenario["finding"]), _sources(scenario.get("sources", [])), '</article>']
    parts += ['</details>', '<details><summary>' + _text("Examiner les limites du catalogue et les incohérences documentaires", "Inspect catalogue boundaries and documentation inconsistencies") + '</summary>']
    for finding in (model.get("reg_review") or {}).get("findings", []):
        # Review seeds distinguish source observations from development-time calculations.
        if finding.get("basis") == "COMPUTED_LOCAL_COMPARISON":
            continue
        wording = finding.get("summary") or finding.get("description") or finding.get("message") or finding
        if "fr" in wording and "en" in wording:
            parts += [_bilingual(wording)]
    for inconsistency in runtime.get("source_inconsistencies", []):
        parts += ['<article class="alignment-item">', _bilingual(inconsistency["description"]),
                  _sources(inconsistency.get("sources", [])), '</article>']
    parts += ['</details>', _text("Traçabilité des sources", "Source traceability", "h3"), '<ul class="alignment-pins">']
    for source in model.get("sources", []):
        repository, commit = source["repository"], source["pinned_commit"]
        url = f'https://github.com/{repository}/tree/{commit}'
        parts += ['<li><a href="' + escape(url, quote=True) + '">' + escape(repository) + '</a> · <code>' + escape(commit) + '</code></li>']
    parts += ['</ul>']
    if structural.get("errors") or structural.get("mismatches"):
        import json
        parts += ['<pre>' + escape(json.dumps({"errors": structural.get("errors", []), "mismatches": structural.get("mismatches", [])}, ensure_ascii=False, indent=2)) + '</pre>']
    parts += ['<p><a href="../REFERENCE_ALIGNMENT.md">' + _text("Diagnostic détaillé et prochaine étape →", "Detailed diagnostic and next step →") + '</a></p>',
              _text("Prochaine étape : définir un contrat d'adaptation versionné, puis tester le runtime épinglé avec une identité d'exécution vérifiée.",
                    "Next: define a versioned adaptation contract, then test the pinned runtime with verified execution identity.", "p"), '</div></details></section>']
    return "\n".join(parts)
