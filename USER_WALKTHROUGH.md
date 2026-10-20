# Parcours utilisateur observé — protocole pilote

**Statut : À RÉALISER.** Ce document prépare une séance de 15 à 20 minutes avec une personne qui découvre TENIR/REG. Il ne contient aucun résultat utilisateur. Le rendu dans un navigateur, l'usage sur téléphone et l'observation de participants restent à réaliser. Les contrôles automatisés du DOM ne remplacent pas ces observations.

L'accès automatisé au navigateur local a été refusé par la politique de l'outil dans cette session. Aucun serveur, autre navigateur ou procédé de contournement n'a été utilisé. Ce protocole est destiné à une séance menée par une personne autorisée à ouvrir les fichiers locaux.

## Préparer une séance

- Faire générer et vérifier le dossier avant la séance avec `run.ps1 all`, puis `run.ps1 verify`. Conserver la version ou le commit testé et la date de génération ; ne pas régénérer les preuves pendant la séance.
- Ouvrir `index.html` sur une nouvelle session de navigation, sans scénario ni configuration déjà mémorisés. Noter tout contexte conservé si une nouvelle session n'est pas possible.
- Prévoir un ordinateur ou un téléphone, une feuille de notes et un chronomètre. Noter appareil, navigateur, dimensions de fenêtre, langue et thème. Une largeur simulée de 390 px ne vaut pas un essai sur téléphone réel.
- Choisir une personne sans connaissance préalable de la démo. Prévoir un premier pilote avec trois novices, dont au moins un sur téléphone réel ; consigner chaque séance séparément. Cet échantillon sert à repérer des obstacles, sans établir un taux de réussite représentatif.
- Utiliser un identifiant de participant, sans demander de données métier ou personnelles. Demander son accord avant tout enregistrement ; les notes seules suffisent.

## Consigne à lire au participant — 1 minute

« Nous évaluons l'interface. Vous pouvez vous tromper, revenir en arrière ou arrêter. Faites les tâches à votre manière et dites à voix haute ce que vous cherchez, ce que vous comprenez et ce qui vous étonne. Je vous laisse essayer sans vous expliquer les écrans. Les données de cette démonstration sont fictives. »

Ne pas présenter la logique des scénarios ni montrer les chemins avant les tâches. Lire uniquement les consignes de la colonne centrale ci-dessous. Les critères d'évaluation sont réservés à l'observateur.

## Tâches à proposer — 14 à 16 minutes

| ID | Consigne au participant, sans démonstration préalable | Durée indicative |
|---|---|---|
| T1 | Vous découvrez cet outil. Expliquez en une phrase à quoi il pourrait vous servir, puis trouvez un exemple où l'action demandée a abouti. | 2 min |
| T2 | Dans cet exemple, racontez comment on passe de la question posée au résultat présenté. Montrez ce qui vous permet de justifier votre explication et ce que vous ne pouvez pas conclure avec cette page. | 3 min |
| T3 | Trouvez maintenant le cas dont l'issue reste inconnue. Expliquez ce qui a été décidé, ce qui a été envoyé, ce qui est confirmé et ce qu'il faudrait faire ensuite. Diriez-vous qu'il suffit de relancer la même demande ? Pourquoi ? | 3 min |
| T4 | Choisissez une affirmation affichée sur le budget ou le résultat de ce cas. Retrouvez la donnée d'origine qui la soutient. Montrez ensuite une explication de contexte et dites si elle a le même statut que cette donnée. | 3 min |
| T5 | Depuis ce cas, retournez à la configuration, consultez une autre étape, puis reprenez le cas que vous lisiez. Dites ce qui a été conservé et vérifiez-le. | 2 min |
| T6 | Retrouvez le budget au moment de l'exemple où l'action a abouti, puis le budget à la fin du dossier. Relevez les deux états et expliquez pourquoi ils peuvent différer. | 2 min |

À deux minutes de la fin, interrompre une tâche longue sans la déclarer réussie. Noter l'endroit atteint et passer à la synthèse. Une tâche non commencée reste « non testée ».

### Si le temps le permet, choisir une seule tâche supplémentaire

- **Configuration incompatible :** « Explorez un autre périmètre jusqu'à rencontrer une incompatibilité. Expliquez le problème, appliquez une proposition, puis retrouvez votre choix précédent. »
- **Profil hors prototype :** « Trouvez une configuration acceptable selon les règles mais que cette démo n'exécute pas. Comment poursuivriez-vous sans perdre ce choix ? »
- **Préférences :** « Changez de langue et de thème, puis retrouvez le même cas. Qu'est-ce qui devrait avoir changé dans ses données ? Vérifiez votre réponse. »

Ne pas additionner les résultats de tâches supplémentaires différentes comme s'il s'agissait du même parcours.

## Observer sans donner la réponse

Chronométrer chaque tâche dès la fin de sa lecture. Noter le premier clic, le chemin emprunté, les retours en arrière, les termes recherchés et une courte citation du participant. Laisser environ 30 secondes de recherche avant une relance neutre : « Qu'essayez-vous de trouver ? » Ne pas nommer un bouton ni confirmer une interprétation pendant la tâche.

Une hésitation est un arrêt de recherche d'au moins 10 secondes, une boucle de navigation ou une incertitude exprimée ; noter sa durée et son contexte. Une erreur est une action ou une conclusion incompatible avec la tâche ou la preuve observée. Un retour volontaire pour vérifier n'est pas automatiquement une erreur.

