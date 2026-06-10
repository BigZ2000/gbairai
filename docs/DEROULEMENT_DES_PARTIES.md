# 🎮 Déroulement des parties Gbairai — doc réelle (selon le code)

> Cette doc décrit **ce qui se passe réellement** dans le moteur de jeu, en fonction
> du **mode** et des **paramètres** activés. Source : `server/src/ws/gameHandler.js`,
> `server/src/services/gameService.js`, `server/src/routes/parties.js`,
> `server/prisma/schema.prisma`.

---

## 1. Vocabulaire

| Terme | Définition (code) |
|---|---|
| **Hôte** | Le créateur (`creatorId`) **ou** l'animateur. Seul l'hôte peut lancer/gérer. |
| **Animateur** | Joueur-maître (`animateurId`, `isAnimateur=true`). **Exclu du classement**. N'existe qu'en mode *animateur*. |
| **Participant** | Un joueur. Le buzzer physique est résolu en **participant** (jamais en « mac » dans la logique métier). |
| **Manche** | Groupe de questions avec ses propres réglages (temps, points, malus, multiplicateur, élimination). |
| **Question** | Type : `QCM`, `VRAI_FAUX`, `BUZZER`, `IMAGE`, `AUDIO`, `VIDEO`. |

---

## 2. Les 3 modes (exclusifs)

Choisis à la création (`mode: 'animateur' | 'auto' | 'vote'`) → mappé en booléens :

| Mode | Booléens serveur | Qui rythme la partie ? | Qui juge les réponses ? |
|---|---|---|---|
| **Animateur** *(défaut)* | `modeAuto=false`, `modeVote=false`, `animateurId` défini | L'**animateur** (bouton « Suivant ») | L'**animateur** (👍/👎) |
| **Automatique** | `modeAuto=true` | Le **serveur** (minuteur) | **Personne** — déterminé par les données |
| **Vote collectif** | `modeVote=true` | Le **serveur** (après vote) | **La salle** (vote pour/contre) |

### Options transversales (cumulables avec un mode)

