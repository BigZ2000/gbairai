# GAMEPLAY_AUDIT_REPORT — GBAIRAI
**Date de l'audit** : 2026-06-05  
**Méthode** : lecture exhaustive du code source réel (aucune supposition)

---

## Légende des statuts

| Symbole | Signification |
|---|---|
| ✅ | Fonctionnel, vérifié dans le code |
| ⚠️ | Fonctionne mais avec réserve / limitation connue |
| 🔴 | Trou fonctionnel ou bug avéré dans le code |
| ❓ | Ambiguïté / décision produit ouverte |
| 📌 | Constaté dans le code — non jugé |

---

## PARTIE 1 — INVENTAIRE RÉEL

### 1.1 Les trois modes (tels qu'ils existent en base)

| Mode | Flag DB | Créé via |
|---|---|---|
| **Animateur** | `modeAuto=false, modeVote=false, animateurId=userId` | Dashboard → pack → mode Animateur |
| **Automatique** | `modeAuto=true` | Dashboard → pack → mode Auto |
| **Vote collectif** | `modeVote=true` | Dashboard → pack → mode Vote |

> 📌 Il n'existe PAS de route de création de partie "libre" (sans pack) dans le code actuel. Toutes les parties passent par `POST /api/packs/:packId/start`. Les routes `parties.js` gèrent la salle d'attente, le lancement, et la gestion des participants, mais pas la création initiale.

### 1.2 Statuts d'une partie
`EN_ATTENTE → EN_COURS → TERMINEE | ANNULEE`

### 1.3 Quotas de joueurs (✅ vérifié `plans.js`)
| Plan | Max joueurs |
|---|---|
| FREE | 20 |
| PRO | 100 |
| ENTREPRISE / ECOLE | Illimité |

---

## PARTIE 2 — WORKFLOWS DÉTAILLÉS

### 2.1 Mode Animateur

#### Workflow complet
```
1. Hôte choisit un pack sur le Dashboard
2. Choisit le mode "Animateur" + optionnel "Je joue aussi"
3. POST /api/packs/:id/start → crée Partie (animateurId=userId), crée les manches,
   tire les questions → Participant animateur créé (isAnimateur=true si MAÎTRE,
   isAnimateur=false si "animateurJoue=true")
4. SalleAttente : les joueurs rejoignent via QR/code
5. Hôte clique "Lancer" → POST /api/parties/:id/start
   → status=EN_COURS, broadcast game_started + question_display[0] + media_state
6. BOUCLE question :
   a. EcranPrincipal : affiche enoncé (+ choix QCM, ou media IMAGE/AUDIO/VIDEO)
   b. JoueurJeu : bouton BUZZ prêt (armed=true)
   c. Un joueur buzze → broadcast buzzer_winner à tous
   d. AnimateurJeu : boutons Bonne / Mauvaise apparaissent
   e. Animateur valide → broadcast answer_validated + points calculés
      • Si bonne → buzzLocked, score incrémenté, pas de nouveau buzz
      • Si mauvaise → buzz_reopened, autres joueurs peuvent buzzer ("vol")
   f. Animateur clique "Révéler" → broadcast question_reveal (reponse + explication)
   g. Animateur clique "Suivant" → goToNextQuestion
7. Après la dernière question → endGameInternal → classement final
```

#### Questions sur l'animateur
- **L'animateur joue-t-il ?** ❓ Configurable à chaque lancement (toggle « Je joue aussi »).
  - `animateurJoue=false` (défaut) → `isAnimateur=true` → **EXCLU du classement** (🔴 mais voulu)
  - `animateurJoue=true` → `isAnimateur=false` → participant normal, **COMPTÉ au score**
- **Peut-il gagner ?** ✅ Si `animateurJoue=true`, oui. Son score est compté et il figure au podium.
- **Est-ce cohérent ?** ⚠️ Pour le présentiel « quiz animé » il est maître (non joueur) ; pour famille/entreprise/école il joue aussi. Le toggle existe et fonctionne. Mais il n'est proposé **que pour le mode Animateur** (les modes Auto et Vote ne proposent pas ce toggle, le créateur est implicitement joueur).
- **Problèmes identifiés** :
  - En mode Animateur, si l'animateur est MAÎTRE (`isAnimateur=true`) et buzze quand même par erreur (via simulateur/téléphone), le buzz est traité normalement par le serveur mais le participant est filtré du classement → **score nul mais pas de blocage côté serveur**. ❓
  - En mode Vote, l'animateur MAÎTRE peut voter sur la réponse du buzzeur (aucun guard côté serveur sur isAnimateur pour submit_vote). ❓

