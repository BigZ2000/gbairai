# 🔍 GBAIRAI — Audit de jouabilité, gameplay, scoring & UX

> **Analyse only — aucune modification de code.** Tout ce qui suit est tiré du code
> réel : `server/src/ws/gameHandler.js`, `server/src/services/gameService.js`,
> `server/src/routes/parties.js`, `server/src/services/quotaService.js`,
> `server/src/config/plans.js`, `prisma/schema.prisma`, et les pages
> `client/src/pages/{CreatePartie,RejoindrePartie,SalleAttente,JoueurJeu,AnimateurJeu,EcranPrincipal}.jsx`.
> Quand quelque chose **n'existe pas**, c'est indiqué explicitement.

---

## 0. Verdict rapide

**Le jeu est jouable de bout en bout aujourd'hui** dans le **mode Automatique** avec
des questions **QCM / Vrai-Faux** — c'est le chemin le plus fiable, en présentiel
comme à distance, téléphone seul inclus. **En dehors de ce chemin, plusieurs angles
morts** rendent l'expérience ambiguë ou cassée (questions ouvertes à distance, mode
vote à peu de joueurs, buzzer auto « réflexe » qui ne vérifie pas la connaissance,
réglages de timer trompeurs). Détails ci-dessous.

---

# PARTIE 1 — Modes de jeu

## 1.A Mode Animateur (`modeAuto=false, modeVote=false`)

**Fonctionnement réel :**
- À la création en mode animateur, le créateur devient **l'animateur**
  (`animateurId`, participant `isAnimateur=true`).
- **L'animateur est exclu du classement** (`broadcastParticipants` et `endGameInternal`
  filtrent `isAnimateur:false`) **et du total des répondants** (`submit_answer` compte
  `isAnimateur:false`). → **L'animateur ne marque pas de points et ne peut pas jouer.**
- Lancement : `Lancer` (1 clic, SalleAttente). L'animateur rythme (`next_question`),
  révèle (`reveal_question`) et **juge** les buzz (`validate_answer` 👍/👎).
- QCM/VF : **tous les joueurs répondent simultanément** ; à la révélation, le serveur
  marque chaque bonne réponse (rapidité). BUZZER : 1er buzz → l'animateur valide.
  Mauvaise réponse → **buzz rouvert** (« vol »), + **malus** si activé.
- `masquerReponses` (animateur seul) : cache la réponse à l'animateur jusqu'à la
  révélation (projection directe). L'API `/answers` renvoie `[]` dans ce cas.

**Scénarios :**
| Scénario | Ce qui se passe réellement |
|---|---|
| Animateur **qui joue** | ❌ **Impossible** — pas de mode « animateur-joueur ». L'animateur n'est jamais dans le classement. |
| Animateur **qui ne joue pas** | ✅ Cas nominal (présentateur de quiz). |
| Animateur **seul** | ⚠️ Lance possible (1 participant = lui), mais **0 joueur** → personne ne marque, partie vide de sens. |
| Animateur + plusieurs joueurs | ✅ Cas idéal, présentiel avec écran public. |
| Présentiel | ✅ Le téléphone joueur = **gros bouton BUZZ** ; la question est sur l'écran public/animateur. |
| Distanciel | ⚠️ Le buzzer fonctionne en buzz classique (le distanciel n'active la **saisie texte** qu'en *auto*). Les médias passent sur le téléphone. Mais une question **BUZZER ouverte** n'affiche **pas son énoncé** sur le téléphone (voir Partie 4). |

**Ambiguïtés / risques :** l'utilisateur seul qui choisit « animateur » se retrouve
spectateur de rien. Le rôle « je présente ET je joue » n'existe pas.

---

## 1.B Mode Automatique (`modeAuto=true`)

**Fonctionnement réel :** le **serveur** pilote tout.
- Au lancement : `question_display` + média + LED `armed` + minuteur de révélation =
  **`tempsLimite` de la manche** (défaut 30 s).
- **Comment une question se termine ?** À l'expiration du minuteur **ou** quand
  **tous les joueurs actifs ont répondu** (`answers.size >= total`).
