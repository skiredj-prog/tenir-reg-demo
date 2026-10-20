# Objectif produit TENIR/REG

## Direction du dépôt

Construire un outil de configuration, de démonstration et d'examen des preuves pour la gouvernance d'actions d'agents. Un prospect doit comprendre quelle configuration est structurellement admissible et pourquoi. Un développeur doit retrouver la règle et les données qui expliquent une décision. Un auditeur doit parcourir les observations, la décision, l'état d'exécution et les preuves vérifiables associées.

Le parcours central est :

**Configuration → règles et périmètre → scénario → observation → décision → exécution contrôlée → preuve → restitution.**

Trois briques servent ce parcours : le configurateur de produit, le rapport enrichi et la démonstration interactive. Les règles, données et traces doivent être réutilisées entre ces briques. Le moteur décide ; le registre porte l'état ; l'EvidenceRecord atteste les données enregistrées ; l'interface présente ces données ; le crosswalk décrit une projection sémantique séparée.

Source de cette direction : [analyse stratégique fournie par l'utilisateur](references/objectif-strategique-fourni.md). Ce document est conservé comme expression de l'ambition et des hypothèses produit. Ses mentions « livré », ses chiffres commerciaux et ses affirmations de conformité ne constituent pas une recette du présent dépôt.

## État de départ constaté

| Brique | État dans ce dépôt | Limite à conserver dans les interfaces |
|---|---|---|
| Démonstration locale | Quatre scénarios exécutables, dix tests automatisés, six preuves Ed25519 et vérificateur autonome | Runtime de démonstration, fournisseur simulé, mémoire du processus, recette auto-exécutée |
| Règles structurelles | Sept clauses R1a–R3a extraites du HTML ; énumération interne de 144 configurations dont 42 admissibles ; catalogue GitHub consulté | Comparaison automatisée complète et capacités de déploiement non validées ; conformité externe non évaluée |
| Rapport interactif | Sélection des quatre scénarios, décision, état, budget, journal et record signé | Boucle condensée en quatre étapes ; contrôle visuel du rapport généré encore à effectuer |
| Configurateur produit guidé | Livré localement : quatre étapes, vue Règles & périmètre opérationnelle, 144 sélections, clauses et champs expliqués, corrections minimales, export non signé, FR/EN et lien vers les preuves | Dix tests produit et contrôle JavaScript exhaustif ; contrôle visuel dans un navigateur encore à effectuer |
| Crosswalk et cycle JSON-LD | Fichiers documentaires fournis et conservés | Interopérabilité effective et validation sémantique non démontrées |
| Invariants I1–I9 et contrats de référence | Guides et dépôts reçus et consultés ; mapping complet non intégré | Les références partielles ou le code d'implémentation ne remplacent pas la validation d'applicabilité des invariants |
| Publication publique et intégrations | Non établies par les artefacts locaux | Une démonstration locale ne prouve ni déploiement public ni intégration partenaire |

## Priorités de livraison

### P0.1 — Configurateur produit explicable

Livrer un parcours guidé sur HOST_SCOPE, DEDUP_LAYER, CONCURRENCY et UNCERTAINTY. Chaque changement montre l'admissibilité structurelle, toutes les clauses violées et les champs concernés. Proposer des corrections explicites, que l'utilisateur peut choisir, puis exporter sa configuration et la version des règles utilisées.

Critères d'acceptation :

- Les 144 combinaisons sont traitées à partir des règles extraites ; les résultats concordent avec l'évaluateur structurel testé.
- Chaque rejet explique toutes les clauses concernées et met en évidence les champs impliqués.
- Une suggestion de correction est elle-même vérifiée ; la configuration initiale reste consultable.
- L'interface distingue **admissibilité structurelle**, **support du runtime local** et **garanties démontrées**. Le moteur local accepte uniquement son profil mono-processus ; une configuration multi-host admissible ne devient pas exécutable dans ce moteur.
- Les invariants sont marqués « guides reçus · applicabilité non intégrée » jusqu'à intégration et vérification de leurs correspondances versionnées.
- Le résultat porte la provenance des règles ; aucun libellé de conformité au catalogue externe n'est affiché sans comparaison réelle.

### P0.2 — Rapport de preuve sur la boucle complète

Étendre la restitution au parcours Question → Modèle théorique → Modèle d'observation → Observation → Interprétation → Connaissance → Restitution. Relier chaque étape aux champs des preuves effectivement produites. Montrer également le suivi de l'exécution, distinct du verdict.

Critères d'acceptation :

- Chaque donnée de la boucle est reliée à un champ signé ou explicitement signalée comme annotation documentaire.
- Les observations absentes, expirées ou invalides restent distinguables ; le point d'arrêt est visible.
- Pour UNKNOWN, le lecteur voit le PASS historique, l'appel envoyé et la réservation conservée.
- Le rapport expose la version du profil, les motifs, le budget, le journal et le résultat de vérification.
- La restitution prépare un examen d'audit ; elle ne conclut pas automatiquement à une conformité juridique ou à une certification.

### P0.3 — Parcours de démonstration client et onboarding

Relier le configurateur au scénario compatible avec le runtime, puis à sa preuve. Fournir une entrée unique, des explications accessibles et un rejeu reproductible. Conserver le cas de mandat de trésorerie comme scénario métier de simulation.

Critères d'acceptation :

- Une entrée claire ouvre un résultat généré ou explique comment le produire ; le modèle HTML source ne se présente pas comme un rapport rempli.
- Un utilisateur peut comprendre et parcourir autorisation, veto, attente et issue inconnue sans lire le code.
- Les interactions, le clavier et la mise en page sont vérifiés dans un navigateur autorisé, avec les limites de vérification consignées.
- Toute publication publique ultérieure est une livraison identifiée avec une URL et une recette ; elle n'est pas déduite des pièces de référence.

### P1 — Sémantique, diagnostic et documentation réutilisables

Valider un sous-ensemble du crosswalk avec des fixtures et des contraintes explicites, puis générer une projection JSON-LD séparée du payload signé. Réutiliser les données des règles pour les explications, la mise en évidence des violations et la documentation. Garder la provenance des mappings et leurs limites visibles.

Un contexte JSON-LD ne démontre pas, à lui seul, la compatibilité avec un outil d'observabilité ou un framework externe. Les correspondances sémantiques ne prouvent pas les garanties d'exécution du runtime.

### P1 — Préparation d'un pilote et correspondances réglementaires

Deux pistes distinctes :

1. **Fiabilité du pilote** : persistance transactionnelle des opérations et preuves, tests de crash/reprise, gestion des clés adaptée au pilote et résolution explicite de UNKNOWN. Ces capacités deviennent un préalable à toute promesse d'usage réel dépendant de la continuité de l'état.
2. **Dossier de correspondances** : analyser les textes et versions officielles des cadres visés, rattacher les exigences aux contrôles et preuves disponibles, consigner les lacunes et faire revoir les conclusions. Les candidats cités dans la stratégie comprennent DORA, ISO/IEC 42001, EU AI Act, NIST AI RMF et AARM.

Pour chaque correspondance, conserver : source/version, exigence, contrôle proposé, preuve disponible, limites, statut de revue et responsable de validation. Les associations comme « I8 → article donné » restent des hypothèses jusqu'à cette analyse. Les gains de revenus, de délais de vente et d'onboarding restent également à mesurer.

### P2 — Une première intégration mesurée

Choisir un seul adaptateur après identification d'un besoin utilisateur : gateway ou framework d'agents. Définir son contrat, le contrôle avant envoi, l'idempotence, les cas d'incertitude et les preuves de bout en bout. Les noms de plateformes dans la stratégie sont des cibles possibles ; aucun statut de partenariat, plugin officiel ou revenu partagé n'est présumé.

### P3 — Contributions aux standards et certification

Préparer des propositions documentées après validation des contrats et mappings. Une contribution officielle, une adoption par un standard et un label de certification nécessitent leurs propres critères et procédures ; ils ne découlent pas automatiquement du prototype ou de ses signatures.

## Prochain jalon

La référence technique est **TENIR 5.6.1**, confirmée par le porteur du projet comme base destinée à être promue en **5.7**. La page de garde présente les cinq couches et les trois dépôts en FR/EN. Le [suivi d'alignement](ALIGNMENT.md) distingue la base confirmée, les documents 5.6.0, la promotion prévue et la compatibilité du prototype encore à vérifier.

**P0.1 est livré localement** avec une entrée `index.html`, les explications, les corrections et le lien vers les scénarios compatibles. La validation visuelle et l'évaluation utilisateur restent ouvertes au titre de P0.3. Le prochain développement produit est **P0.2 : enrichir le rapport avec la boucle de preuve complète**. La persistance demeure indispensable pour un pilote qui doit survivre aux redémarrages ; elle suit les besoins du pilote et ne remplace pas les deux livrables produit P0.

Une [révision UI/UX](UX_REVIEW.md) relie désormais ces écrans par un parcours guidé, une fin explicite des choix, des corrections annulables et des sorties expliquées pour les configurations hors prototype. Le rapport distingue décision et résultat, explique les exceptions et propose une progression entre les quatre traces. Les langues, les thèmes et l'identité visuelle suivent la direction du futur site fournie en vidéo. Les contrôles automatisés de ces interactions ne clôturent pas la validation visuelle ni l'évaluation auprès d'utilisateurs.

Aucun calendrier commercial n'est engagé par cette feuille de route. Le document source contient plusieurs horizons et ordres de livraison ; ce cadrage tranche en faveur du configurateur et du rapport enrichi comme premières priorités.

## Mesures de valeur à collecter

| Usage | Mesure observable | Situation actuelle |
|---|---|---|
| Choisir une configuration | Temps nécessaire pour sélectionner et expliquer une configuration ; taux de réussite sur une tâche guidée | Baseline utilisateur à établir |
| Examiner une décision | Capacité à identifier le motif, l'appel envoyé ou bloqué, l'état du budget et la preuve correspondante | Recette technique disponible ; évaluation utilisateur à réaliser |
| Onboarding | Réussite de tâches sans assistance et temps nécessaire | Baseline à établir |
| Préparer un audit | Exigences sourcées avec preuves pertinentes, lacunes et revue explicites | Mapping à construire |
| Intégration partenaire | Appels effectivement contrôlés, doublons évités et incertitudes tracées dans le système intégré | Adaptateur à choisir et à tester |
