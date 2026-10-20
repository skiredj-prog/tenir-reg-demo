# TENIR/REG — configuration, démonstration et preuve

L'objectif du dépôt est de transformer les règles de configuration, le diagramme d'observation et les EvidenceRecords en un parcours produit utilisable par un prospect, un développeur et un auditeur : **configurer → comprendre la décision → examiner et vérifier la preuve**.

Le [cadrage produit et les priorités](PRODUCT.md) traduit l'objectif stratégique fourni par l'utilisateur en livrables et critères d'acceptation. Le prototype décrit ci-dessous constitue la première base technique de ce parcours.

La [page de garde](index.html) situe ce parcours dans les cinq couches : règle métier, contrainte réglementaire, acte de médiation, standard REG Core/REG+, runtime TENIR-Gov. Chaque couche est interactive et explique son rôle, son acteur, son résultat attendu et ce que la démo illustre. Elle présente également l'utilité de la démo, la boucle de lecture des preuves et les trois dépôts de référence.

**Base d'alignement : TENIR 5.6.1, destinée à être promue en 5.7**, selon la confirmation du porteur du projet. Le commit runtime identifié devient la référence technique ; les documents d'architecture fournis restent un snapshot 5.6.0. Le [suivi d'alignement](ALIGNMENT.md) distingue cette base confirmée, la promotion prévue et les adaptations du prototype encore à valider. La compatibilité d'exécution n'est pas déduite du seul changement de numéro.

Prototype **non officiel v0.1.0**, réalisé depuis le plan d'une journée et les pièces fournies. Il produit une action autorisée, une action bloquée, une attente avant envoi et une issue inconnue après envoi. Aucun service externe n'est appelé.

## Exécuter

Depuis ce dossier dans PowerShell :

```powershell
.\run.ps1 all
.\run.ps1 verify
```

`all` et `demo` exécutent T01–T10, C01–C10 et P01–P06, puis génèrent le configurateur, le rapport, les preuves, les clés **publiques**, les résultats et un reçu signé. Ouvrir [index.html](index.html) pour accéder au parcours, ou directement `output/configurator.html`. Le configurateur et le rapport fonctionnent sans serveur et sans réseau. `test` exécute seulement la recette et écrit `test-only-results.json`, sans modifier les fichiers du dossier signé. Pour conserver un dossier précédent, choisir `-OutputDir output-autre`, puis ouvrir son propre `configurator.html`.

`tenir_demo/report_template.html` est le modèle source, avec des marqueurs de génération. Son ouverture directe redirige vers `output/report.html` ; pour consulter les résultats, utiliser le rapport généré.

## Utiliser le configurateur

Les quatre étapes couvrent HOST_SCOPE, DEDUP_LAYER, CONCURRENCY et UNCERTAINTY. Chaque sélection lit le résultat pré-calculé par le même évaluateur structurel Python : **144 configurations, 42 admissibles, 102 rejetées**. Toutes les clauses violées et leurs champs sont indiqués. Les suggestions présentent toutes les corrections à distance minimale ; à égalité, celles qui conservent le périmètre d'hôtes arrivent en premier.

Une correction s'applique uniquement sur votre clic. Le choix avant la première correction reste consultable jusqu'à la réinitialisation. Le bouton d'export télécharge un **brouillon JSON non signé**, avec la configuration, les violations et la provenance/version des règles. Il n'exécute aucune opération.

Le dernier bouton des quatre choix ouvre **Examiner ma configuration**. Chaque erreur est expliquée près du champ concerné. Une correction ou le chargement explicite du profil local propose **Annuler ce changement** ; cette annulation reste disponible après un aller-retour dans le rapport. Une modification manuelle retire cette annulation afin de préserver les modifications suivantes.

Le bouton **02 · Règles & périmètre** ouvre une vue dédiée des sept clauses : satisfaite, violée ou non applicable, condition, valeur attendue et valeur sélectionnée. Le panneau de périmètre reprend les quatre choix. Les boutons de chaque clause et de chaque champ reviennent directement au contrôle correspondant, sans perdre la sélection. Les étapes Démonstration et Preuves pointent vers les sections réelles du rapport pour le profil local vérifié.

Les boutons **FR et EN** du configurateur, du rapport et de l'accueil changent la langue des libellés et explications. La commande **Mode clair / Mode sombre** partage la présentation du futur site TENIR : monogramme encadré, titres avec empattements, fond ivoire ou sombre et accents sobres. La sélection, l'étape et la configuration avant correction sont conservées. Les préférences sont mémorisées lorsque le navigateur autorise `localStorage` pour les fichiers locaux. Les identifiants techniques, les JSON source et les preuves signées restent dans leur forme originale.

Depuis les règles, un retour vers la configuration fait apparaître **Revenir aux règles et au périmètre**. Depuis le rapport, **Revenir au configurateur** puis **Reprendre la démo consultée** permet de retrouver le même scénario. Les liens transportent les identifiants de configuration, l'étape et le choix avant correction ; une mémoire de session par dossier complète cette conservation lorsque le navigateur l'autorise. Les destinations de retour sont limitées aux pages locales prévues.

Trois états restent distincts : admissibilité structurelle, prise en charge par le runtime et garanties démontrées. Seul `mono-process / local-registry / thread-lock / fail-closed` correspond au profil du rapport vérifié. Les autres configurations peuvent être admissibles sans être exécutables dans ce prototype : l'interface propose de les conserver pour l'export ou d'adopter explicitement le profil local. Le lien d'en-tête permet aussi de consulter l'archive des scénarios locaux ; le rapport précise alors le profil réellement exécuté et conserve la sélection pour le retour. Une recette en échec désactive les liens vers ces scénarios. Le diagnostic d'alignement compare le catalogue épinglé et présente une revue statique des invariants I1–I9 : quatre sous-ensembles locaux, trois non implémentés et deux non évalués dans la revue. La compatibilité d'exécution reste non vérifiée.

La [revue UI/UX et ses parcours](UX_REVIEW.md) décrit les corrections livrées et les tâches restant à observer sur ordinateur et téléphone. Le rapport présente un parcours guidé avec des explications des exceptions, la décision séparée du résultat d'exécution et les détails d'audit repliés.

`output/configuration-catalogue.json` contient les résultats et suggestions utilisés par l'interface. Le reçu `demo-files/v2` couvre ce catalogue et la page, en plus des six fichiers du dossier de preuve. Les brouillons téléchargés par l'utilisateur ne font pas partie de ce reçu.

Le script utilise le Python fourni avec Codex lorsqu'il est disponible, sinon `python`. Pour un environnement Python 3.12 séparé :

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe demo.py all
.\.venv\Scripts\python.exe verify.py output --public-key output/evidence.public.pem
```

La bibliothèque `rfc8785==0.1.4` a aussi été installée dans `.deps` sur cette machine. `cryptography==50.0.2` provient du runtime disponible. Les versions et empreintes des sources utilisées sont consignées dans le dossier.

## Résultat attendu

| Parcours | Verdict historique | État | Appels |
|---|---|---|---:|
| autorisation, 20 000 unités | PASS | CONFIRMED | 1 |
| hypothèse affaiblie, 5 000 unités | HARD_VETO | BLOCKED | 0 |
| observation absente, 5 000 unités | HOLD | HELD | 0 |
| envoi de 10 000 unités, réponse inconnue | PASS | UNKNOWN | 1 |

Budget final : plafond 70 000, consommé 20 000, réservé 10 000, disponible 40 000. Le rejeu de l'issue inconnue n'envoie rien de plus. Six EvidenceRecords enregistrent les réservations et les résultats. Un reçu signé lie le rapport, les résultats des tests, les clés publiques et les preuves.

Dans le rapport, les compteurs d'en-tête représentent **l'état de la preuve sélectionnée**, et les appels sont ceux de son journal cumulé : 1 après autorisation, toujours 1 après veto et attente, puis 2 après UNKNOWN. Les réservations sont respectivement 0, 0, 0 et 10 000. Le montant consommé reste 20 000 dans ces quatre états car seule l'autorisation confirmée consomme ce budget. Sélectionner deux fois un scénario ne crée aucun nouvel appel. Le budget disponible affiché plus bas est explicitement le bilan final du dossier.

La **boucle de preuve** se parcourt en huit étapes : question, modèle de contrôle, protocole d'observation, observation et donnée, interprétation, exécution contrôlée, connaissance et preuve, restitution et suite. Chaque explication est explicitement documentaire, hors EvidenceRecord. Les boutons de source ouvrent la valeur exacte, son chemin JSON Pointer, le numéro de preuve et l'empreinte du payload. Les métadonnées de signature sont identifiées séparément des champs du payload signé.

L'interprétation utilise le budget de la **première preuve de l'opération, avant réservation**. L'exécution relie cet événement à sa dernière preuve : pour UNKNOWN, PASS reste le verdict historique et la réservation reste conservée. Veto et attente montrent l'arrêt avant envoi. Les observations absentes, invalides et expirées restent distinctes dans la projection. Changer de langue conserve l'étape et la source consultées ; le rechargement et le retour par la configuration les restaurent aussi via des paramètres validés, même sans stockage. Sélectionner un autre scénario reprend la boucle au début. L'affichage d'une source ne remplace pas la vérification cryptographique du dossier.

Le GO local des nouvelles générations exige les dix tests du noyau, les dix tests du configurateur, les six tests de projection et les six tests d'alignement exécutés et réussis, ainsi qu'une vérification effective des preuves. Un échec donne NO-GO, reste dans les résultats et entraîne un code de sortie non nul. Le vérificateur conserve la lecture des anciens reçus ; lorsqu'une recette contient `proof_loop_tests` ou `alignment_tests`, ces sections participent au GO. Le QA est **auto-exécuté**, sans indépendance organisationnelle revendiquée.

Le [protocole d'essai utilisateur](USER_WALKTHROUGH.md) prépare six tâches et une grille de résultats vierge. Aucune observation utilisateur ni validation visuelle n'est déduite des tests automatisés.

## Contrat de démonstration D0

- Profil `tenir-reg-local-demo/0.1.0`, mono-processus, mono-tenant, `local-registry`, `thread-lock`, `fail-closed`.
- Mandat : ressource `demo-budget`, plafond 70 000 `demo-unit`. Ces unités de simulation ne sont pas une devise. Montants entiers strictement positifs, plafonnés au domaine entier sûr RFC 8785 ; booléens et flottants refusés pour les montants.
- Temps injecté en secondes Unix UTC, fixé dans `fixtures/acceptance.json` ; aucun appel à l'horloge dans l'évaluateur. Il s'agit du temps de scénario, pas de la date réelle d'exécution.
- Signal requis : enveloppe Ed25519 de schéma `demo-signal/v1`, émetteur `demo-assure`, ressource et propriété attendues, date d'observation ≤ référence, expiration exclusive et âge maximal de 300 secondes. La clé publique attendue est injectée dans le moteur.
- Priorité : montant/unité invalides → HARD_VETO ; dépassement ou signal affaibli valide/frais → HARD_VETO ; observation absente, invalide ou expirée → HOLD ; sinon PASS. Quand dépassement et problème d'observation coexistent, le veto prévaut et tous les motifs détectés sont enregistrés.
- `execute(request, reference_time)` gèle la demande puis, sous un même `RLock`, déduplique, évalue l'état courant et réserve avant l'appel. L'appel simulé s'effectue hors du verrou ; les doublons voient `DISPATCHING` puis l'état final.
- L'empreinte porte sur **tout le payload** : identifiant, montant, unité, signal signé et mode du simulateur. Un identifiant est lié à ce payload jusqu'à la fin du processus, y compris après HOLD ou veto. Une demande corrigée doit porter un nouvel identifiant. Un payload différent sous le même identifiant lève `Conflict` sans mutation.
- CONFIRMED convertit la réservation en consommation. UNKNOWN et les exceptions fournisseur conservent la réservation. Le verdict historique PASS reste intact. Aucun nouvel envoi ni résolution automatique n'est implémenté.
- Les observations sont des snapshots réutilisables dans leur fenêtre de fraîcheur. Le prototype ne revendique pas d'anti-rejeu stateful des observations. L'idempotence concerne les opérations.

## Preuves et vérification

`tenir_demo/evidence.py` emploie la bibliothèque RFC 8785 pour la canonicalisation et `cryptography` pour Ed25519. La signature porte sur un préfixe de domaine explicite puis le payload canonique ; SHA-256 est également exporté. La clé privée de développement est créée en mémoire à chaque exécution et n'est jamais écrite. Aucun secret ne figure dans les exports.

Chaque preuve contient version, profil et empreinte, temps, demande et empreinte, observation, décision/motifs, état distinct du verdict, snapshots de budget avant/après, événement et snapshot du journal du simulateur. `previous_hash` référence l'enveloppe précédente. L'attestation du dossier fixe son empreinte et son nombre de preuves ; le reçu fixe l'empreinte des huit fichiers exportés. Le vérificateur conserve la lecture des anciens dossiers `demo-files/v1` à six fichiers.

Le vérificateur `verify.py` ne charge ni le moteur, ni le générateur de rapport. Il vérifie les signatures, la chaîne, les transitions de budget, le registre final, le journal d'appels, l'inventaire de fichiers et le rattachement des tests à la version livrée. Il ne prétend pas démontrer tous les invariants officiels ni réévaluer le runtime officiel.

La commande rapide utilise la clé publique exportée à côté des preuves. Pour une vérification par un tiers, transmettre cette clé ou son empreinte par un canal de confiance et la fournir avec `--public-key`. Remplacer simultanément toutes les preuves et leur clé ne prouve pas l'identité du signataire. Ces clés locales ne constituent pas une identité de production.

## Tests et pièces réutilisées

T01 couvre chaque clause R1a–R3a et des violations simultanées, avec attentes explicites dans `fixtures/structure.json`. L'énumération interne retrouve 42 configurations admissibles sur 144, réparties 9/18/15 par portée. La comparaison hors ligne avec le catalogue GitHub épinglé retrouve les mêmes 144 configurations et 1 008 résultats de clause. Les axes et opérandes des sept règles correspondent aussi à la normalisation revue des sources YAML. Les copies amont et leurs citations sont contrôlées par empreinte. Cette **concordance structurelle** ne démontre ni les capacités de déploiement ni la conformité d'exécution. Le [diagnostic détaillé](REFERENCE_ALIGNMENT.md) expose les différences HOLD/UNKNOWN, le budget, les formats de preuve et les incohérences documentaires. Aucun code amont n'est exécuté.

T02–T05 couvrent budget, veto, observations et UNKNOWN ; T06 comporte 50 courses de budget avec barrière et pré-évaluation favorable des deux demandes ; T07 comporte 20 courses de doublons/conflits et un doublon pendant l'envoi ; T08 vérifie le déterminisme et l'isolation des copies ; T09 teste signature, altération, autre clé, ordre des clés JSON et troncature du dossier ; T10 rapproche les quatre parcours du rapport, des preuves, du registre et des appels.

C01–C07 contrôlent l'énumération exhaustive, les clauses et champs, toutes les corrections minimales, la séparation runtime/garanties, la disponibilité de la démonstration, l'absence de mutations et la provenance des brouillons. C08–C10 vérifient la page autonome et son modèle, la détection d'altérations des deux nouveaux fichiers et le maintien d'un NO-GO en cas d'échec de la recette produit.

P01–P06 vérifient la projection déterministe, toutes les références vers les champs réels, la distinction documentaire/payload/métadonnées, le budget avant réservation, les observations inutilisables, les deux événements des envois et les arrêts avant envoi. Les références inconnues ou mal formées sont rejetées.

Contrôles supplémentaires du JavaScript :

```powershell
node tests/check_configurator.cjs output/configurator.html
node tests/check_report.cjs output/report.html
node tests/check_landing.cjs
node tests/check_journey.cjs output
node tests/check_theme.cjs output
node tests/check_proof_loop.cjs output
```

Ils exécutent les vrais scripts générés dans un DOM minimal : 144 sélections du configurateur, 1 008 résultats de clauses, ouverture de la vue Règles & périmètre, corrections, navigation, focus, export, basculement FR/EN et quatre preuves du rapport. Le test de parcours vérifie aussi les allers-retours entre pages, les compteurs par preuve et la conservation des choix avec ou sans stockage de session. Ils ne valident pas la mise en page dans un navigateur. Le contrôle visuel n'a pas été effectué : le navigateur intégré a refusé le protocole des fichiers locaux.

Les règles sont extraites du HTML XXL dans `references/rules.json` et `axes.json`. Le rapport reprend la boucle des pièces jointes, projetée sur les preuves locales, et l'identité du futur site fournie en vidéo. Les originaux sont copiés sans modification dans `references/`, avec provenance et empreintes dans `manifest.json`. **Leurs indications de statut et de conformité restent des assertions des documents d'origine, pas des résultats de ce prototype.** La projection `demo-proof-loop/v1` sert à la lecture du rapport ; le crosswalk et son cycle JSON-LD restent des références documentaires, sans export sémantique signé ni validation SHACL.

## Limites

État en mémoire perdu à l'arrêt ; pas de stockage durable, reprise, coordination entre processus ou hôtes, IAM multi-tenant, réconciliation, gestion de clés de production, ancrage externe, intégration réelle ou certification. Les signatures attestent les données du prototype et du simulateur. Les essais concurrents apportent une preuve expérimentale locale et ne constituent pas une démonstration formelle.