- **Comment la bonne réponse est déterminée ?** Dépend du **type** :
  - **QCM / VRAI_FAUX** : comparaison **exacte** (normalisée casse/accents) entre la
    réponse choisie et `q.reponse`. → Détermination **fiable**.
  - **BUZZER présentiel** (`!modeDistanciel`) : **AUCUNE vérification de la réponse**.
    Le 1er à buzzer **marque immédiatement** (`questionPoints`) — c'est un **jeu de
    réflexe**, pas de connaissance. ⚠️ **Il n'y a pas de validation humaine cachée** :
    buzzer = gagner.
  - **BUZZER auto + distanciel** : **saisie texte** + `answersMatch` (égalité ou
    inclusion, min 3 caractères, insensible casse/accents). → Détermination
    **approximative** (heuristique).
  - **IMAGE / AUDIO / VIDEO** : se comportent comme « à choix » s'ils ont des `choix`,
    sinon comme une question ouverte (buzz/saisie). Média synchronisé par l'horloge
    serveur.

**Failles logiques identifiées :**
1. **BUZZER présentiel auto = score garanti** : le seul fait de buzzer donne les points,
   sans dire si la réponse orale était juste. En **solo**, on gagne **toujours** →
   ce n'est pas un quiz. (Faille de gameplay, pas de bug technique.)
