# Revue UI/UX du démonstrateur TENIR/REG

## Objectif et méthode

Revue du parcours complet : première visite, configuration, bilan des règles, lecture des scénarios et examen des preuves. Le code et les interactions des pages générées ont été examinés ; la vidéo fournie `tenir_language_theme_and_mobile.mp4` a été décodée et plusieurs images inspectées pour comprendre la direction du futur site.

La révision reprend son monogramme encadré, ses titres avec empattements, ses tons sobres, ses thèmes clair/sombre et ses commandes de langue visibles. Les pages restent locales et ne nécessitent aucune police ni ressource distante.

L'accès navigateur local ayant été refusé par la politique de l'outil, les contrôles portent sur les scripts réels des pages dans un DOM de test. Ils ne constituent pas une observation du rendu, un essai avec lecteur d'écran ou une étude auprès d'utilisateurs.

## Parcours principal livré

1. **Accueil** : comprendre le but, situer les cinq couches, puis choisir le parcours guidé ou un exemple autorisé.
2. **Configuration** : conserver le profil local présélectionné ou explorer les quatre choix. Le bilan court et les erreurs restent près du champ courant.
3. **Fin des choix** : « Examiner ma configuration » ouvre les règles ; le parcours ne se termine plus sur un bouton désactivé.
4. **Bilan** : distinguer les clauses satisfaites, violées et non applicables, puis la prise en charge par le moteur local. Une action explique comment poursuivre.
5. **Scénarios** : parcourir autorisation, blocage, attente et issue inconnue. Lire séparément la décision avant envoi et le résultat du simulateur.
6. **Preuve** : ouvrir le record signé ou les pièces de vérification. Les tests et détails d'audit sont repliés par défaut.
7. **Retour** : retrouver le scénario, la configuration, l'étape et le choix avant correction. L'annulation du dernier changement automatique circule également entre configuration et rapport.

La lecture des preuves comporte désormais huit étapes interactives. Une source ouvre sa valeur exacte, le chemin JSON Pointer, la séquence et l'empreinte du record. L'explication reste marquée hors EvidenceRecord ; les métadonnées de signature ont un libellé distinct. La langue conserve l'étape et la source ; le changement de scénario reprend au début. Les événements de réservation et de résultat restent consultables séparément.

## Exceptions et sorties

| Situation | Information présentée | Sortie disponible |
|---|---|---|
| Configuration incompatible | Toutes les clauses concernées, explication associée au champ et corrections minimales | Modifier le champ, appliquer une correction, annuler ce changement ou exporter le brouillon |
| Configuration admissible hors prototype | Admissibilité distincte du support d'exécution | Conserver/exporter le choix ou adopter explicitement le profil local ; changements annoncés et annulables |
| Consultation du rapport depuis un autre profil | Profil réellement exécuté et message indiquant que la sélection est conservée pour le retour | Consulter l'archive locale puis revenir au choix exploré |
| Preuves indisponibles ou recette en échec | Accès aux scénarios désactivé ; dossier à régénérer | Continuer à examiner les règles ou exporter la configuration |
| Veto | Cause du blocage, absence d'envoi et d'effet sur le budget | Lire le motif et la recommandation de correction ; comparer le scénario suivant |
| Attente avant envoi | Observation indispensable absente ; aucune action envoyée | Comprendre l'observation requise avant une nouvelle évaluation |
| UNKNOWN après envoi | PASS historique, appel envoyé, résultat non confirmé et réservation conservée | Comprendre le besoin de rapprochement ; aucun bouton ne promet une reprise ou une résolution automatique |
| Stockage local refusé | Navigation configuration/rapport portée par des paramètres validés | Recharger ou revenir sans perdre le contexte porté par le lien |
| Modification après correction | Le choix avant correction reste consultable ; une modification manuelle retire l'ancienne annulation | Annuler immédiatement un changement automatique sans effacer des modifications manuelles ultérieures |

## Corrections transversales