| Option | Champ | Effet réel |
|---|---|---|
| **Distanciel** | `modeDistanciel` | Médias lus sur le téléphone des joueurs ; en **auto**, les questions `BUZZER` deviennent une **saisie texte** (au lieu d'un buzz). |
| **Masquer les réponses** | `masquerReponses` | **Mode animateur uniquement** : cache la réponse à l'animateur jusqu'à la révélation. Forcé à `false` en auto/vote. |
| **Élimination progressive** | `eliminationActive` (partie + manche) | À la fin d'une manche, le **dernier au score** est éliminé (devient spectateur). |
| **Malus** | `malusEnabled` / `malusPenalite` (manche) | Mauvaise réponse validée = **points retirés** (`points × malusPenalite%`). |
| **Multiplicateur** | `multiplicateurPoints` (manche) | Multiplie les points de la manche (manches à enjeu croissant). |

---

## 3. La mécanique dépend du TYPE de question (pas du mode)

Le moteur distingue **deux familles** (`questionAChoix`) :

- **Question à choix** = `QCM`, `VRAI_FAUX`, ou toute question ayant une liste de `choix`.
  → **Réponse simultanée** : chaque joueur sélectionne (`submit_answer`). **Acceptée dans TOUS les modes.** Jamais de buzz.
- **Question ouverte** = `BUZZER` (sans choix).
  - **Présentiel** → **buzz réflexe** : le 1er qui buzze prend la main.
  - **Auto + Distanciel** → **saisie texte** : chacun écrit sa réponse, jugée par correspondance intelligente.

> Les types **médias** (`IMAGE`/`AUDIO`/`VIDEO`) suivent la même règle : s'ils ont des
> `choix` → à choix ; sinon → ouverts (buzz/saisie). Le média est **synchronisé par
> l'horloge serveur** (reprise correcte après reconnexion).

---

## 4. Barème de points (formule exacte)

```js
questionPoints(q, ms) =
  round( base × mult × (0.5 + 0.5 × speed) )

base  = pointsParQ (manche)  || points (question) || 100
mult  = multiplicateurPoints (manche)             || 1.0
speed = clamp( 1 − ms / (tempsLimite×1000) , 0..1 )   // rapidité
```

➡️ **50 % garantis** pour une bonne réponse + **50 % selon la rapidité** (modèle Kahoot),
le tout × multiplicateur de manche. `ms` = temps de réponse (ou de buzz).

**Bonus de consensus (mode vote)** : les votants qui ont voté avec la majorité
gagnent `round(base × 0.3)` (sans multiplicateur).

---

## 5. Déroulé détaillé par mode

### 🟦 Mode AUTOMATIQUE (`modeAuto=true`)

Le serveur pilote **tout le rythme**. Au lancement : affichage Q1 + média + LED `armed`,
puis un **minuteur de révélation = `tempsLimite`** (défaut 30 s) démarre.

**Questions à choix (QCM/VF) :**
1. Chaque joueur sélectionne (`submit_answer`) — **1 réponse verrouillée**, le temps (`ms`) est mémorisé.
2. Le compteur `answers_update {count/total}` s'affiche.
3. Révélation déclenchée quand **tous les joueurs actifs ont répondu** *ou* à l'**expiration du minuteur**.
4. `scoreAutoQuestion` : **tous** ceux qui ont la bonne réponse marquent (selon rapidité).
5. `question_reveal` (réponse + explication) → **compte à rebours 3 s** → question suivante.

**Questions BUZZER en PRÉSENTIEL (`!modeDistanciel`) = RÉFLEXE :**
1. Le **1er** à buzzer (web ou matériel) devient `buzzer_winner` (LED `winner`, les autres `locked`).
2. Il **marque immédiatement** `questionPoints` (pas de juge).
3. Révélation + avancement automatiques.

**Questions BUZZER en DISTANCIEL (`modeDistanciel`) = SAISIE :**
1. Le buzz est **ignoré** ; chacun **écrit** sa réponse (`submit_answer`).
2. À la révélation, **correspondance intelligente** (`answersMatch` : égalité ou inclusion, insensible casse/accents, min 3 caractères) → ceux qui matchent marquent.

---

### 🟨 Mode ANIMATEUR (défaut — `modeAuto=false`, `modeVote=false`)

L'**animateur** rythme (bouton **Suivant** = `next_question`) et **juge**. Il contrôle
aussi le média (play/pause/replay/seek).

**Questions à choix (QCM/VF) :**
1. Les joueurs sélectionnent (`submit_answer`) — simultané, accepté ici aussi.
2. L'animateur déclenche **Révéler** (`reveal_question`) → `scoreAutoQuestion` attribue les points à **tous les bons** (selon rapidité), puis affiche la réponse.

**Questions BUZZER :**
1. Le 1er à buzzer → `buzzer_winner` (LED `winner` / `locked`).
2. *(option D2)* Le buzzeur peut sélectionner une réponse QCM/VF sur son téléphone (`submit_selected_answer`) → l'animateur la voit avec un indice **correct/incorrect**.
3. L'animateur valide (`validate_answer`) :
   - **👍 Correct** → le buzzeur marque `questionPoints` ; la réponse est **révélée automatiquement**.
   - **👎 Incorrect** :
     - si **malus activé** sur la manche → **retrait** de `points × malusPenalite%`.
     - le **buzz se rouvre** (`buzz_reopened`, LED `armed`) → mécanique de **« vol »** (un autre peut tenter).

**`masquerReponses`** : si activé, l'animateur ne voit la bonne réponse qu'au moment de la révélation (utile en projection directe).

---

### 🟩 Mode VOTE collectif (`modeVote=true`)

Pas d'animateur : c'est **la salle** qui tranche. Pensé pour les questions **BUZZER**.

1. Le 1er à buzzer → `buzzer_winner`.
2. Les autres joueurs **votent** `pour`/`contre` (`submit_vote`). Le buzzeur **ne vote pas** sa propre réponse.
3. Quand **tous les votants attendus** ont voté, le serveur tranche :
   - **`pour > contre`** → le buzzeur marque `questionPoints`.
   - Les **bons votants** (alignés sur la majorité) reçoivent le **bonus de consensus** (`base × 0.3`).
4. `question_reveal` + `vote_result` → **compte à rebours 4 s** → question suivante.

---

## 6. Matrice récapitulative — type × mode

| Type de question | Auto | Animateur | Vote |
|---|---|---|---|
| **QCM / Vrai-Faux** | Sélection simultanée → score auto (rapidité) à l'expiration/quand tous ont répondu | Sélection simultanée → l'animateur révèle → score auto | Sélection simultanée (le vote concerne surtout le buzzer) |
| **BUZZER présentiel** | **Réflexe** : 1er buzz = marque + révèle | 1er buzz → animateur **valide** (👍 marque / 👎 vol + malus) | 1er buzz → **la salle vote** → marque si majorité |
| **BUZZER distanciel** | **Saisie texte** → matching intelligent → score | *(buzz classique — le distanciel n'affecte que les médias)* | *(buzz classique)* |
| **IMAGE / AUDIO / VIDEO** | suit « à choix » ou « ouvert » selon présence de `choix` ; média synchronisé serveur | idem | idem |

> ⚠️ Précision : la **saisie texte** des questions BUZZER n'est active **qu'en `auto + distanciel`**.
> En `animateur + distanciel` ou `vote + distanciel`, le buzzer fonctionne **normalement** (buzz) ;
> le distanciel ne change alors que la **lecture des médias** (sur le téléphone des joueurs).

---

## 7. Cas particuliers (toujours actifs)

- **Élimination progressive** (`eliminationActive`) : à la **fin de chaque manche**
  concernée, le joueur au **score le plus bas** devient spectateur (`player_eliminated`).
  Ne s'applique jamais au **dernier** joueur restant. Un éliminé ne peut plus
  **buzzer ni répondre**.
- **Un seul gagnant par buzz** : après le 1er buzz, `buzzLocked` bloque les suivants
  (ils clignotent en visuel mais ne changent pas le gagnant), jusqu'à avancement ou
  réouverture (« vol »).
- **Question close** : une fois la réponse révélée, tout buzz/réponse est **ignoré**.
- **Reconnexion / changement d'onglet** (`request_state`) : le serveur renvoie un
  **snapshot** (question courante + chronomètre + média + scores) → resynchro sans
  rien perdre.
- **Buzzers physiques (LED)** : le serveur **pousse** l'état de LED à chaque buzzer
  assigné : `idle` (repos) · `armed` (prêt) · `winner` (gagnant) · `locked` (verrouillé) ·
  `reveal` (réponse révélée). Un buzzer qui (re)connecte en pleine partie reçoit
  immédiatement le bon état.
- **Médias** : horloge serveur ; en mode **auto** le contrôle manuel du média est
  **ignoré** (le serveur pilote). En animateur/vote, seul l'animateur désigné (s'il y
  en a un) peut piloter.

---

## 8. Réglages par manche (rappel)

Chaque manche porte : `tempsLimite` (chrono + barème), `pointsParQ` (base), `theme`,
`difficulte`, `nbQuestions`, `malusEnabled`/`malusPenalite`, `multiplicateurPoints`,
`eliminationActive`, `typeManche` (`STANDARD | EXPRESS | RISQUE | DOUBLE | DUEL | RATTRAPAGE`).

> Les questions sont **tirées au lancement** (`drawAndStoreQuestions`) selon le thème/
> difficulté/nombre de chaque manche, puis **aplaties** dans l'ordre des manches
> (`flattenManchesServer`) — chaque question hérite des réglages de sa manche.

---

## 9. Fin de partie

Quand il n'y a plus de question (ou `end_game`) : statut **TERMINEE**, calcul et
persistance des **rangs**, diffusion du **classement final** (`game_ended`), LED des
buzzers remises à `idle`, et libération des buzzers matériels (`IN_GAME → ONLINE`).