2. **`answersMatch`** accepte l'**inclusion** : taper « bouake » pour la réponse
   « Bouaké » fonctionne, mais aussi des correspondances partielles parfois trop
   permissives (« mali » ⊂ « malien ») ou trop strictes (fautes d'orthographe).

**Peut-on jouer seul ?** ✅ Oui en auto : QCM/VF (auto-révélation dès ta réponse) et
BUZZER distanciel (saisie). En BUZZER présentiel, « jouable » mais score trivial.

**Peut-on jouer à plusieurs à distance ?** ✅ Pour QCM/VF. ⚠️ Pour BUZZER ouvert,
voir le **gap d'énoncé** (Partie 4).

---

## 1.C Mode Collectif / Vote (`modeVote=true`)

**Fonctionnement réel :**
1. 1er buzz → `buzzer_winner`.
2. Les **autres** joueurs votent `pour`/`contre` (`submit_vote`). Le buzzeur **ne vote
   pas** sa propre réponse.
3. Quand `votes.length >= expectedVoters` (tous les joueurs sauf le buzzeur et le
   maître), le serveur tranche : **`pour > contre`** → le buzzeur marque
   `questionPoints`. Les **bons votants** (alignés sur la majorité) gagnent
   `round(base × 0.3)` (bonus de consensus). Révélation + 4 s → suivante.

**Risques :**
- **À moins de 3 joueurs / en solo : cassé.** Avec 1 joueur, `expectedVoters = 0` →
  la condition `0 >= 0` est vraie immédiatement → `pour(0) > contre(0)` est **faux**
  → **le buzzeur ne marque jamais**. L'UI affiche « min. 3 joueurs » mais **rien ne
  l'empêche** côté serveur.
- **Manipulation** : le résultat = majorité simple ; une coalition peut invalider une
  bonne réponse (ou valider une mauvaise). C'est le principe du mode, mais ça peut
  frustrer sans modérateur.
- **Compréhension nouveau venu :** « pourquoi je vote au lieu de répondre ? » n'est
  pas expliqué à l'écran.

---

# PARTIE 2 — Types de questions (tableau)

| Type | Workflow réel | Modes compatibles | Scoring | Ambiguïtés / problèmes |
|---|---|---|---|---|
| **QCM** | Énoncé + choix affichés (téléphone **et** écran public). Sélection simultanée. | Auto, Animateur (pas Vote) | Exact match + rapidité | ✅ le plus fiable. La bonne réponse est le **texte** du choix, pas une lettre. |
| **VRAI_FAUX** | Idem QCM, 2 boutons. | Auto, Animateur | Exact match + rapidité | ✅ fiable. |
| **BUZZER** | Présentiel : gros bouton BUZZ (énoncé ailleurs). Auto+distanciel : saisie texte. | Tous | Présentiel auto : réflexe (buzz=points). Animateur : jugé. Vote : voté. Distanciel auto : `answersMatch`. | ⚠️ présentiel auto = pas de vérif ; distanciel = énoncé non affiché sur téléphone. |
| **IMAGE** | Média affiché (public ; téléphone si distanciel). Mécanique selon présence de `choix`. | Tous | comme QCM ou comme BUZZER | ⚠️ si pas de `choix` → retombe sur la mécanique BUZZER (mêmes limites). |
| **AUDIO** | Lecture synchronisée (horloge serveur). | Tous | idem | ⚠️ autoplay audio mobile parfois bloqué par le navigateur (à vérifier en test réel). |
| **VIDEO** | Lecture synchronisée, `videoDebut` géré. | Tous | idem | ⚠️ idem autoplay + bande passante. |

> **Constat transversal :** la mécanique dépend du **type** ET de la présence de
> `choix`. Une question média **sans choix** devient une question ouverte → hérite de
> toutes les limites du BUZZER ouvert.

---

# PARTIE 3 — Jouer seul

**Aujourd'hui, peut-on jouer seul de bout en bout ?**
- ✅ **Oui en mode AUTO** :
  - **QCM / VF** : tu réponds, auto-révélation immédiate (`total=1`), score selon
    rapidité, enchaînement auto, classement final. **Expérience solo complète.**
  - **BUZZER + distanciel** : tu tapes ta réponse, `answersMatch` tranche. Fonctionne.
  - **BUZZER présentiel** : « fonctionne » mais tu gagnes à chaque buzz (score trivial).
- ❌ **Non en mode Animateur** (tu serais l'animateur, donc non-joueur).
- ❌ **Non en mode Vote** (résolution à 0 votant → aucun point, cf. 1.C).

**Il n'existe AUCUN mode « Solo » explicite.** Le joueur doit deviner qu'il faut
choisir « Automatique ». 

**Proposition de mode Solo :** un préréglage « Solo / Entraînement » = `auto` +
`distanciel` + QCM/VF privilégiés + (pour les questions ouvertes) **auto-évaluation**
(« Tu avais bon ? Oui/Non ») au lieu du buzz réflexe. Zéro nouveau concept de jeu,
juste un raccourci honnête.

---

# PARTIE 4 — Jouer à plusieurs, téléphone uniquement (sans TV / sans animateur)

**Ce qui fonctionne :**
- **Rejoindre** : QR/lien → pseudo → on joue (invité, sans compte). Excellent.
- **QCM / VF en mode auto** : l'énoncé **et** les choix s'affichent **sur le téléphone**
  (`AnswerPad`, `JoueurJeu.jsx:370`). Score + classement OK. → **Téléphone seul =
  pleinement jouable** pour ce type.
- **Médias en distanciel** : image/audio/vidéo s'affichent sur le téléphone
  (`showMediaOnPhone`).
- **Hôte sans écran** : le créateur (auto/vote) a une barre **HÔTE** sur son téléphone
  (lien écran public + bouton **Fin**).

**Ce qui bloque (gaps réels) :**
1. **🔴 Question BUZZER ouverte, téléphone seul (auto+distanciel) : l'énoncé n'est PAS
   affiché.** La branche `showTextInput` de `JoueurJeu.jsx` ne rend que « Tape ta
   réponse » + champ — **jamais `question.enonce`**. → Le joueur doit deviner la
   question. **Bloquant** pour un quiz à distance avec questions ouvertes.
2. **🔴 Mode présentiel sans écran public = écran vide.** En présentiel, le téléphone
   joueur n'affiche **que** le bouton BUZZ (« la question est sur l'écran public »).
   Sans TV, **personne ne voit la question**. Rien n'avertit l'utilisateur qu'un écran
   public est requis.
3. **Mode vote** à <3 joueurs : cassé (cf. 1.C) — or « téléphone only » rime souvent
   avec petit groupe.

**Expérience idéale (proposition) :** pour le téléphone-seul, **toujours afficher
l'énoncé** sur le téléphone (quel que soit le type), et **désactiver/avertir** le mode
présentiel quand aucun écran public n'est ouvert.

---

# PARTIE 5 — Temps avant de jouer (clics réels)

| Parcours | Clics réels | Détail |
|---|---|---|
| **Créer une partie** | **~2** | `/parties/new` → saisir le nom → **Créer la partie** (mode auto par défaut, 1 manche par défaut). Chemin « avancé » (manches) = 3 étapes. |
| **Rejoindre** | **0–1** | Connecté : **auto-join** (0 clic). Invité : pseudo + **Jouer** (1 clic). |
| **Lancer** | **1** | SalleAttente → **Lancer** (exige ≥1 participant). |
| **Répondre** | **1 tap** | BUZZ / sélection QCM / Oui-Non vote / Envoyer (saisie). |
| **Finir** | **0 ou 2** | Auto : se termine seule. Manuel (hôte) : **Fin** + **Terminer** (confirmation). |

**Étapes / écrans potentiellement superflus :**
- L'**écran de confirmation** (étape 3) n'est utile que pour le chemin avancé ; le
  chemin rapide l'évite déjà (bien).
- En mode auto, certains réglages de l'étape 1 (**Timer après buzz**, **Timer vote**)
  sont exposés mais **le moteur ne les lit pas** : la révélation auto utilise
  `tempsLimite` (par manche) et des pauses **codées en dur** (3 s après reveal, 4 s
  après vote). → **Réglages trompeurs** (`timerBuzz`/`timerVote` semblent sans effet
  sur le rythme réel).
- La **confirmation de Fin** est justifiée (action destructive).

---

# PARTIE 6 — Inspirations jeux TV (mécaniques simples & compatibles)

> Réutiliser des **mécaniques**, pas des marques. Toutes doivent rester plug & play.

| Source | Mécanique récupérable | Déjà là ? | Coût de complexité |
|---|---|---|---|
| **Kahoot / Quizizz** | QCM + **points à la rapidité**, podium | ✅ déjà implémenté | nul |
| **Les 12 Coups de Midi** | **Manche à risque** (malus) | ✅ `malusEnabled` | faible (déjà là) |
| **Question pour un Champion** | « Le premier qui sait buzze » | ✅ buzzer réflexe | nul |
| **Slam / Motus** | Réponse **texte** + tolérance orthographique | ⚠️ partiel (`answersMatch`) | moyen (améliorer le matching) |
| **Génies en Herbe** | Manches thématiques enchaînées, **multiplicateur** | ✅ manches + `multiplicateurPoints` | nul |
| **Qui Veut Gagner des Millions** | Difficulté croissante, « paliers » | ⚠️ via `difficulte` par manche | faible |
| **Tout le Monde Veut Prendre sa Place** | **Élimination** progressive, duel | ✅ `eliminationActive` / `typeManche` (DUEL existe en data) | faible |
| **Family Feud** | Réponses « top X », jugement collectif | ⚠️ proche du mode **Vote** | élevé (à éviter pour l'instant) |

**À privilégier (faible coût, fort fun) :** le **podium animé** et le **feedback
rapidité** (déjà là, à mettre en valeur), la **manche à risque** et le
**multiplicateur** (déjà là, mais **invisibles** pour le joueur → à expliquer à
l'écran).

---

# PARTIE 7 — Impact sur la philosophie plug & play

| Élément | Respecte « simple / plug & play » ? |
|---|---|
| Rejoindre sans compte (pseudo) | ✅ exemplaire |
| Création rapide (mode auto par défaut) | ✅ |
| Reconnexion / snapshot transparente | ✅ |
| Buzz unifié web ↔ matériel, LED auto | ✅ |
| **3 modes × distanciel × élimination × malus × multiplicateur** | ⚠️ beaucoup de combinaisons ; certaines invalides (vote solo) ou trompeuses (timers). La **matrice de combinaisons** dépasse « compréhensible en < 1 min ». |
| Présentiel sans écran public | ❌ piège silencieux |
| Questions ouvertes à distance | ❌ énoncé manquant |

---

# LIVRABLE — Synthèse structurée

## 1) État réel actuel
Jeu fonctionnel **de bout en bout** en **auto + QCM/VF** (présentiel & distanciel,
téléphone seul). Modes animateur et vote fonctionnels **à plusieurs et avec écran**.
Buzzers physiques/simulés unifiés. Invités, plans (FREE = 5 parties/mois, 20 joueurs,
1 buzzer virtuel), historique, écran public : présents.

## 2) Forces
- Onboarding joueur **sans friction** (QR → pseudo → jeu).
- **Auto + QCM** = boucle de jeu complète et fiable, façon Kahoot.
- Robustesse temps réel : snapshot, horloge média serveur, LED resync.
- Anti-triche : la **réponse ne transite jamais** par l'API avant la révélation.
- Tunnel de **conversion invité** en fin de partie.

## 3) Faiblesses
- Pas de **mode Solo** explicite.
- **Énoncé absent** sur téléphone pour les questions ouvertes (distanciel).
- **Présentiel sans écran public** = aucune question visible.
- **Réglages timer** (`timerBuzz`/`timerVote`) **sans effet** sur le moteur auto.

## 4) Ambiguïtés
- BUZZER présentiel auto : « buzzer = gagner », **aucune vérification de la réponse**.
- `answersMatch` (inclusion) : tantôt trop permissif, tantôt trop strict.
- Rôle animateur : **ne joue jamais**, non explicité.

## 5) Risques de gameplay
- **Mode vote à <3 joueurs / solo : le buzzeur ne marque jamais** (résolution à 0 votant).
- **Solo en présentiel auto : score systématiquement gagné** (pas un quiz).
- Manche à vivier insuffisant → **questions manquantes** (complétion best-effort,
  sinon manche/partie vide).

## 6) Risques UX
- L'utilisateur **seul** qui choisit « animateur » ou « vote » se retrouve sans pouvoir
  marquer.
- Création présentiel **sans avoir ouvert l'écran public** → écran joueur « nu ».

## 7) Risques de compréhension utilisateur
- Différence **présentiel / distanciel** non expliquée au moment du choix.
- **Malus / multiplicateur / bonus consensus** modifient le score **sans explication**
  visible → scores « magiques ».
- « Pourquoi je vote ? » non introduit en mode collectif.

## 8) Recommandations priorisées

**P0 — à régler avant les tests utilisateurs**
- **P0-1** Afficher **toujours l'énoncé** de la question sur le téléphone (y compris
  saisie texte BUZZER distanciel). *(JoueurJeu — branche `showTextInput`.)*
- **P0-2** **Empêcher / corriger le mode Vote à <3 joueurs** : soit le bloquer au
  lancement, soit basculer en validation simple. *(gameHandler `submit_vote`.)*
- **P0-3** **Avertir si présentiel sans écran public** (ou afficher l'énoncé sur le
  téléphone par défaut). Éviter l'écran joueur « nu ».

**P1**
- **P1-1** Introduire un **mode Solo** (préréglage auto + énoncé + auto-évaluation pour
  les ouvertes).
- **P1-2** **Clarifier le rôle animateur** (badge « tu animes, tu ne marques pas » ;
  option « animateur-joueur » plus tard).
- **P1-3** **Aligner les réglages timer** sur la réalité du moteur (utiliser
  `tempsLimite`, retirer ou brancher `timerBuzz`/`timerVote`).
- **P1-4** **Honnêteté du BUZZER présentiel auto** : ajouter une mini-validation
  (auto-évaluation ou confirmation) pour que « buzzer » ≠ « gagner d'office ».

**P2**
- **P2-1** Rendre **visibles** malus/multiplicateur/bonus consensus à l'écran.
- **P2-2** Garde-fou **vivier de questions** (alerter si une manche risque d'être vide).
- **P2-3** Améliorer `answersMatch` (distance d'édition / tolérance fautes).

## 9) Proposition de gameplay cible
- **Boucle centrale = Auto + QCM/VF** (déjà solide) : à mettre en avant comme défaut.
- **Solo** : auto, énoncé sur téléphone, auto-évaluation pour les ouvertes.
- **Multi présentiel** : buzzer réflexe + **écran public obligatoire** (rappel clair).
- **Multi distanciel** : énoncé + médias **toujours** sur téléphone ; ouvertes via
  saisie tolérante.
- **Vote** : réservé/recommandé à **≥3 joueurs**, avec un mot d'explication.

## 10) Proposition de workflow cible (plug & play)
1. **Créer** → 1 écran : Nom + *« Comment voulez-vous jouer ? »* en **3 cartes
   illustrées** : **Solo**, **Entre potes (téléphones)**, **Présentiel (écran + buzzers)**.
   (Les booléens `modeAuto/modeVote/modeDistanciel/eliminationActive` sont **déduits**
   du choix — l'utilisateur ne voit jamais la matrice.)
2. **Inviter** (si multi) → QR/code (déjà là).
3. **Lancer** → 1 clic.
4. **Jouer** → l'énoncé est **toujours** là où le joueur regarde.
5. **Fin** → podium + (invité) conversion.

> Principe directeur : **réduire la matrice de modes à 3 intentions** lisibles, et
> garantir que **la question est toujours visible** pour celui qui doit répondre.