- Navigation commune : Accueil, Configuration, Scénarios & preuves ; marque reliée à l'accueil.
- Boutons FR et EN visibles ; langue et thème partagés lorsque le stockage est autorisé.
- Tailles des textes opérationnels et des commandes augmentées ; commandes principales d'au moins 44 px ; dispositions adaptées aux petits écrans et au mouvement réduit.
- Erreurs reliées aux champs par `aria-describedby`, états textuels, annonces courtes et focus sur la destination après une action de progression.
- Actions nommées selon leur destination ; le rapport est explicitement une lecture de scénarios déjà exécutés.
- Compteurs issus de l'événement signé sélectionné. Changer de scénario, de langue ou de thème ne provoque pas d'appel supplémentaire et ne réécrit pas les preuves.

## Vérification reproductible

```powershell
.\run.ps1 all
node tests/check_configurator.cjs output/configurator.html
node tests/check_report.cjs output/report.html
node tests/check_journey.cjs output
node tests/check_landing.cjs
node tests/check_theme.cjs output
node tests/check_proof_loop.cjs output
node tests/check_alignment.cjs output
.\run.ps1 verify
```

Les contrôles couvrent les 144 configurations, les 1 008 statuts de clause, le chemin guidé, les exceptions, les corrections et leur annulation, les retours, le rechargement, le stockage refusé, les langues, les thèmes et l'intégrité des données signées. Les rapports de test décrivent leurs propres limites. Le contrôle de palette calcule le contraste des principales paires de couleurs ; il ne remplace pas une mesure du rendu complet.

## Validation utilisateur encore ouverte

Faire un passage sur ordinateur et sur téléphone, notamment à 390 × 844, avec les tâches suivantes :

1. Trouver le point de départ et expliquer l'utilité du démonstrateur.
2. Terminer les quatre choix et trouver le scénario autorisé sans assistance.
3. Provoquer une incompatibilité, comprendre le champ concerné, appliquer puis annuler une correction.
4. Expliquer pourquoi une architecture admissible peut rester hors du moteur local.
5. Distinguer attente avant envoi et UNKNOWN après envoi ; retrouver la réservation et l'appel correspondant.
6. Inspecter la preuve puis revenir au même scénario après une modification de configuration.

Mesurer réussite, hésitations, erreurs et besoin d'assistance. La présente révision améliore les obstacles identifiés ; aucun score d'intuitivité ou taux de réussite utilisateur n'est encore établi.

Le [protocole de séance](USER_WALKTHROUGH.md) fournit les consignes, les critères pour l'observateur et une grille vierge ; son statut reste « à réaliser ».

## Diagnostic d’alignement des références

Le configurateur et le rapport montrent une synthèse visible, puis des détails repliables : comparaison exhaustive des 144 configurations/1 008 résultats de clause, sept contrats, neuf invariants, quatre rapprochements de scénario et sources épinglées. La synthèse distingue la concordance structurelle de la compatibilité d’exécution non vérifiée. Les écarts de budget, de reprise UNKNOWN et de numérotation sont sourcés. Les explications restent documentaires. Les contrôles de langue et de thème couvrent ce panneau ; sa lisibilité réelle et son usage sur mobile restent à observer.

## Révision après l’évaluation reçue

L’entrée passe par l’incident UNKNOWN pour un atelier de diagnostic destiné aux équipes techniques. Les autres usages et les cinq couches restent accessibles par des détails natifs. L’ouverture directe du configurateur conserve un fragment vide et ne demande aucun focus ; les destinations explicitement choisies conservent leurs ancres et leur contexte. Deux kits séparent consultation et développement. Une fiche vierge rend le livrable d’atelier explicite.

La revue externe reçue rapporte des captures et essais ; ils sont conservés comme témoignage de cette revue, sans être assimilés à une validation visuelle de la nouvelle version. Aucune nouvelle mesure de hauteur mobile, séance utilisateur ou conclusion d’accessibilité complète n’est revendiquée. Les actions et leur statut sont décrits dans [REVIEW_ACTIONS.md](REVIEW_ACTIONS.md).