---

### 2.2 Mode Automatique

#### Workflow complet
```
1. Lancement → même que mode Animateur, sauf : modeAuto=true, animateurId=null (ou créateur)
2. Pour chaque question :
   a. broadcast question_display + chronomètre serveur
   b. Les buzzers physiques passent en LED « armé »
   c. SI question à choix (QCM / VRAI_FAUX) :
      - JoueurJeu affiche AnswerPad (boutons de réponse)
      - Le joueur sélectionne → submit_answer → serveur stocke (answer, ms)
      - Dès que TOUT LE MONDE a répondu OU que le timer expire → doReveal
      - scoreAutoQuestion : compare normalizeAnswer(a.answer) === normalizeAnswer(q.reponse)
        (texte brut, pas de lettre A/B/C/D) → les joueurs corrects gagnent des points
   d. SI question ouverte (BUZZER sans choix, ou IMAGE/AUDIO/VIDEO non QCM) :
      - JoueurJeu affiche "👀 Regarde l'écran" (PAS de bouton buzz)
      - Aucun score attribué à personne — question révélée par le timer
      - 🔴 Trou fonctionnel : question "d'observation" sans enjeu de score
3. doReveal → broadcast question_reveal → scheduleAdvance (3 s) → goToNextQuestion
4. Fin : endGameInternal, classement
```

#### Questions spécifiques
- **Qui valide ?** ✅ Le serveur. Comparaison texte normalisée (accents, casse, espaces).
- **Buzz en mode auto ?** ✅ **Bloqué au niveau serveur** (`if (partie.modeAuto) return`).
- **Comment le serveur sait que c'est correct ?** ✅ `normalizeAnswer(a.answer) === normalizeAnswer(q.reponse)`. **Fonctionne uniquement si `reponse` est le texte du bon choix**, pas une lettre.
- **Ambiguïté `reponse` = texte ou lettre ?** 🔴 Voir §5 (bug critique QCM).

---

### 2.3 Mode Vote Collectif

#### Workflow complet
```
1. Lancement → modeVote=true, animateurId=null (créateur non animateur)
2. Boucle question :
   a. question_display → LED « armé »
   b. JoueurJeu : bouton BUZZ prêt (armed=true). Même comportement qu'en mode Animateur.
   c. Un joueur buzze → buzzer_winner diffusé à tous
   d. Les AUTRES joueurs voient le panel de vote (Bonne / Mauvaise)
      - Le buzzeur lui-même ne peut pas voter (guard côté serveur + côté client)
      - Le Maître (isAnimateur=true) peut voter ❓ (pas de guard)
   e. L'AnimateurJeu (= créateur) voit AUSSI les boutons de vote (handleVote)
      et peut voter (myParticipant?.id utilisé) ❓
   f. Dès que tous les joueurs attendus ont voté (expectedVoters = participants
      - isAnimateur=false - buzzeur), le serveur tranche :
        • majorité POUR → buzzeur gagne points, votants POUR gagnent 30 % de bonus
        • majorité CONTRE → personne ne gagne, votants CONTRE gagnent 30 %
   g. broadcast question_reveal + vote_result → auto_next_question (4 s)
   h. goToNextQuestion (sans action manuelle de l'hôte)
3. Fin automatique au bout des questions
```

#### Questions spécifiques
- **Qui décide ?** ✅ La majorité des participants (hors buzzeur).
- **Peut-on manipuler le vote ?** ⚠️ Oui, théoriquement. `upsert` : un participant peut changer son vote tant que le seuil n'est pas atteint. En pratique invisible pour les autres (pas de broadcast "untel a changé d'avis"). Acceptable pour le contexte social du jeu.
- **Que se passe-t-il si personne ne buzze ?** 🔴 Le bouton buzz reste actif indéfiniment. **Aucun timer côté serveur pour forcer l'avancement en mode vote**. La partie peut bloquer si personne ne buzze sur une question.
- **Points si égalité ?** 📌 `pour > contre` → résultat favorable. Égalité = défavorable (strict >). 1 voix de plus suffit.
- **Enchaînement** ✅ 100 % automatique côté serveur après le résultat du vote.

