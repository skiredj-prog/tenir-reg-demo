# TENIR/REG — plan d’attaque en 1 jour

**À 18 h, viser une démonstration locale vérifiable : une action autorisée, une action bloquée, une situation en attente et un dossier de preuves signé.** On réduit le périmètre du plan de 90 jours ; on ne prétend pas livrer en une journée ses garanties de production, sa validation commerciale et ses certifications.

Ce document présente des développements et tests **à réaliser**, pas des travaux déjà exécutés. Il reprend les acquis et limites du plan précédent sans modifier les fichiers joints.

## 1. Périmètre et moyens

Le planning suppose **deux développeurs et un testeur disponibles en parallèle**, sur huit heures de travail, avec une pause de 12 h 30 à 13 h 30. Cette disponibilité est une hypothèse, pas un fait confirmé.

- **Dev A :** règles, évaluation, budget, réservation et idempotence.

- **Dev B :** preuve signée, fournisseur simulé et restitution légère.

- **QA :** résultats attendus indépendants, tests automatisés et recette finale.

Limiter la réalisation à un profil de démonstration **mono-processus, mono-tenant**, avec verrou de thread ou mécanisme équivalent adapté au runtime choisi. L’état peut rester en mémoire pour cette journée ; dans ce cas, toute garantie après redémarrage est explicitement exclue. Aucune opération réelle, aucun paiement et aucun fournisseur de production.

Réutiliser les règles structurelles et la présentation des HTML fournis. Le runtime et les spécifications complètes I1–I9 ne sont pas joints : s’ils ne sont pas accessibles au démarrage, construire un petit moteur de démonstration, clairement identifié comme tel. Ne pas le présenter comme le runtime TENIR/REG officiel.

**Livrables de sortie :** un scénario exécutable, une suite de tests avec ses résultats, des EvidenceRecords réellement signées avec une clé de développement, un vérificateur à clé publique et une restitution lisible. Aucun secret ni clé privée ne doit apparaître dans le rapport.

## 2. Planning parallèle — 09 h à 18 h

| Créneau | Dev A — moteur et état | Dev B — preuve et restitution | QA — tests et recette | Point de passage |
| --- | --- | --- | --- | --- |
| **09:00–09:30** | Cadrage commun D0 : profil, politique de budget, états et interfaces. | D0 : figer le contrat de preuve et les sorties du fournisseur simulé. | D0 : écrire les résultats attendus avant le code. | Contrat partagé et périmètre figés. |
| **09:30–11:00** | D1 : reprendre les règles structurelles. D2 : évaluateur pur avec temps explicite. | D4 : bibliothèque de signature, payload canonique et vérificateur. Préparer le fournisseur simulé. | Préparer T01–T04, T08 et T09 ; fixtures et cas limites. | Évaluation testable et première signature vérifiable. |
| **11:00–12:30** | D3 : réservation atomique, contrôle sous verrou et idempotence. | D5 : restitution sur fixture ; relier les champs au contrat. | Préparer T05–T07 ; lancer les tests unitaires disponibles. | Moteur et restitution prêts à être branchés. |
| **12:30–13:30** | Pause. | Pause. | Pause. | — |
| **13:30–15:00** | Intégrer évaluation, réservation et appel simulé ; conserver la réservation sur UNKNOWN. | Brancher les traces réelles, puis signer et exporter. | Lancer les parcours complets ; vérifier l’absence d’appels interdits. | PASS, HARD_VETO et HOLD visibles avec preuves. |
| **15:00–16:30** | Corriger budget, concurrence et idempotence. | Corriger signature, cohérence du rapport et export. | D6 : exécuter T01–T10 et la régression après corrections. | Aucun test bloquant en échec ou non exécuté. |
| **16:30–18:00** | Geler la version et documenter les limites du moteur. | Finaliser le dossier de démonstration et les instructions. | Rejouer la démonstration, vérifier les preuves indépendamment, consigner la recette. | GO ou NO-GO pour une démonstration locale testée. |

Les tests se préparent dès le matin. L’intégration ne doit pas attendre la fin de journée et aucune nouvelle fonctionnalité n’entre après 15 h.

## 3. Développement et tests associés

