# Consulter le démonstrateur TENIR/REG

Ce kit sert à comprendre une configuration, une décision et sa preuve. Il contient des pages déjà générées : **aucune installation, commande ni régénération n'est nécessaire pour les consulter**.

## Ouvrir le kit de consultation

1. Extrayez entièrement `TENIR-REG-consultation.zip` dans un dossier. Conservez ensemble `index.html`, `output/`, `references/` et les guides.
2. Ouvrez **[index.html](index.html)** dans votre navigateur, puis l'incident **UNKNOWN**. Vous pouvez aussi [ouvrir directement cette trace](output/report.html?scenario=issue-inconnue#proof-loop).
3. Distinguez l'autorisation historique **PASS** du résultat **UNKNOWN** : un appel a été enregistré, son issue n'est pas confirmée et la réservation est conservée. L'autorisation d'envoyer ne confirme pas le résultat.
4. Dans la **boucle de preuve**, choisissez l'exécution ou la connaissance, puis une source : vous retrouvez la valeur exacte, son record et son empreinte. Comparez aussi le budget du contrôle initial à celui qui suit la réservation.
5. Examinez ensuite les contrôles : ouvrez **Configuration**, conservez d'abord le profil local, terminez les quatre choix et lisez **Règles & périmètre**. Vous pouvez explorer une autre architecture ou comparer les trois autres scénarios, puis revenir à l'incident et à la source consultée.

Les commandes **FR/EN** et **Mode clair/Mode sombre** adaptent la présentation. Les liens entre configuration et rapport conservent le scénario, les choix et la source consultée. Les données signées conservent leur langue et leurs valeurs d'origine.

## Ce que vous pouvez examiner

- **Un incident incertain** : comprendre pourquoi UNKNOWN conserve la réservation et pourquoi la décision historique PASS n'est pas une confirmation de résultat.
- **Une décision et ses exceptions** : comparer ensuite un refus avant envoi et une observation manquante à l'issue inconnue après envoi.
- **Les sources d'une preuve** : ouvrir la valeur exacte, son chemin JSON, sa séquence et l'empreinte du payload ; distinguer commentaire documentaire, champ signé et métadonnée de signature.
- **Un choix d'architecture** : comprendre les incompatibilités parmi 144 sélections, appliquer puis annuler une correction et exporter un brouillon de configuration non signé. L'accueil situe ces choix dans cinq couches d'architecture.
- **Les limites et références** : lire la concordance structurelle et les écarts avec la base TENIR 5.6.1, cible 5.7. La compatibilité d'exécution reste non vérifiée.

Choisir un scénario relit une trace déjà exécutée. **Cela ne renvoie aucune action**, ne modifie aucun compteur signé et ne résout pas UNKNOWN. Aucun paiement, quota d'API ou changement d'infrastructure réel n'est effectué.

Pour préparer un échange, utilisez le [diagnostic d'atelier](DIAGNOSTIC_ATELIER.md). Le [README](README.md) développe les usages, les livrables et les instructions techniques. Les [actions de revue](REVIEW_ACTIONS.md) distinguent les corrections réalisées et les limites encore ouvertes.

## Consultation et vérification sont deux opérations distinctes

L'affichage des champs dans le navigateur permet leur examen. La vérification cryptographique s'effectue avec le **kit développeur**, qui contient le vérificateur et `requirements.txt` :

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe verify.py output --public-key output/evidence.public.pem
```

Cette commande vérifie le dossier existant sans lancer le moteur. Pour vérifier l'identité du signataire, la clé publique ou son empreinte doit être reçue par un canal de confiance. Les clés présentes sont celles d'un prototype local.

Le dossier conserve les huit fichiers couverts par le reçu signé et le reçu lui-même, octet pour octet. `PACKAGE_MANIFEST.json` décrit l'inventaire et les empreintes du kit ; **ce manifeste de distribution est non signé** et ne constitue pas une certification.

## Choisir le bon kit

| Kit | Contenu et usage |
|---|---|
| `TENIR-REG-consultation.zip` | Accueil, pages générées, dossier de preuve, guides et références documentaires. Ouvrir `index.html` pour présenter ou examiner la démo. Les copies de sources Python dans `references/` servent uniquement à la provenance statique. |
| `TENIR-REG-developer.zip` | Même dossier, plus sources du projet, tests, fixtures, scripts et dépendances déclarées. Installer les dépendances pour vérifier, tester ou régénérer. Aucun environnement installé, cache, répertoire Git ou binaire d'exécution n'est inclus. |

Pour produire les deux kits depuis le projet développeur, après une génération vérifiée :

```powershell
python package_demo.py --output dist
```

L'empaquetage refuse un dossier invalide ou des sources qui ne correspondent plus à la recette signée. Il ne régénère ni ne resigne les preuves. Les archives sont reproductibles pour les mêmes fichiers et le même outil de compression ; leurs entrées ont des dates fixes et un ordre stable.