---

## PARTIE 3 — TYPES DE QUESTIONS

### 3.1 Comment le type est utilisé

Le type `QuestionType` (`BUZZER, QCM, VRAI_FAUX, IMAGE, AUDIO, VIDEO`) joue **deux rôles différents** dans le code :

**Rôle 1 — Format de réponse** (détermine ce que le joueur FAIT)
- La réponse est "à choix" si : `q.type === 'QCM' || q.type === 'VRAI_FAUX' || q.choix.length > 0`
- La réponse est "ouverte" si aucune de ces conditions n'est vraie

**Rôle 2 — Format d'affichage** (détermine le média affiché)
- IMAGE/AUDIO/VIDEO → le composant `QuestionMedia` s'affiche
- `hasPlayableMedia(q)` : `type=AUDIO && audioUrl` OU `type=VIDEO && videoUrl`

**Conséquence** : un type `AUDIO` peut avoir des `choix` → il sera affiché avec le composant audio ET les boutons QCM. C'est le seul moyen de faire un "QCM sur extrait audio". ❓ Implicite, jamais documenté dans l'UI.

### 3.2 Workflow par type

| Type | EcranPrincipal | JoueurJeu (auto) | JoueurJeu (animateur/vote) |
|---|---|---|---|
| **BUZZER** | Texte + "Buzzer pour répondre" | 👀 Regarde l'écran (pas de buzz) | Grand bouton BUZZ |
| **QCM** | Texte + 4 cases colorées (A/B/C/D) | AnswerPad (boutons choix) | Grand bouton BUZZ |
| **VRAI_FAUX** | Texte + 2 cases Vrai/Faux | AnswerPad (2 boutons) | Grand bouton BUZZ |
| **IMAGE** | Texte + image centrée | 👀 si aucun choix / AnswerPad si choix | Grand bouton BUZZ |
| **AUDIO** | Texte + visualiseur audio synchronisé | 👀 si aucun choix / AnswerPad si choix | Grand bouton BUZZ |
| **VIDEO** | Texte + vidéo/YouTube synchronisé | 👀 si aucun choix / AnswerPad si choix | Grand bouton BUZZ |

---

## PARTIE 4 — BUG CRITIQUE : COMPARAISON QCM

### 4.1 Constat (code réel)

**Moteur de jeu** (auto, `gameHandler.js`) :
```js
// Comparaison TEXTE
normalizeAnswer(a.answer) === normalizeAnswer(q.reponse)
```
Le joueur envoie le **texte du choix** (ex. `"Paris"`) ; le serveur compare avec `q.reponse`.

**EcranPrincipal** (projection, highlight de la bonne réponse) :
```js
// Comparaison TEXTE robuste ✅
const norm = s => String(s??'').trim().toLowerCase()
const isCorrect = revealed && norm(revealData?.reponse) === norm(c)
```
**EcranPrincipal fonctionne correctement** (compare le texte du choix avec `reponse`).

**QuestionDisplay.jsx** (composant utilisé dans `AnimateurJeu.jsx` si appelé séparément) :
```js
// Comparaison LETTRE ❌
const isCorrect = revealed && question.reponse === LETTER[i] // "A", "B", "C", "D"
```
Si `reponse = "Paris"` → `isCorrect` sera toujours `false` → **aucun choix surligné**.

### 4.2 Impact
| Contexte | Impact |
|---|---|
| Auto mode + `reponse = "Paris"` (texte) | ✅ Score correct, ⚠️ highlight QuestionDisplay cassé |
| Auto mode + `reponse = "A"` (lettre) | 🔴 Score 0 pour tout le monde (personne ne soumet "A") |
| **Animateur mode** | ❌ QuestionDisplay non utilisé pour le jeu → impact limité |

**Verdict** : `QuestionDisplay.jsx` n'est pas utilisé dans le flow de jeu actif. Son bug de lettre n'affecte pas le scoring. Mais si quelqu'un crée une question QCM avec `reponse = "A"` (lettre), le mode auto ne scorera JAMAIS correctement.