| Lot | Développement attendu | Tests associés | Dépendances | Priorité |
| --- | --- | --- | --- | --- |
| **D0 — contrat commun** | Figer mandat, profil/version, operation_id, unités, temps de référence, signaux, verdicts, états et EvidenceRecord. | Fixtures de toute la suite ; validation des champs requis. | Accès aux pièces et choix d’un runtime disponible. | P0 |
| **D1 — structure** | Extraire ou réutiliser R1a–R3a. Corriger le libellé du selfcheck et expliquer toutes les violations. | **T01** : cas de clauses et comparaison par configuration si le catalogue externe est fourni. | D0 ; catalogue externe pour une validation officielle. | P0 |
| **D2 — évaluation** | Fonction pure produisant PASS, HARD_VETO ou HOLD selon une politique de démonstration documentée. Temps injecté ; montants en unités entières. | **T02–T04, T08** : nominal, blocage, signal inutilisable et reproductibilité. | D0. | P0 |
| **D3 — exécution contrôlée** | Vérifier l’état courant et réserver atomiquement avant l’appel simulé. Dédupliquer par operation_id et empreinte du payload. | **T02, T05–T07** : budget, UNKNOWN, concurrence et idempotence. | D1, D2 et contrat du fournisseur simulé. | P0 |
| **D4 — EvidenceRecord** | Construire un payload complet, le canonicaliser avec une bibliothèque adaptée et le signer en Ed25519. Vérification par clé publique. | **T09** : signature valide, altération et mauvaise clé. | D0 ; bibliothèque disponible. D3 pour les traces effectives. | P0 |
| **D5 — restitution** | Réutiliser l’interface existante ou générer un rapport léger depuis les records ; ne pas recalculer le verdict dans l’interface. | **T10** : concordance entre rapport, record, état et appels simulés. | D0 pour la maquette ; D3 et D4 pour le branchement réel. | P0 pour le rapport ; confort visuel P1. |
| **D6 — recette** | Exécuter une suite reproductible et produire un résultat par test, avec version et environnement. | **T01–T10**, puis régression ciblée. | Lots concernés disponibles ; oracle QA figé dès D0. | P0 |

P0 signifie indispensable au résultat annoncé. P1 signifie amélioration supprimable sans compromettre le noyau de la démonstration.

### Politique de démonstration à figer à 09 h 30

Le cas nominal autorise l’action si le budget et les observations le permettent. Un dépassement du plafond ou un signal valide et frais `HYPOTHESIS_WEAKENED` produit ici **HARD_VETO**. Une observation indispensable absente, expirée ou invalide produit **HOLD**, sans nouvel appel externe. Ces choix sont propres au profil de démonstration, pas une interprétation certifiée de I1–I9.

Distinguer le **verdict** de l’**état de l’opération**. Si un appel autorisé a déjà été envoyé et que son résultat devient `UNKNOWN`, l’opération reste inconnue et sa réservation est conservée. Un nouveau verdict ne doit pas réécrire le verdict historique qui avait autorisé cet envoi.

La relation à contrôler est :

```
budget consommé + réservations actives ≤ plafond
```

Une confirmation convertit une réservation en consommation sans compter deux fois. Une issue UNKNOWN ne rend pas la capacité disponible. Pour cette journée, aucune reprise externe automatique : on montre l’attente et la nécessité d’une résolution explicite, sans prétendre implémenter toute la réconciliation.

## 4. Suite minimale de tests — critères observables

