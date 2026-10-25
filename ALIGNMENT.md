# Alignement de la présentation vers TENIR 5.7.0

## Cible et sources observées

La **référence technique publiée est désormais TENIR 5.7.0**. La release GitHub a été vérifiée le 25 octobre 2026 ; elle pointe vers le commit `47ef67e3efc5f3008896a7d88bebf929fa0a98f0`. Le snapshot source détaillé a maintenant été resynchronisé sur ce commit. La compatibilité d’exécution du prototype avec 5.7.0 reste à vérifier.

La vérification en lecture seule du 19 octobre 2026 a identifié :

| Élément | Référence consultée | Portée |
|---|---|---|
| Architecture en cinq niveaux | HTML fournis v5.6.0, éditions v1 FR et v2 EN | Terminologie et responsabilités des niveaux 0 à 4 |
| Runtime `tenir_governance` | Release `v5.7.0`, commit `47ef67e3efc5f3008896a7d88bebf929fa0a98f0` | Release publiée ; snapshot détaillé local resynchronisé |
| Standard `reg-conformance` | `cd5ab1b616ad59014f4b84d522b57a890a48a088` | Axes/règles/catalogue v1.0.0 ; capacités v1.1.0 |
| Harnais `tenir-conformance-s1-g1` | `d29400100b00f7e7a87d229af660f62e51d61f12` | Harnais exécutable S1 G0+G1 ; package 0.1.0 |
| Prototype de ce dépôt | `tenir_demo` 0.1.0 | Moteur local non officiel, fournisseur simulé, format de preuve de démonstration |

Les liens et empreintes des documents sont consignés dans [architecture-sources.json](references/architecture-sources.json). Les sources GitHub sont liées à leurs commits pour éviter de confondre une branche mouvante avec une version de référence.

La recherche initiale n'avait pas trouvé de référence nommée 5.7. La release **v5.7.0 est maintenant publiée** et son snapshot ciblé est resynchronisé. Le constat historique est conservé pour expliquer l’ancien état du dossier ; il ne sert plus de cible actuelle. La compatibilité d’exécution doit encore être testée séparément.

## Ce qui est aligné dans cette livraison

- L'accueil présente l'architecture en cinq couches, son vocabulaire FR/EN et le rôle des trois dépôts.
- La release 5.7.0 publiée, le snapshot runtime resynchronisé, les documents d'architecture 5.6.0 et le prototype local sont identifiés séparément.
- Chaque couche indique ce qu'elle signifie et ce que la démo illustre effectivement.
- Le diagnostic compare les 144 configurations et 1 008 résultats de clause au catalogue épinglé, avec contrôle des copies et empreintes. Une revue statique source neuf invariants et sept contrats, sans exécuter le code amont. Voir [le diagnostic détaillé](REFERENCE_ALIGNMENT.md).
- Les preuves Ed25519 de la démo restent attribuées à son format `demo-evidence/v1`, sans être présentées comme la sortie du runtime de référence.

## Vérifications nécessaires pour un alignement d'exécution 5.7.0

1. **Référence identifiée et confirmée** : utiliser la release `tenir_governance@v5.7.0` (commit de release affiché `47ef67e`) comme référence actuelle.
2. **Comparaison structurelle et revue statique livrées** : les domaines et sept clauses concordent ; les neuf invariants sont bornés au périmètre de revue, sans validation runtime.
3. **Contrats comparés** : les écarts d'observation, d'identité, de budget, de reprise et de preuve sont documentés. Leur contrat d'adaptation reste à définir.
4. Choisir et tester un adaptateur vers le runtime de référence si le périmètre du produit demande cette intégration.
5. Rejouer les scénarios et la vérification avec une trace de version et de déploiement adaptée.

Ces étapes ne sont pas remplacées par une modification du numéro de version affiché. Le moteur local reste un démonstrateur tant que leur recette n'est pas réalisée.

## Deux lectures complémentaires

Les cinq couches décrivent une répartition des responsabilités : intention, exigence, médiation, standard, runtime. La boucle d'observation décrit la lecture des données et des preuves : question, modèle, observation, interprétation, connaissance, restitution et suivi.

Les notes de métamodèle fournies sont conservées dans [note A](references/metamodel-notes-a.md) et [note B](references/metamodel-notes-b.md). Elles alimentent la conception du produit ; leurs affirmations d'isomorphisme, d'interopérabilité ou de maturité ne constituent pas une validation du présent dépôt.
