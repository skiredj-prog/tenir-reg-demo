# Diagnostic d'alignement des références

Le catalogue structurel concorde sur **144 configurations et 1 008 résultats de clause** dans le périmètre fermé comparé. La **compatibilité d'exécution reste `NOT_VERIFIED`**. Ces deux résultats portent sur des objets différents : une comparaison de règles ne constitue pas un essai du runtime ou du harnais de référence.

La référence actuelle est la release publiée **TENIR 5.7.0** ([release GitHub](https://github.com/skiredj-prog/tenir_governance/releases/tag/v5.7.0), commit `47ef67e3efc5f3008896a7d88bebf929fa0a98f0`). Le prototype conserve sa version `0.1.0` et ses formats `demo-*` ; ce diagnostic ne transforme pas son moteur en runtime de référence. Les sources détaillées citées ci-dessous ont été resynchronisées sur ce commit ; la compatibilité d’exécution reste à tester.

## Trois sources épinglées

| Source | Référence | Rôle dans le diagnostic |
|---|---|---|
| [REG Conformance — catalogue](https://github.com/skiredj-prog/reg-conformance/blob/cd5ab1b616ad59014f4b84d522b57a890a48a088/catalog/compatibility-rules-v1.yaml) | `cd5ab1b616ad59014f4b84d522b57a890a48a088` | Axes, sept implications, résultats du catalogue et déclarations de capacités |
| [TENIR Governance — release actuelle](https://github.com/skiredj-prog/tenir_governance/releases/tag/v5.7.0) | `v5.7.0` / `47ef67e3efc5f3008896a7d88bebf929fa0a98f0` | Référence actuelle ; contrats détaillés resynchronisés dans ce dépôt |
| [Harnais S1/G1 — retour après incertitude](https://github.com/skiredj-prog/tenir-conformance-s1-g1/blob/d29400100b00f7e7a87d229af660f62e51d61f12/src/tenir_conformance/membrane/membrane.py#L707-L716) | `d29400100b00f7e7a87d229af660f62e51d61f12` | Permis, identité d'effet, tentatives, incertitude et contrat de rejeu |

Les copies brutes et empreintes sont consignées dans les manifestes [REG](references/upstream-reg-manifest.json), [TENIR](references/upstream-tenir-manifest.json) et [harnais](references/upstream-harness-manifest.json). Les fichiers ciblés ont été resynchronisés depuis le tag v5.7.0 et leur identité Git blob/SHA-256 vérifiée ; aucun code amont n'a été importé ou exécuté pour ce diagnostic.

## Ce qui est calculé et ce qui est relu

**Comparaison calculée localement.** Le produit cartésien des quatre axes contient 144 sélections. Chaque sélection reçoit sept statuts de clause, soit 1 008 résultats. Le relevé compare l'admissibilité et les identifiants de clauses avec le catalogue épinglé : **42 admissibles, 102 rejetées, aucun écart structurel**. Les 171 occurrences de violation emploient une formulation locale différente ; leurs `clause_id` concordent. Les messages ne servent donc pas de clé sémantique.

**Normalisation et revue de sources.** Les axes et implications normalisés proviennent d'une lecture du sous-ensemble YAML épinglé. Cette normalisation est conservée dans le [relevé REG](references/upstream-reg-review.json) ; elle ne constitue pas un interpréteur général de tout futur catalogue. Les différences de contrat, l'applicabilité des invariants et les rapprochements de scénarios sont des constats de revue versionnés, distincts des résultats de calcul.

La concordance ne couvre pas les garanties effectives : les lignes du catalogue consulté portent `null` pour leur démonstration. Les résultats locaux ne sont pas des attestations au format de ce registre. L'axe `UNCERTAINTY` ne modifie pas les sept implications structurelles, tandis que le moteur local n'exécute que `fail-closed`. La valeur `consensus-reference` du registre de capacités est hors de l'axe fermé utilisé pour les 144 configurations.

## Écarts qui empêchent une assimilation des moteurs

Le [relevé TENIR](references/upstream-tenir-review.json) décrit sept différences contractuelles avec leurs champs et sources. Les plus déterminantes concernent les phases comptables et les retours après incertitude.

| Situation | Prototype local | Composition TENIR épinglée |
|---|---|---|
| HOLD avant envoi | `HELD`, aucun appel, aucune réservation | Réservation prise sur HOLD lorsque la ressource est dans le périmètre ; cycle de vie HOLD distinct |
| Dispatch autorisé | Montant conservé en réservé pendant `DISPATCHING` | Sur le chemin où le dispatch aboutit, `resource.commit()` convertit la réservation en consommation avant l'appel fournisseur |
| Résultat UNKNOWN | Montant toujours réservé ; PASS historique conservé | État `unknown` réconciliable ; comptabilité engagée au dispatch, avec indicateurs persistés de propriété du budget |
| Confirmation | Conversion de la réservation en consommation | Résolution d'une opération dont la consommation a déjà été engagée au dispatch |

Ces différences sont visibles dans les chemins [réservation/HOLD](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/tenir_governance/composition/governor.py#L485-L557), [commit au dispatch](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/tenir_governance/composition/governor.py#L827-L855) et [réconciliation](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/tenir_governance/composition/governor.py#L1130-L1207). Les erreurs de transition et de persistance possèdent leurs propres branches ; le tableau décrit les phases nominales.

Le harnais constitue encore un autre contrat. Le rejeu local renvoie la décision historique `PASS` et l'état `UNKNOWN`, sans nouvel appel. Le harnais peut renvoyer **HOLD comme disposition actuelle** pour le même effet non résolu. Son identité LEI, ses tentatives, permis, nonces et reçus ne sont pas représentés par le seul `operation_id` local. Ses scénarios examinés n'offrent pas d'oracle du budget numérique local : `consumed` y désigne notamment la consommation d'un permis. Le [relevé du harnais](references/upstream-harness-review.json) conserve ces rapprochements partiels, sans revendiquer S1.

Autres contrats à traiter : entrées de scoring/géométrie et objet TENIR 1.2 face au signal local signé/TTL ; verdict FLAG absent du moteur local ; machine d'états durable et protocole fournisseur différents ; format de preuve et contexte canonique distincts. La projection documentaire de la boucle ne fournit pas les champs manquants d'un objet TENIR 1.2.

## Invariants : portée locale, sans verdict de conformité

Les identifiants ci-dessous suivent les labels du code épinglé. `LOCAL_SUBSET` désigne un comportement local limité ; les tests cités n'exécutent pas les gardes de référence.

| Invariant | Référence examinée | Statut local | Portée ou lacune |
|---|---|---|---|
| I1 | Effet au plus une fois, propriété conditionnelle du manuscrit | `LOCAL_SUBSET` | T05/T07 : pas de second appel simulé sous la même identité en mémoire ; pas de preuve d'équivalence des effets entre identifiants ou après crash |
| I2 | Définition non identifiée dans le sous-ensemble inspecté | `NOT_ASSESSED` | Mapping doctrinal ouvert ; aucune définition inventée |
| I3 | Terminalité d'une tentative | `LOCAL_SUBSET` | T05/T07 : protection du rejeu ; absence du protocole complet Passage/états durables |
| I4 | Effets par dispatch et garde de dispatchabilité | `LOCAL_SUBSET` | T03/T04/T07 : appel simulé seulement après autorisation ; aucun effet externe établi |
| I5 | Définition non identifiée dans le sous-ensemble inspecté | `NOT_ASSESSED` | La signature ou le chaînage ne suffit pas à remplir un invariant non défini |
| I6 | Aucune admission sous quarantaine | `NOT_IMPLEMENTED` | Aucun QUARANTINE_LOCK global ni sortie autorisée |
| I7 | Intégrité de délégation | `NOT_IMPLEMENTED` | Aucun modèle Agent/Delegation ni contrôle de confiance |
| I8 | Budget agrégé | `LOCAL_SUBSET` | T02/T03/T05/T06 : plafond sous RLock, un processus ; phases comptables différentes |
| I9 | Cohérence temporelle de trajectoire | `NOT_IMPLEMENTED` | Le TTL du signal n'implémente pas Trajectory.check_temporal_consistency |

Les définitions et citations détaillées figurent dans la [matrice des invariants](references/upstream-tenir-review.json). I2/I5 non identifiés dans ce relevé ne signifie pas qu'ils sont absents de toutes les références doctrinales.

Deux incohérences des sources restent visibles :

- Le [tableau du guide](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/docs/agentic-governance-guide.md#L126-L135) numérote notamment délégation/budget/terminalité autrement que le [code des gardes](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/tenir_governance/membrane/__init__.py#L208-L276) et le tableau du manuscrit. Le relevé ne résout pas cette divergence doctrinale par un renommage silencieux.
- Le [manuscrit mentionne HMAC](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/docs/manuscript.md#L413-L419), alors que le [ledger composé inspecté](https://github.com/skiredj-prog/tenir_governance/blob/47ef67e3efc5f3008896a7d88bebf929fa0a98f0/tenir_governance/composition/lattice.py#L185-L219) calcule un hash SHA-256 de JSON trié, sans clé. Ce constat concerne ce ledger précis. L'enveloppe locale RFC8785/Ed25519 reste un autre contrat ; aucune supériorité ni équivalence n'en est déduite.

## Prochain lot : contrat d'adaptation puis vérification runtime

1. **Fixer le sujet et les retours** : runtime et harnais réellement appelés, identité/versions, détection explicite de tout fallback, décision historique séparée de la disposition courante, mapping des états et des identités d'effet.
2. **Fixer les phases du budget** : réservation, commit, HOLD, UNKNOWN, confirmation et remboursement ; choisir un contrat explicite puis construire les oracles de transition, sans comparer seulement des totaux finaux.
3. **Fixer les entrées et les preuves** : observation locale, entrées épistémiques, fraîcheur, politique, contexte TENIR 1.2 et format exporté. Chaque champ absent reste une lacune explicite ; les payloads signés existants sont conservés.
4. **Recetter l'adaptateur sur les quatre scénarios**, en conservant séparément les sorties locales et de référence, puis ajouter les erreurs, conflits et reprises nécessaires au périmètre retenu. L'exécution de ces essais sera une livraison distincte du présent diagnostic statique.

La simulation paramétrable peut ensuite utiliser un contrat choisi et vérifié, plutôt que prolonger implicitement les différences actuelles.