| Test | Situation testée | Résultat attendu | Développement couvert |
| --- | --- | --- | --- |
| **T01 — règles structurelles** | Cas conformes/non conformes couvrant R1a–R3a, dont plusieurs violations simultanées. | Verdict structurel et liste exacte des clauses. Sans catalogue externe, résultat marqué « test interne », pas « conformité au catalogue ». | D1 |
| **T02 — budget nominal et limites** | Action sous plafond, à la limite et montant invalide. | Réservation et consommation exactes ; un montant invalide ne crée ni réservation ni appel. | D2, D3 |
| **T03 — veto** | Dépassement du budget ou signal bloquant valide et frais. | HARD_VETO ; zéro nouvel appel et aucune réservation indue. | D2, D3 |
| **T04 — attente avant envoi** | Signal indispensable absent, expiré ou invalide. | HOLD ; aucune mutation externe. Le motif distingue les trois causes. | D2, D3 |
| **T05 — UNKNOWN après envoi** | Le fournisseur simulé a reçu l’appel mais son résultat reste inconnu ; la même demande est rejouée. | Réservation conservée ; aucun second envoi et aucune libération automatique du budget. | D3 |
| **T06 — concurrence** | Deux demandes dont le total ne peut tenir dans le reliquat, démarrées avec une barrière de synchronisation. | Au plus une est réservée/envoyée ; le plafond reste respecté. Une pré-évaluation favorable ne contourne pas le contrôle atomique. | D3 |
| **T07 — idempotence et conflit** | Même operation_id avec payload identique, puis avec payload différent, y compris des doublons concurrents. | Identique : résultat/état existant, pas de second débit ni envoi. Différent : conflit explicite sans mutation. | D3 |
| **T08 — déterminisme** | Mêmes entrées, état, profil/version et temps de référence figés. | Même verdict et même justification. Ne pas utiliser l’horloge courante implicitement lors du rejeu. | D2 |
| **T09 — intégrité** | Preuve valide, modification d’un champ signé et utilisation d’une autre clé publique. | Première vérification réussie ; les deux autres échouent. Un changement d’ordre des clés JSON seul reste équivalent si la canonicalisation retenue le prévoit. | D4 |
| **T10 — bout en bout** | Rejouer PASS, HARD_VETO, HOLD avant envoi et UNKNOWN après envoi. | Le rapport correspond aux EvidenceRecords, au journal du fournisseur et à l’état final ; signature vérifiable pour chaque preuve. | D2–D5 |

Le QA écrit les attentes à partir de la politique figée, pas en recopiant les sorties du moteur. Compter les appels dans le fournisseur simulé est essentiel : afficher « bloqué » dans l’interface ne prouve pas l’absence d’envoi.

Un test non exécuté est marqué **NON EXÉCUTÉ**, jamais assimilé à un succès. Plusieurs répétitions concurrentes donnent une preuve expérimentale locale, pas une démonstration formelle de toutes les exécutions possibles.

## 5. Synergies : un même artefact doit servir plusieurs usages

| Synergie | Réutilisation concrète | Gain dans la journée | Test qui la rend crédible |
| --- | --- | --- | --- |
| **Profil + fixtures + tests** | La même version du profil fixe les règles de décision, les cas de démonstration et l’oracle QA. | Évite trois définitions contradictoires du comportement. | T03, T04, T08 |
| **Évaluateur + contrôle atomique** | L’évaluation est réutilisée sur l’état courant au moment de la réservation protégée. | La décision pédagogique et le blocage effectif restent alignés. | T06 |
| **Registre + idempotence + UNKNOWN** | Le même enregistrement porte l’identifiant, le payload, la réservation et l’état de l’opération. | Une seule source pour empêcher doublons et relances dangereuses. | T05, T07 |
| **EvidenceRecord + vérificateur + rapport** | Le payload signé est la source du rapport ; la vérification ne dépend pas de l’affichage. | Une preuve produite une fois sert à l’audit, à la démo et au diagnostic. | T09, T10 |
| **Diagramme + traces + debug** | Les étapes du diagramme ouvrent les données réelles et les motifs d’arrêt. | La démo sert aussi à expliquer un test en échec. | T10 |
| **Fournisseur simulé + journal d’appels + QA** | Un même simulateur expose succès et résultat inconnu et compte les envois. | Les scénarios sont reproductibles sans risque d’opération réelle. | T02–T07 |

Ne pas multiplier les sources : le moteur décide, le registre porte l’état, la preuve atteste ce qui a été enregistré et le rapport présente cette preuve. Le crosswalk reste une projection documentaire, pas un second moteur de décision.

## 6. Dépendances et chemin critique

