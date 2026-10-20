# Suite donnée à l’évaluation du démonstrateur

## Statut de la revue reçue

L’[évaluation fournie](references/evaluation-demo-2026-10-20.md) propose de positionner le démonstrateur comme **atelier de diagnostic des contrôles d’agents**, avec UNKNOWN comme incident d’entrée. Ses notes sont des appréciations de revue. Les exécutions, captures et dimensions d’écran qu’elle rapporte sont attribuées à son auteur ; elles ne sont pas présentées comme des observations réalisées dans cette session, ni comme des essais utilisateur.

Les liens externes de captures et d’archives n’ont pas été utilisés pour valider visuellement cette nouvelle livraison. La validation visuelle de la version modifiée et les séances avec des participants restent ouvertes.

## Choix de produit

- **Public initial :** architectes, responsables techniques et équipes d’exploitation préparant les contrôles d’un agent.
- **Question d’entrée :** une action a été autorisée et envoyée, son résultat reste inconnu ; que sait-on et que faut-il vérifier avant d’envisager la suite ?
- **Tâche centrale :** distinguer décision historique, appel, résultat et budget, puis retrouver la source qui soutient chaque constat.
- **Livrable d’atelier :** une [fiche de diagnostic](DIAGNOSTIC_ATELIER.md) remplie par le participant ou l’animateur, avec constats, sources, lacunes et prochain contrôle. Le rapport et le brouillon JSON servent de pièces d’appui.

Le configurateur et le lecteur de preuves deviennent les fonctions de cet atelier. Les six usages restent accessibles. Les couches d’architecture servent de contexte consultable, après l’entrée par l’incident et le premier parcours.

## Actions et preuve attendue

| Sujet | Réponse dans ce lot | Vérification ou travail restant |
|---|---|---|
| Bénéfice trop abstrait | Entrée par UNKNOWN ; récit bref et accès direct à sa trace | Contrôle des valeurs contre le dossier signé ; compréhension à observer |
| Public et résultat diffus | Atelier pour équipes techniques ; fiche de diagnostic vierge | Vérifier qu’une équipe utilise la fiche dans un processus réel |
| Défilement initial | Chargement direct du configurateur sans fragment ajouté automatiquement | Scripts réels testés ; comportement visuel à confirmer dans un navigateur autorisé |
| Accueil mobile long | Synthèse prioritaire ; usages complémentaires et architecture repliables | Aucune nouvelle hauteur mobile ni mesure d’accessibilité complète revendiquée |
| Livraison client | Kit de consultation et kit développeur distincts | Inventaires, empreintes, liens locaux et conservation des fichiers signés contrôlés |
| Vocabulaire technique | Explication opérationnelle auprès du cas d’entrée ; détails techniques accessibles | Termes compris ou mal compris à consigner pendant les séances |
| Validation de valeur | Protocole recentré sur la tâche UNKNOWN et fiche de résultats vierge | Aucun participant observé ni gain chiffré établi |

## Constat sur l’archive actuelle

L’archive locale `TENIR-REG-demo.zip` examinée avant ce lot, issue du commit `09f075bc2c35093d4d92d2d940b21e3eb9768aeb`, contient **143 fichiers, 1 032 687 octets compressés et 4 072 859 octets décompressés**. Elle n’inclut ni `.git`, ni temporaires, ni FFmpeg. Elle contient neuf petits fichiers de `.deps/rfc8785` et de ses métadonnées.

La description d’une archive avec un binaire de 87,6 Mo n’est donc pas reproduite sur ce paquet local. Le rapprochement avec une archive antérieure reste indéterminé. La séparation des kits reste utile : la consultation ne demande pas d’environnement Python ; le kit développeur installe ses dépendances déclarées.

Les nouveaux paquets sont produits par `package_demo.py`. Leur manifeste d’inventaire est **non signé** ; les EvidenceRecords et le reçu d’origine conservent leurs signatures et leurs octets. Le manifeste d’emballage n’ajoute aucune attestation d’exécution.

## Ordre des prochains travaux

1. Observer trois personnes du public cible découvrant l’outil, dont une sur téléphone réel, avec [le protocole](USER_WALKTHROUGH.md). Relever compréhension, temps, erreurs et besoin d’aide.
2. Ajuster le parcours à partir de ces constats et vérifier la place du livrable dans le travail de l’équipe.
3. Définir les contrats de paramètres, de budget et d’état avant une simulation créant de nouvelles traces. La comparaison statique 5.6.1/5.7 ne remplace pas ce contrat.
4. Pour une intégration réelle, choisir un seul cas puis éprouver identité, persistance, reprise et rapprochement. Les audits du runtime suivent leur propre processus ; ce démonstrateur utilise un moteur local distinct.

Les préférences de thème ne sont pas modifiées sur la seule base d’une recommandation éditoriale. Une offre de diagnostic accompagné reste une hypothèse à éprouver, sans engagement commercial ni validation de volonté de payer.