**🔴 À corriger** : normaliser la convention `reponse` dans l'admin + QuestionDisplay.

---

## PARTIE 5 — MATRICE MODES × TYPES

> ✅ = jouable correctement | ⚠️ = jouable avec réserve | 🔴 = trou fonctionnel | ➖ = non applicable

| | **Animateur** | **Automatique** | **Vote collectif** |
|---|---|---|---|
| **BUZZER** | ✅ Buzz → validation manuelle → vol possible | ⚠️ Pas de buzz, pas de score → "observation" | ✅ Buzz → vote collectif |
| **QCM** | ⚠️ Joueurs voient les choix sur l'écran, buzzent pour PARLER la réponse (pas de saisie) | ✅ Saisie + score auto | ⚠️ Joueurs voient les choix mais BUZZENT — la réponse est orale, le vote juge |
| **VRAI_FAUX** | ⚠️ Idem QCM — buzz + réponse orale | ✅ Saisie + score auto | ⚠️ Idem QCM |
| **IMAGE** | ✅ Affiche image + buzz | 🔴 Si aucun choix : pas de score | ✅ Affiche image + buzz + vote |
| **AUDIO** | ✅ Sync audio + buzz + contrôle animateur | 🔴 Si aucun choix : pas de score | ✅ Sync audio + buzz + vote |
| **VIDEO** | ✅ Sync vidéo + buzz + contrôle animateur | 🔴 Si aucun choix : pas de score | ✅ Sync vidéo + buzz + vote |

### Observations clés