```
D0 — contrat et profil
 ├── D1 — règles structurelles ───┐
 ├── D2 — évaluation ────────────┴── D3 — réservation / envoi / état
 ├── D4 — signature et vérification ────────────────┐
 └── D5 — restitution sur fixtures                 │
                       D3 + D4 ──→ D5 branchée ──→ D6 — recette

QA : attentes et fixtures dès D0 ; tests unitaires dès livraison de chaque lot.
```

**Chemin critique : D0 → D2/D1 → D3 → preuve des traces → restitution branchée → recette.** La signature et le squelette du rapport se développent en parallèle pour ne pas rallonger ce chemin.

### Dépendances externes et plans de repli

| Dépendance | Si disponible | Si absente à 09 h 30 |
| --- | --- | --- |
| Runtime et spécifications officielles | Brancher un adaptateur restreint sur le moteur existant. | Moteur de démonstration explicitement non officiel. |
| Catalogue versionné externe | Comparer les configurations une par une. | Tests des clauses et selfcheck interne, sans validation du catalogue. |
| Bibliothèque Ed25519 et canonicalisation | Réutiliser les implémentations existantes ; vérifier une fixture. | Prioriser leur disponibilité ; ne pas inventer un algorithme cryptographique. Sans vérification réelle, sortie illustrative seulement. |
| Contrat EvidenceRecord officiel | Employer son sous-ensemble compatible et documenter les omissions. | Contrat de démonstration versionné ; ne pas revendiquer la compatibilité officielle. |
| Ressources de développement | Exécuter les pistes A, B et QA en parallèle. | Appliquer le mode réduit ci-dessous. |

Le catalogue et le crosswalk ne doivent pas bloquer la démonstration du budget lorsqu’ils manquent. En revanche, le contrat, le contrôle atomique, l’idempotence et la vérification réelle des preuves ne peuvent être remplacés par des libellés d’interface.

## 7. Arbitrages pour tenir une journée

**À 11 h :** si l’environnement ou le runtime officiel bloque, activer le moteur de démonstration local. **À 15 h :** si l’intégration retarde, supprimer le confort visuel et conserver une restitution Markdown/JSON. **À 16 h 30 :** si un test de budget, d’envoi interdit, d’idempotence ou d’intégrité échoue, annoncer NO-GO pour la démonstration testée et montrer le défaut ; ne pas masquer l’échec.

Hors périmètre : stockage durable, reprise après arrêt du processus, concurrence entre processus/hôtes, IAM multi-tenant, gestion de clés de production, ancrage externe de chaîne, intégration réelle, certification et validation réglementaire. Un commit simulé n’est pas une preuve d’exécution chez un fournisseur réel.

Les corrections sémantiques complètes SOSA/PROV et la validation SHACL sont P1. Si un export JSON-LD est conservé, le présenter comme une projection séparée du payload signé. Ne pas promettre que sa transformation préserve automatiquement la signature.

### Si une seule personne est disponible

La cible devient **une démo CLI locale**, sans rapport interactif ni comparaison complète du catalogue. Réutiliser les artefacts existants et limiter l’effort au budget, au veto, à l’attente, à l’idempotence et à la signature vérifiable. La recette est auto-exécutée et ne doit pas être présentée comme indépendante. Si ces éléments ne tiennent pas dans la journée, livrer un sous-ensemble explicitement identifié plutôt qu’annoncer le même résultat que l’équipe parallèle.

## 8. GO / NO-GO à 18 h

Le **GO** signifie uniquement : prototype local dont les critères définis ont été testés sur la version livrée. T01–T10 sont consignés ; les preuves se vérifient avec la clé publique ; le lecteur peut distinguer verdict, action envoyée et état inconnu ; le périmètre et les exclusions sont visibles.

Sans catalogue officiel, T01 peut valider les règles internes mais la conformité externe reste **NON ÉVALUÉE**. Sans crash/reprise ni stockage durable, aucune continuité après redémarrage n’est revendiquée. Ces exclusions n’empêchent pas le GO local ; elles empêchent le GO production.

La démonstration finale suit quatre parcours : **autorisation → blocage → attente avant envoi → issue inconnue après envoi**. Pour chacun, montrer la décision, le nombre d’appels, l’état du budget et la preuve vérifiée. C’est le résultat tangible d’une journée ; le pilote client reste une étape ultérieure.