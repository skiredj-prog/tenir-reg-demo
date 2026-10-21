# REG — Hidden Assumptions Challenge
**Le crash test de vos décisions, avant que leurs hypothèses ne deviennent des incidents.**

> **Your API may be idempotent. Is your business effect?**

## Vous comptez sur un comportement. Sur quoi repose-t-il vraiment ?
Votre politique décrit ce qui devrait se passer. Votre système implémente un mécanisme. Entre les deux, des hypothèses rarement discutées peuvent invalider le résultat attendu : intervention humaine trop tardive, rejeu d'une opération déjà exécutée, autorisation liée à un résumé plutôt qu'à la charge utile, condition d'arrêt contournée par un chemin de secours.

**REG révèle ces dépendances critiques avant que vous ne fondiez une décision dessus.**

## Le Challenge
En **4 à 7 jours ouvrés**, soumettez **une affirmation comportementale précise** à une épreuve contradictoire, sans installation de logiciel ni accès obligatoire au code ou à la production.

**Exemples d'affirmations :**
- « Notre dispositif permet à un humain d'arrêter l'opération avant son effet. »
- « Un timeout et un retry ne peuvent pas déclencher un second paiement. »
- « Notre suspension empêche toute nouvelle opération protégée. »

**Méthode (sur informations déclarées)**
1. **Cadrer** — 45 minutes : comportement revendiqué, frontières d'effet, hypothèses et sources de référence pertinentes. Le client peut fournir un schéma ou un ADR expurgé ; aucun accès système n'est requis.
2. **Challenger** — REG confronte le comportement aux dépendances adjacentes et aux hypothèses de temps, identité, état, délégation, résilience et preuve.
3. **Contraster** — Identifier contradictions explicites, hypothèses indéterminées et exemples conditionnels de défaillance ; proposer les clarifications minimales.
4. **Décider** — Rapport court, diagramme annoté et restitution de 45 minutes : que confirmer, restreindre, tester ou modifier.

## Vous recevez
- **Carte des hypothèses invisibles** : dépendances classées par importance pour la décision et incertitude (pas un score de conformité).
- **2–3 scénarios conditionnels de rupture** : comment le comportement *pourrait* être invalidé si une hypothèse manque ; faits déclarés distingués des inférences.
- **Invariants candidats** : conditions testables à traduire, valider et éventuellement implémenter — pas du code certifié ni une garantie de correction.
- **Decision Brief** : questions qui changent la décision, prochaines vérifications, limites et déclencheurs de réévaluation.
- **Traçabilité** : références exactes des cadres choisis, avec distinction loi/norme/recommandation et applicabilité à confirmer.

## Formules pilotes (tarifs à tester, HT)
| | **Focused Challenge** | **Extended Challenge** |
|---|---|---|
| Périmètre | 1 comportement / 1 workflow | Jusqu'à 2 comportements liés ou 2 workflows |
| Références | Jusqu'à 3 textes ciblés | Jusqu'à 5 textes ciblés |
| Délai cible* | 4–5 jours ouvrés | 6–7 jours ouvrés |
| Restitution | 45 min | 60 min |
| Prix test | **2 500 € HT** | **5 000 € HT** |

*Après validation du cadrage et réception des informations nécessaires. Les référentiels servent de points d'entrée ; aucune interprétation juridique exhaustive n'est incluse.*

## Notre engagement
**Pas de fausse découverte.** Si aucune contradiction ni hypothèse réellement décisionnelle ne ressort du périmètre examiné, le rapport le dira expressément. Nous proposons alors **un second comportement du même périmètre, sans honoraires supplémentaires**, plutôt que d'inventer une faille pour justifier la facture. Le périmètre additionnel est convenu avant travail.

## Sans friction
- Zéro installation et aucun accès obligatoire à l'infrastructure ou au code.
- Analyse à partir d'affirmations et de schémas déclarés, éventuellement expurgés.
- Confidentialité contractuelle / NDA lorsque nécessaire, avant réception de données sensibles.
- **REG est un service autonome.** Intégration éventuelle dans un workflow/CI, ou contrôle runtime TENIR-Gov, uniquement sur demande et dans une mission distincte.

## Ce que nous ne prétendons pas
Pas d'audit de capacités, de test de pénétration, de validation effective du fonctionnement, d'avis juridique, de certification réglementaire, ni d'autorisation de production. **La cohérence des hypothèses ne prouve pas leur vérité opérationnelle.**

**Prochaine étape : 20 minutes pour choisir le comportement à challenger.**

REG — **Read. Evaluate. Guard.**  
*Guard against the invisible. Focus on the intelligent.*

---
Document commercial **candidat** · Prix, délais et promesse à valider auprès de prospects · Aucune publication autorisée par ce document.