Si la personne demande de l'aide, noter la demande avant de répondre. Employer au plus une relance neutre ; si elle reste bloquée, proposer d'abandonner la tâche ou lui montrer le chemin, en classant alors la réussite comme assistée. L'assistance ne transforme pas une tâche en réussite autonome.

| Code | Résultat observable |
|---|---|
| RA | Réussite autonome : objectif atteint et expliqué correctement, sans indication de destination ni de réponse |
| RA-H | Réussite autonome avec hésitation : même critère, avec une ou plusieurs hésitations consignées |
| A | Réussite assistée : chemin ou interprétation obtenu après une aide orientant la réponse |
| E | Échec : abandon, délai atteint ou conclusion erronée non corrigée pendant la tâche |
| NT | Non testée : tâche non commencée ou séance interrompue avant sa présentation |

Consigner séparément la relance neutre, même si elle ne fournit pas d'information. Le classement final doit permettre de distinguer une réussite immédiate d'une réussite après relance.

## Critères pour l'observateur — ne pas lire avant les tâches

| Tâche | Preuve de réussite attendue |
|---|---|
| T1 | La personne décrit une utilité plausible et ouvre le cas d'autorisation. Elle ne présente pas la consultation comme une nouvelle opération chez un fournisseur réel. |
| T2 | Elle relie les étapes de lecture aux données disponibles ; distingue le contexte explicatif des champs de preuve ; ne déduit pas une conformité générale ou une exécution réelle à partir de la seule signature locale. Une étape non renseignée doit être reconnue comme telle. |
| T3 | Elle distingue le verdict historique autorisant l'envoi du résultat non confirmé après envoi. Elle constate l'appel et la réservation conservée, explique le besoin de rapprochement et n'invente pas une résolution automatique ou une confirmation. |
| T4 | Elle ouvre le record et retrouve un champ qui soutient réellement son affirmation. Elle distingue une valeur enregistrée dans le payload signé d'un commentaire documentaire ou d'une explication de lecture. Elle comprend qu'une signature locale ne démontre pas la vérité d'un effet externe. |
| T5 | Le retour conserve le cas sélectionné, le choix de configuration et l'étape consultée. La personne vérifie les valeurs ou les libellés, sans s'appuyer seulement sur sa mémoire du chemin. |
| T6 | Elle distingue l'état budgétaire lié à la preuve sélectionnée du solde final du dossier et identifie correctement les unités et la portée des compteurs. Elle ne décrit pas les compteurs cumulés comme les seuls appels du scénario. |

Pour le dossier de référence actuel, le cas confirmé comporte 20 000 unités consommées, aucune réservation conservée et un appel cumulé. À la fin du dossier : 20 000 consommées, 10 000 réservées, 40 000 disponibles et deux appels cumulés. **Contrôler ces valeurs dans le dossier vérifié utilisé pour la séance ; ce sont des repères d'observation, pas des réponses à communiquer au participant.**

## Feuille de résultats — vierge

Statut de la séance : **NON RÉALISÉE**  
Participant : — · Date : — · Observateur : — · Commit/version : —  
Dossier généré le : — · Vérification du dossier : —  
Appareil réel : — · Navigateur : — · Fenêtre : — · Langue/thème initiaux : —  
Contexte mémorisé au départ : — · Accord d'enregistrement, si applicable : —

| Tâche | Code RA / RA-H / A / E / NT | Durée | Hésitations : nombre/durée | Erreurs/conclusions incorrectes | Relance/aide fournie | Chemin, citation et constat vérifié |
|---|---|---|---|---|---|---|
| T1 | — | — | — | — | — | — |
| T2 | — | — | — | — | — | — |
| T3 | — | — | — | — | — | — |
| T4 | — | — | — | — | — | — |
| T5 | — | — | — | — | — | — |
| T6 | — | — | — | — | — | — |
| Supplément, préciser : — | — | — | — | — | — | — |

Fin de séance — 2 minutes : « Qu'est-ce qui vous a le plus ralenti ? Quel mot ou écran changeriez-vous ? À quel moment avez-vous eu confiance dans votre interprétation, et pourquoi ? » Recueillir les réponses avant de montrer les chemins attendus. Séparer les préférences déclarées des comportements réellement observés.

## Décider après le pilote

Le protocole est réussi pour une séance lorsque les six tâches sont réalisées et correctement expliquées sans aide orientant la réponse ; une hésitation reste un constat à traiter. Pour accepter le parcours au terme du pilote :

- aucun participant ne conserve une confusion critique entre PASS et confirmation, entre rejeu et nouvel envoi, ou entre contenu signé et contexte documentaire ;
- T3, T4 et T6 sont réussies de façon autonome par chaque participant ;
- au moins deux des trois novices terminent T1 à T6 sans aide orientant la réponse et dans la séance de 20 minutes ;
- aucun blocage de navigation, perte de contexte ou contrôle inaccessible ne subsiste sur l'appareil testé.

Une tâche non testée ne compte pas comme une réussite. Avec moins de trois séances complètes ou sans essai sur téléphone réel, la validation pilote reste **incomplète**. En cas d'échec, consigner l'obstacle, sa gravité, la modification proposée et une nouvelle séance à prévoir ; ne pas remplacer l'observation manquante par les tests automatisés. Ces critères sont des seuils de décision pour ce pilote, pas une mesure générale d'intuitivité.

**Bilan actuel : protocole préparé ; aucune séance, mesure d'utilisabilité ni validation visuelle revendiquée.**
