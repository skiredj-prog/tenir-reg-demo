"""Libellés d'interface ; aucune traduction des payloads signés."""
import html
import re

RULE_EN = {
    "R1a": "mono-process permits only a thread lock.",
    "R1b": "mono-host permits file-lock or distributed-transaction.",
    "R1c": "multi-host permits distributed-transaction or distributed-consensus.",
    "R2a": "Distributed consensus requires a multi-host topology.",
    "R2b": "The distributed deduplication registry requires multi-host.",
    "R2c": "The distributed deduplication registry requires distributed consensus.",
    "R3a": "A local registry cannot coordinate multiple hosts.",
}
TEST_EN = {
    "T01": "R1a–R3a clauses and multiple violations; internal test.",
    "T02": "Nominal budget, exact ceiling, invalid amounts and units.",
    "T03": "Budget exceeded or weakened hypothesis: no call or reservation.",
    "T04": "Missing, expired and invalid signals distinguished before dispatch.",
    "T05": "UNKNOWN preserves the reservation and verdict on replay.",
    "T06": "50 synchronized races: atomic ceiling enforcement.",
    "T07": "Duplicates, conflicts and duplicates during an in-flight dispatch.",
    "T08": "Same input, state, profile and time: reproducible decision.",
    "T09": "Signature, tampering, wrong key, JSON order and truncated chain.",
    "T10": "Four scenarios: report, evidence, calls and budget agree.",
}
CONFIG_TEXT_EN = {
    "TENIR/REG — Configurateur explicable": "TENIR/REG — Explainable configurator",
    "Aller au configurateur": "Skip to configurator",
    "Configurateur": "Configurator", "Démonstration & preuves": "Demo & evidence", "Atelier local": "Local workspace",
    "Configuration": "Configuration", "Nouveau parcours": "New configuration",
    "DE LA CONFIGURATION À LA PREUVE": "FROM CONFIGURATION TO EVIDENCE",
    "Choisir un périmètre.": "Choose a scope.", "Comprendre chaque règle.": "Understand every rule.",
    "Quatre choix pour explorer votre architecture. Chaque incompatibilité est expliquée, chaque correction proposée est vérifiée.": "Explore your architecture through four choices. Every incompatibility is explained, every suggested correction is checked.",
    "configurations explorées": "configurations explored", "42 admissibles": "42 admissible", "102 à corriger": "102 to correct",
    "Selon les règles internes extraites": "Based on the extracted internal rules",
    "Règles & périmètre": "Rules & scope", "Démonstration": "Demo", "Preuves": "Evidence",
    "VOTRE CONFIGURATION": "YOUR CONFIGURATION", "Un choix à la fois": "One choice at a time", "Réinitialiser": "Reset",
    "Périmètre": "Scope", "Déduplication": "Deduplication", "Concurrence": "Concurrency", "Incertitude": "Uncertainty",
    "Périmètre d'exécution": "Execution scope",
    "Le nombre de processus et d'hôtes détermine les mécanismes de coordination nécessaires.": "The number of processes and hosts determines the coordination mechanisms needed.",
    "Un seul processus · mono-process": "One process · mono-process",
    "Plusieurs processus, un hôte · mono-host": "Multiple processes, one host · mono-host",
    "Plusieurs hôtes · multi-host": "Multiple hosts · multi-host",
    "Un verrou de thread suffit uniquement à l'intérieur du processus qui le détient.": "A thread lock is only sufficient inside the process that holds it.",
    "Déduplication des opérations": "Operation deduplication",
    "Choisissez le mécanisme qui doit empêcher qu'une même opération soit envoyée plusieurs fois.": "Choose the mechanism intended to prevent the same operation from being sent more than once.",
    "Aucun mécanisme · none": "No mechanism · none", "Registre local · local-registry": "Local registry · local-registry",
    "Clé du fournisseur · provider-idempotency-key": "Provider key · provider-idempotency-key",
    "Registre distribué · distributed-consensus-registry": "Distributed registry · distributed-consensus-registry",
    "Le registre local du prototype protège les opérations du processus en cours.": "The prototype's local registry protects operations in the current process.",
    "Coordination des accès": "Access coordination",
    "Ce mécanisme protège le contrôle du budget et la réservation lorsque des demandes arrivent ensemble.": "This mechanism protects budget checks and reservations when requests arrive together.",
    "Verrou de thread · thread-lock": "Thread lock · thread-lock", "Verrou de fichier · file-lock": "File lock · file-lock",
    "Transaction distribuée · distributed-transaction": "Distributed transaction · distributed-transaction",
    "Consensus distribué · distributed-consensus": "Distributed consensus · distributed-consensus",
    "L'admissibilité d'un mécanisme ne démontre pas son implémentation dans votre système.": "A mechanism's admissibility does not demonstrate its implementation in your system.",
    "Politique d'incertitude": "Uncertainty policy",
    "Indiquez le comportement souhaité lorsque les observations indispensables ne permettent pas de décider.": "Choose the desired behavior when required observations do not support a decision.",
    "Bloquer dans le doute · fail-closed": "Block when uncertain · fail-closed", "Autoriser dans le doute · fail-open": "Allow when uncertain · fail-open",
    "Demander une intervention · human-escalation": "Request human review · human-escalation",
    "Cet axe ne modifie pas les sept clauses structurelles. Le runtime local implémente uniquement fail-closed.": "This axis does not change the seven structural clauses. The local runtime implements fail-closed only.",
    "← Précédent": "← Previous", "Continuer →": "Continue →", "Votre sélection, en un regard": "Your selection at a glance",
    "Cliquer pour modifier": "Click to edit", "Examiner les règles de cette sélection →": "Review the rules for this selection →",
    "Inspecter la configuration et son origine": "Inspect the configuration and its origin", "Configuration actuelle": "Current configuration",
    "Configuration avant la première correction": "Configuration before the first correction",
    "Capturée à l'application d'une suggestion et conservée jusqu'à la réinitialisation.": "Captured when a suggestion is applied and kept until you reset.",
    "LECTURE INSTANTANÉE": "LIVE ASSESSMENT", "Ce que les règles disent": "What the rules say", "VALIDITÉ STRUCTURELLE": "STRUCTURAL VALIDITY",
    "Corrections possibles": "Possible corrections",
    "Les propositions changent le moins de champs possible. Votre choix initial reste consultable.": "Suggestions change as few fields as possible. Your original choice remains available.",
    "Runtime local": "Local runtime", "Garanties démontrées": "Demonstrated guarantees",
    "Guides reçus · applicabilité non intégrée": "Guides received · applicability not integrated",
    "Retrouver la preuve": "Find the evidence", "Explorer la démonstration →": "Explore the demo →",
    "Ouvrir le rapport consulte des scénarios déjà exécutés. Aucun appel n'est déclenché par le configurateur.": "The report shows previously executed scenarios. The configurator does not dispatch any calls.",
    "Consulter les résultats de la recette.": "View the test results.", "↓ Exporter la configuration JSON": "↓ Export configuration JSON",
    "Brouillon non signé · aucune opération exécutée": "Unsigned draft · no operation executed",
    "02 · RÈGLES & PÉRIMÈTRE": "02 · RULES & SCOPE", "Les sept clauses, appliquées à votre sélection.": "All seven clauses, applied to your selection.",
    "Chaque statut vient de l'évaluateur structurel. Une clause non applicable n'est pas comptée comme une règle satisfaite.": "Every status comes from the structural evaluator. An inapplicable clause is not counted as satisfied.",
    "← Modifier la configuration": "← Edit configuration", "Résultats clause par clause": "Clause-by-clause results",
    "Satisfaite": "Satisfied", "Violée": "Violated", "Non applicable": "Not applicable",
    "PÉRIMÈTRE COURANT": "CURRENT SCOPE", "Votre architecture sélectionnée": "Your selected architecture", "Admissibilité": "Admissibility",
    "Cliquez sur un champ pour revenir directement au choix correspondant. Votre sélection et votre configuration avant correction sont conservées.": "Click a field to return directly to its control. Your current selection and pre-correction configuration are preserved.",
    "Les règles contrôlent les relations entre périmètre, déduplication et concurrence. L'axe UNCERTAINTY ne modifie pas ces sept clauses. La conformité au catalogue officiel reste non évaluée.": "The rules check relationships between scope, deduplication and concurrency. UNCERTAINTY does not change these seven clauses. Official catalogue compliance remains unevaluated.",
    "PÉRIMÈTRE DE CETTE LECTURE": "SCOPE OF THIS ASSESSMENT",
    "Des règles explicites,": "Explicit rules,", "une provenance visible.": "visible provenance.",
    "TENIR REG, configurateur local": "TENIR REG, local configurator", "Navigation principale": "Main navigation",
    "Parcours produit": "Product flow", "Étapes du configurateur": "Configurator steps", "Clauses violées": "Violated clauses",
    "Mise à jour à chaque sélection": "Updated with every selection",
    "Sept clauses R1a–R3a extraites des HTML fournis. Les guides et dépôts de référence ont été consultés ; leur mapping complet n'est pas intégré.": "Seven R1a–R3a clauses extracted from the supplied HTML. The reference guides and repositories were inspected; their complete mapping is not integrated.",
    "Source": "Source", "HTML de référence fourni": "Supplied reference HTML", "Version des règles": "Rules version",
    "Conformité au catalogue externe": "External catalogue compliance", "Non évaluée": "Not evaluated",
    "Inspecter les clauses et les empreintes": "Inspect clauses and hashes",
    "Télécharger les 144 résultats structurels ↗": "Download all 144 structural results ↗",
    "Configuration → décision → preuve": "Configuration → decision → evidence", "Objectif & feuille de route": "Objective & roadmap",
    "Prototype local non officiel": "Unofficial local prototype",
    "Activez JavaScript pour utiliser le parcours guidé. Les résultats restent disponibles dans": "Enable JavaScript to use the guided flow. Results remain available in",
    "le catalogue JSON": "the JSON catalogue",
}


def bilingual_static(template, translations=CONFIG_TEXT_EN):
    """Baliser les textes simples sans toucher aux scripts ni aux données."""
    def replace(match):
        tag, attrs, original = match.groups()
        source = html.unescape(original).strip()
        if tag.lower() in ("script", "style", "pre", "code") or source not in translations or "data-fr=" in attrs:
            return match.group(0)
        return (f'<{tag}{attrs} data-fr="{html.escape(source, quote=True)}" '
                f'data-en="{html.escape(translations[source], quote=True)}">{original}</{tag}>')
    result = re.sub(r'<([a-z][a-z0-9]*)([^<>]*?)>([^<>]+)</\1>', replace, template, flags=re.I)
    def attributes(match):
        name, original = match.groups()
        value = html.unescape(original)
        if value not in translations:
            return match.group(0)
        return (match.group(0) + f' data-fr-{name}="{html.escape(value, quote=True)}" '
                f'data-en-{name}="{html.escape(translations[value], quote=True)}"')
    return re.sub(r'\b(aria-label|title)="([^"]+)"', attributes, result)