1. **QCM + Animateur** : incohérence UX. Les joueurs voient les 4 choix sur l'écran mais buzzen pour répondre oralement. Il n'y a pas de saisie de choix en mode animateur. L'animateur valide manuellement. Ce n'est pas faux, mais les joueurs peuvent être déstabilisés (pourquoi les choix s'affichent si je dois buzzer ?).

2. **Médias (IMAGE/AUDIO/VIDEO) + mode auto sans choix** : pas de score possible. "Observation" silencieuse — ni signal, ni action pour les joueurs.

3. **Mode Vote + QCM/VF** : les joueurs voient les choix sur l'écran mais BUZZENT. Le premier qui buzze répond ORALEMENT, la salle vote. La saisie de choix n'est PAS disponible en mode vote. ❓ Serait-il meilleur d'avoir saisie + validation collective ?

---

## PARTIE 6 — ANALYSE DES MÉDIAS

### 6.1 Ce qui est implémenté ✅

| Media | Support | Synchronisation | Notes |
|---|---|---|---|
| **IMAGE** | ✅ Upload local (`/uploads`) | ➖ Pas de lecture à synchroniser | Grande image, `55vh` en projection |
| **AUDIO** | ✅ Upload local + URL externe | ✅ Horloge serveur (baseOffset + startedAt) | Visualiseur animé, tolérance 0.6 s |
| **VIDEO** | ✅ YouTube (`youtu.be/watch/embed/shorts`) | ⚠️ YouTube : rechargement iframe seulement (seek impossible sans API) | Début/fin configurables |
| **VIDEO** | ✅ Fichier local (`/uploads`) | ✅ Horloge serveur | Même synchronisation que l'audio |

### 6.2 Modèle "media = type" vs "media = format"

**Situation actuelle** : IMAGE/AUDIO/VIDEO sont des types de question. Cela force un choix exclusif : une question est SOIT une question BUZZER SOIT une IMAGE. On ne peut pas faire "IMAGE + QCM" directement dans le schéma — sauf si on met des `choix` dans une question de type IMAGE.

**Ce qui marche en pratique** :
- TYPE=IMAGE + `choix` → mode auto : AnswerPad + score ✅
- TYPE=AUDIO + `choix` → mode auto : AnswerPad + score + visualiseur ✅
- TYPE=VIDEO + `choix` → mode auto : AnswerPad + score + vidéo ✅
- TYPE=IMAGE/AUDIO/VIDEO sans `choix` → mode auto : aucune action joueur 🔴

**Ce qui manque** : l'UI de création de questions ne guide pas l'utilisateur vers cette combinaison. Pas de label "QCM sur image" ou "QCM sur extrait audio".

### 6.3 Contrôle animateur des médias ✅

L'animateur peut (hors mode auto) : Play / Pause / Rejouer / Seek. Ces actions sont diffusées à tous les écrans (broadcast `media_state`). Snapshots à la reconnexion. Fonctionne.

---

## PARTIE 7 — ANALYSE DES SCORES

### 7.1 Formule unifiée ✅

```js
questionPoints(q, ms) = round(base × (0.5 + 0.5 × clamp(1 - ms / limitMs, 0, 1)))
```
- `base` = `q.pointsParQ ?? q.points ?? 100` (priorité : paramètre de manche > paramètre de question > défaut)
- `limitMs` = `(q.tempsLimite ?? 30) × 1000`
- Réponse en 0 ms → 100 % des points. Réponse à la limite → 50 %.
- Réponse après la limite : `speed = 0` → 50 % (plancher garanti).

### 7.2 Attribution par mode

| Mode | Buzzeur | Votants | Observateurs |
|---|---|---|---|
| **Animateur** | `questionPoints(q, winnerResponseMs)` si Bonne | 0 | 0 |
| **Auto (choix)** | `questionPoints(q, a.ms)` pour chaque bon répondant | 0 | 0 |
| **Auto (ouvert)** | 0 | 0 | 0 |
| **Vote collectif** | `questionPoints(q, winnerResponseMs)` si majorité POUR | `round(base × 0.3)` si bon vote | 0 |

### 7.3 Mécaniques absentes (non implémentées)

- ❌ Bonus de série (streaks)
- ❌ Malus mauvaise réponse
- ❌ Double points / multiplicateur
- ❌ Question jackpot
- ❌ Mort subite
- ❌ Vol de points (réponse courte + rebuzz = "vol" possible, mais non formalisé comme mécanique)

### 7.4 « Vol » en mode animateur ✅

Si l'animateur valide "Mauvaise", `buzz_reopened` est diffusé → les autres joueurs sont réarmés. Le suivant qui buzze peut répondre. Points = `questionPoints(q, nouveau_responseMs)`. Cela fonctionne. Ce n'est pas documenté/visible pour les joueurs sur l'écran.

---

## PARTIE 8 — ÉLIMINATIONS

### 8.1 Ce qui existe
❌ **Aucun mécanisme d'élimination**. Les joueurs avec score 0 restent en jeu jusqu'à la fin. Il n'existe pas de : round d'élimination, "dernier survivant", duel, seuil de qualification.

### 8.2 Ce qui serait possible sans refactoring majeur

| Mécanique | Faisabilité | Notes |
|---|---|---|
| **Mort subite** (mauvaise réponse = éliminé) | ⚠️ Requiert un état `éliminé` côté serveur + filtrage des buzzers | Techniquement réalisable mais changement de modèle |
| **Top N** (seuls les N premiers qualifiés passent) | ⚠️ Requiert changement de SalleAttente + logique de phases | Plus complexe |
| **Duel** (2 joueurs face à face) | ❓ Possible avec filtrage des participants à chaque question | Logique de sélection à ajouter |
| **Classement intermédiaire** (récap de manche) | ✅ **Déjà implémenté** dans EcranPrincipal via `mancheRecap` | Peut servir de "checkpoint" de qualification |

---

## PARTIE 9 — MODES MASSIFS

### 9.1 Analyse par volume (capacités tech actuelles)

| Joueurs | Mode Animateur | Mode Auto | Mode Vote |
|---|---|---|---|
| **5** | ✅ Idéal | ✅ Idéal | ✅ Idéal |
| **20** | ✅ Fonctionnel | ✅ Fonctionnel | ⚠️ Vote : attendre 19 personnes pour avancer peut être lent |
| **50** | ⚠️ Salle d'attente lisible mais dense | ✅ Chacun répond sur son écran — pas de congestion | ⚠️ Vote : avancement bloqué si quelqu'un ne vote pas |
| **100** | 🔴 Animateur submergé par les buzzers | ✅ Moteur serveur scalable | 🔴 Un seul absent bloque la partie |
| **500** | 🔴 Non jouable (plan FREE limité à 20) | ⚠️ Limité par plan (PRO=100). Architecturalement possible si mono-instance | 🔴 Idem |

### 9.2 Goulots d'étranglement

1. **Plan/quota** : FREE=20, PRO=100 (seul ENTREPRISE/ECOLE illimité). Plafond réel.
2. **WebSocket mono-instance** : l'état est en mémoire RAM. Pour 500 joueurs simultanés, pas de limitation protocolaire (WebSocket léger), mais scalabilité bloquée à 1 nœud.
3. **Mode vote à grand nombre** : `expectedVoters` attend TOUS les participants non-buzzeurs. Un joueur absent ou déconnecté bloque indéfiniment. 🔴 Pas de timeout.
4. **Mode animateur à grand nombre** : l'animateur voit N buzzers simultanés, doit choisir le gagnant — le serveur prend le premier (race condition), mais l'animateur est inondé visuellement.

---

## PARTIE 10 — AMBIGUÏTÉS À DÉCIDER

### A-01 : Convention `reponse` pour les QCM — texte ou lettre ?

**Situation** : `reponse` peut être stocké comme `"Paris"` (texte du choix) ou `"A"` (lettre). Le moteur auto compare en texte → lettre = bug de score. L'écran principal compare en texte → lettre = pas de highlight.

**Option 1** : **Convention texte** (recommandé, aligné sur le code existant)
- Auto : scoring correct
- EcranPrincipal : highlight correct
- QuestionDisplay : à corriger (letter comparison → text comparison)
- Avantage : robuste, indépendant de l'ordre des choix
- Inconvénient : réponse visible dans la DB (spoil si accès direct)

**Option 2** : **Convention lettre**
- Tout changer pour comparer par lettre
- Avantage : classique (QCM papier), compact
- Inconvénient : l'ordre des choix est critique, fragile

**Option 3** : **Index numérique** (0, 1, 2, 3)
- Robust, indépendant du texte
- Implique de migrer les questions existantes

---

### A-02 : Mode Vote + timer de sécurité

**Situation** : si un joueur ne vote pas (déconnexion, inattention), la partie ne peut plus avancer. `expectedVoters` attend 100 % des votes.

**Option 1** : Timeout serveur (ex. 30 s après le buzz → résolution forcée avec les votes reçus)
- Pro : partie toujours fluide
- Con : joueur déconnecté change le résultat

**Option 2** : Seuil relatif (ex. 70 % des votes suffisent)
- Pro : robuste aux absences
- Con : complexifie la règle

**Option 3** : Statu quo
- Pro : simple
- Con : partie bloquée si quelqu'un disparaît

---

### A-03 : QCM en mode Animateur — saisie ou buzz ?

**Situation** : en mode Animateur, quand une question QCM est affichée, les joueurs voient les 4 cases sur l'écran mais doivent BUZZER pour répondre oralement. L'animateur valide manuellement. Ce n'est pas "faux" mais crée une confusion UX (pourquoi A/B/C/D si je dois buzzer ?).

**Option 1** : Statu quo — buzz + validation manuelle en mode animateur, même pour les QCM
- Pro : cohérence du mode (l'animateur reste maître)
- Con : UX confuse (choix affichés inutilement ?)

**Option 2** : En mode animateur, les QCM → saisie de choix (comme en auto)
- Pro : logique pour les QCM
- Con : rompt la cohérence "animateur = maître de la vérité"

**Option 3** : Afficher les choix SEULEMENT sur l'écran public (pas sur le téléphone joueur en mode animateur)
- Pro : l'animateur a toujours la main, les joueurs voient l'écran
- Con : les joueurs ne peuvent pas répondre sur téléphone

---

### A-04 : Question ouverte en mode auto — que faire ?

**Situation** : TYPE=BUZZER (ou IMAGE/AUDIO/VIDEO sans choix) en mode auto → aucun score, affichage "👀 Regarde l'écran". La question est révélée par le timer sans enjeu.

**Option 1** : Statu quo — observation silencieuse
- Pro : simple, pas de bug
- Con : temps de jeu "mort", démotivant

**Option 2** : "Saisie libre" — le joueur tape sa réponse, le serveur normalise
- Pro : enrichit le jeu
- Con : comparaison de texte libre = erreurs / frustrations

**Option 3** : Interdire les questions ouvertes en mode auto (côté admin)
- Pro : cohérence parfaite
- Con : perte de flexibilité

**Option 4** : "Buzz le plus rapide" (réflexe pur) sans vérification
- Pro : conserve l'engagement
- Con : la "bonne réponse" n'est jamais vérifiée, points pas mérités

---

### A-05 : Timer de buzz en mode Animateur

**Situation** : en mode Animateur, aucun timer ne force l'avancement. La question peut rester affichée indéfiniment. L'animateur clique "Suivant" à son rythme. `Partie.timerBuzz` (champ DB, valeur 10 s) **n'est pas utilisé par le moteur**.

**Option 1** : Statu quo — animateur souverain, pas de timer
- Pro : flexibilité totale de l'animateur
- Con : parties sans fin si l'animateur est distrait

**Option 2** : Activer `timerBuzz` comme indicateur visuel (sans forçage)
- Pro : rappel à l'animateur, sans contrainte

**Option 3** : Timer qui ferme le buzz automatiquement après `timerBuzz` secondes (mais n'avance pas)
- Pro : équitable (pas de buzz après le temps)
- Con : implémentation à faire

---

### A-06 : Médias "IMAGE" sans format de réponse

**Situation** : TYPE=IMAGE ne dit pas SI la réponse est BUZZER, QCM ou VRAI_FAUX. C'est déduit de la présence de `choix`. Pas de type "IMAGE+QCM" explicite.

**Options** :
- **A** : Décision implicite (statu quo) — l'auteur met des `choix` s'il veut un QCM sur image
- **B** : Décider que TYPE=IMAGE implique toujours BUZZER (ajouter choix → on passe en QCM avec image)
- **C** : Ajouter un champ `formatReponse` séparé (`BUZZ | QCM | VF`) indépendant du type de média

---

### A-07 : Maître du jeu peut-il voter en mode Vote ?

**Situation** : si `animateurJoue=false` → `isAnimateur=true`. Le serveur exclut le participant `isAnimateur=true` du comptage `expectedVoters`. Mais si ce participant envoie `submit_vote`, le serveur l'accepte (aucun guard). Il peut peser sur le résultat sans être compté dans le seuil.

**Options** :
- **A** : Ajouter un guard `if (participant.isAnimateur) return` dans `submit_vote`
- **B** : Ne pas créer de participant `isAnimateur=true` en mode Vote (il n'y a pas d'animateur) → statu quo (il n'y en a pas, car en mode Vote `animateurJoue` n'est pas proposé)

---

## PARTIE 11 — GAME DESIGN — ANALYSE COMPARATIVE

### 11.1 Ce que GBAIRAI fait déjà bien (comparé aux références)

| Référence | Mécanique | GBAIRAI |
|---|---|---|
| Kahoot | QCM + rapidité | ✅ `questionPoints` bonus de rapidité |
| Jackbox | "Vol" (Drawful) | ✅ `buzz_reopened` (mauvaise réponse → autres joueurs) |
| Qui veut gagner des millions | Aide du public | ✅ Mode Vote = exactement ça |
| Question pour un Champion | Buzz + juge arbitre | ✅ Mode Animateur |
| Les 12 Coups de Midi | Timer automatique | ✅ Mode Auto + `scheduleReveal` |
| Télécrochet | Écran public / projecteur | ✅ EcranPrincipal optimisé TV |
| Burger Quiz | Équipes + capitaine | ❌ Pas d'équipes |

### 11.2 Mécaniques simples qui pourraient être ajoutées

> Classées par impact/effort

| Mécanique | Complexité | Impact | Compatible plug & play ? |
|---|---|---|---|
| **Bonus de série** (3 bonnes = x1.5 sur la prochaine) | Faible | Moyen | ✅ |
| **Question jackpot** (points doublés, annoncé avant) | Faible | Fort | ✅ |
| **Timer visible en mode Animateur** (compte-à-rebours décoratif) | Faible | Moyen | ✅ |
| **Affichage "Vol"** (message visible quand le buzz rouvre) | Faible | Fort | ✅ |
| **Mort subite** (mauvaise réponse = score nul sur la question) | Moyen | Fort | ⚠️ À bien expliquer |
| **Équipes** | Élevé | Fort | ❌ Requiert refactoring majeur |
| **Élimination progressive** | Élevé | Fort | ❌ Requiert état "éliminé" |

---

## PARTIE 12 — TROUS FONCTIONNELS RÉSUMÉS

| # | Problème | Sévérité | Contexte |
|---|---|---|---|
| **T-01** | Convention `reponse` QCM ambiguë (texte vs lettre) | 🔴 | Auto mode, scoring |
| **T-02** | Mode Vote : pas de timeout si joueur absent | 🔴 | Vote, 20+ joueurs |
| **T-03** | Questions ouvertes en mode auto = "observation" sans enjeu | ⚠️ | Auto mode, BUZZER/IMAGE/AUDIO/VIDEO sans choix |
| **T-04** | `Partie.timerBuzz` non utilisé par le moteur | ⚠️ | Animateur, timer |
| **T-05** | Maître du jeu peut voter (mode Vote) | ⚠️ | Vote, edge case |
| **T-06** | QCM + Animateur : choix affichés mais joueurs buzzent (confusion UX) | ⚠️ | Animateur, QCM |
| **T-07** | QuestionDisplay.jsx utilise comparaison lettre (bug latent) | ⚠️ | Composant non utilisé en jeu actif |
| **T-08** | Mode Vote : "Suivant" en cas d'égalité de votes non spécifié clairement | ⚠️ | Vote, edge case |
| **T-09** | Aucune mécanique d'élimination | ❓ | Décision produit |
| **T-10** | YouTube : synchronisation dégradée (iframe reload uniquement) | ⚠️ | VIDEO + YouTube |

---

## PARTIE 13 — RECOMMANDATIONS

### Priorité 1 — Corriger (bugs fonctionnels)

1. **T-01** : Décider et documenter la convention `reponse` pour QCM (texte recommandé). Corriger `QuestionDisplay.jsx`. Ajouter un guard dans l'admin de questions.

2. **T-02** : Ajouter un timeout de résolution automatique en mode Vote (ex. 45 s après le buzz → résoudre avec les votes reçus).

### Priorité 2 — Améliorer (UX/game design)

3. **T-03** : Pour les questions ouvertes en mode auto, activer le buzz-réflexe (le plus rapide gagne, sans vérification). Simple, engageant.

4. **T-04** : Activer `timerBuzz` comme compte-à-rebours visible en mode Animateur (sans forçage, juste visuel).

5. **T-06** : En mode Animateur + QCM, masquer les cases A/B/C/D sur l'écran joueur (il buzze pour donner sa réponse oralement, les cases sont sur l'écran public pour les autres).

6. **Afficher "Vol disponible"** : quand `buzz_reopened` est diffusé, ajouter un texte animé "💡 Le buzz est rouvert !" visible sur le JoueurJeu. Actuellement invisible.

### Priorité 3 — Game design (décisions produit)

7. **Question jackpot** : annoncer avant l'affichage que "cette question vaut double". Simple à implémenter (flag sur Manche ou Question).

8. **Bonus de série** : 3 bonnes réponses consécutives → multiplicateur × 1.5 sur la suivante.

---

## PARTIE 14 — ROADMAP D'AMÉLIORATION

### Court terme (correctifs, 1-2 jours)
- Fixer T-01 (convention reponse QCM)
- Fixer T-02 (timeout vote)
- Afficher "Vol rouvert" (T-06 partiel)

### Moyen terme (améliorations UX, 1 semaine)
- Timer décoratif en mode Animateur (T-04)
- Questions ouvertes en mode auto → buzz-réflexe (T-03)
- Masquer choix QCM sur téléphone joueur en mode Animateur

### Long terme (game design, 2-4 semaines)
- Question jackpot
- Bonus de série
- Élimination progressive (décision produit requise — A-01 à décider d'abord)

---

## Éléments vérifiés (code) vs hypothèses

**✅ Directement dans le code** : tous les workflows décrits ici (gameHandler.js, packs.js, parties.js, JoueurJeu.jsx, AnimateurJeu.jsx, EcranPrincipal.jsx, SalleAttente.jsx, gameService.js).

**❓ Décisions produit ouvertes** : A-01 à A-07 ci-dessus — le code ne décide pas à ta place.

**Pas constaté dans le code** (absent) : élimination, équipes, bonus de série, timer animateur actif, jackpot, saisie libre, timeout vote.
