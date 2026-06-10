# 📦 GBAIRAI — Audit & mise à jour des packs (alignement gameplay)

> **Basé sur le code réel** : `server/src/data/packs.js`, `server/prisma/seedPacks.js`,
> `server/src/routes/packs.js`, `server/src/services/gameService.js`,
> `server/src/ws/gameHandler.js`, `prisma/schema.prisma`, et la **bibliothèque de
> questions** (`prisma/seed1000.js` + `catalog/csv/*`). Les changements ont été
> appliqués à `data/packs.js` puis semés (`node prisma/seedPacks.js`, idempotent).

---

## 0. Le fait qui change tout : composition de la bibliothèque

| Source | Volume | Type | « À choix » ? |
|---|---|---|---|
| `seed1000.js` | **756** | **BUZZER (ouvertes)** | ❌ non (réponse libre) |
| `seed1000.js` | 127 | VRAI_FAUX | ✅ oui (`Vrai`/`Faux`) |
| `seed1000.js` | 117 | QCM | ✅ oui (4 choix) |
| `catalog/csv` | ~289 | IMAGE | ✅ **oui (4 choix générés)** |
| `catalog/csv` | ~148 | AUDIO | ✅ **oui (4 choix)** |
| `catalog/csv` | ~121 | VIDEO | ✅ **oui (4 choix)** |

➡️ **~76 % des questions texte sont des BUZZER ouvertes**, mais **toutes les questions
média ont des choix** → elles se comportent comme des QCM (`questionAChoix` les
classe « à choix »).

> ⚠️ **Correction importante (vérifiée en base)** : les CSV média (`catalog/csv/*`)
> ne sont **PAS importés** par le seed (`seed-full.js`). Aujourd'hui la base ne
> contient **aucune** question de type IMAGE/AUDIO/VIDEO ; les seeds audio/vidéo
> stockent des questions **texte** en `QCM`/`BUZZER`. Le vivier « à choix » réel =
> **QCM + VRAI_FAUX** (densifié par `questions_qcm.seed.js`). Conséquence : ne jamais
> restreindre un pack à AUDIO/VIDEO seuls (vivier vide). Les constantes incluent ces
> types par anticipation (importateur média = chantier séparé).

**Implication centrale (rappel du moteur) :**
- **À choix** (QCM/VF/média) → sélection simultanée, **comparaison exacte** → vérifiable
  dans **tous les modes**, y compris auto, sans humain.
- **BUZZER ouverte** → en **auto présentiel = réflexe** (1er qui buzze marque, **aucune
  vérification**) ; en **auto distanciel = saisie texte** (vérifiée par correspondance) ;
  en **animateur = jugée**.

Donc : **un pack auto + présentiel qui pioche dans tout le vivier est majoritairement
du « buzz = gagner » non vérifié.** C'est le cœur des correctifs ci-dessous.

---

## 1. Compatibilité packs × modes (avant)

| Constat (avant) | Détail |
|---|---|
| 10 packs « cœur » sans `modeRecommande` | → défaut **animateur** (seed) ⇒ **exigent un humain** qui ne joue pas. Anti-plug&play, inutilisable en solo / téléphone seul. |
| `cine-buzz` = `auto` + `typesAutorises:['BUZZER']` | **auto présentiel sur questions ouvertes = réflexe non vérifié** (buzzer = gagner). |
| `sans-faute`, `grand-defi` = `animateur` + malus | OK, mais le **malus ne s'applique qu'en mode animateur** (`validate_answer`). En auto, le malus est **ignoré**. |
| `survivor`, `double-ou-rien`, `choc-champions` = `animateur` | Or **élimination** et **multiplicateur** fonctionnent **aussi en auto** → restaient inutilement « host-only ». |
| Signatures | aucune `modeRecommande`/`typesAutorises` → défaut animateur + tous types. |

### Règles de compatibilité réelles (vérifiées dans le moteur)
| Mécanique | Fonctionne en… |
|---|---|
| QCM/VF/média (à choix) | **auto, animateur, vote** |
| BUZZER ouverte | auto présentiel (réflexe), **auto distanciel (saisie vérifiée)**, animateur (jugée), vote (≥3) |
| **Malus** (`malusEnabled`) | **animateur uniquement** (sinon ignoré) |
| **Multiplicateur** (`multiplicateurFinale`) | **tous modes** (barème) |
| **Élimination** (`eliminationActive`) | **tous modes** (fin de manche) |
| **Vote collectif** | **≥ 3 joueurs** (sinon bloqué au lancement — P0) |

---

## 2. Compatibilité packs × types de questions

| Type | Mécanique réelle | Auto sans humain ? |
|---|---|---|
| **QCM / VRAI_FAUX** | sélection simultanée, exact match | ✅ oui |
| **IMAGE / AUDIO / VIDEO** | **possèdent des choix** → comme QCM ; média synchronisé serveur | ✅ oui (média sur téléphone si distanciel) |
| **BUZZER** | réponse ouverte | ⚠️ seulement en **distanciel** (saisie) ou **animateur** (jugé) — pas en auto présentiel |

> Les combinaisons « IMAGE/AUDIO/VIDEO en QCM/Vrai-Faux » sont **déjà supportées**
> (les médias ont des choix). « Média en buzz/réponse directe » n'est pas distinct
> aujourd'hui : un média **sans** choix retomberait sur la mécanique BUZZER (aucune
> question média sans choix dans la bibliothèque actuelle).

---

## 3. Scoring & familles de packs (après mise à jour)

| Famille | Packs | Mécanique |
|---|---|---|
| **Tous marquent (tap-to-play)** | actu-ci, football, maquis, cinema, culture-g, gbe-quartier, afrique-monde, science-tech, gastronomie, mort-subite, blitz-express, double-ou-rien, survivor, choc-champions, marathon-culture + **toutes les signatures** | auto + types à choix → chaque bonne réponse marque (rapidité) |
| **Buzz rapide (réflexe / jugé)** | cine-buzz | animateur, buzzer présentiel jugé |
| **Élimination progressive** | survivor, choc-champions | dernier de chaque manche éliminé |
| **Malus (manche à risque)** | sans-faute, grand-defi | animateur, points retirés si faux |
| **Compétitif (finale ×2)** | double-ou-rien, choc-champions, grand-defi | dernière manche ×2 |
| **Réponse ouverte / à distance** | quiz-distance, blind-test-express | auto + distanciel, saisie vérifiée |
| **Coopératif** | *(aucun — non implémenté)* | ⚠️ voir §“non implémenté” |

### Mécaniques pertinentes mais **non implémentées** (signalées, non codées)
- **Mode coopératif / par équipes** (score d'équipe) — n'existe pas (scores individuels).
- **Bonus de rapidité visible** : le bonus existe dans le barème mais n'est pas
  affiché question par question.
- **Indices / jokers** (50:50, etc.) — non implémentés.
- **Malus en mode auto** — non supporté (le malus suppose un jugement humain).

---

## 4. Paramètres par défaut recommandés (par usage)

> Tous reposent sur l'existant (mode + types + manches + temps). Aucun nouveau concept.

| Cas d'usage | Mode | Types | Manches × Q | Temps | Distanciel | Notes |
|---|---|---|---|---|---|---|
| **Famille** | auto | à choix | 1 × 10 | 25–30 s | non | simple, tout le monde marque |
| **École** | auto | à choix | 2 × 10 | 30 s | non | + multiplicateur finale possible |
| **Entreprise** | auto | à choix | 2–3 × 10 | 25 s | non | team-building ; écran public conseillé |
| **Événementiel** | animateur | BUZZER | 3 × 10 | — | non | buzz jugé, ambiance scène + buzzers physiques |
| **Jeu solo** | **Solo** (auto + distanciel) | tous | 1 × 10 | 30 s | **oui** | énoncé + réponses sur le téléphone, vérifiées |
| **À distance sans écran public** | auto | à choix **ou** distanciel | 1–2 × 10 | 30 s | **oui** | énoncé/médias poussés sur le téléphone |

Défauts produit retenus pour la majorité des packs : **mode auto**, **types à choix**,
**2 manches × 10 questions × 30 s**, **réponses révélées après** (pas de régie).

---

## 5. Time To Play (parcours réel)

| Étape | Clics réels |
|---|---|
| Choisir un pack (Dashboard) | 1 (carte) |
| Lancer le pack | 1 (`/packs/:id/start` → crée partie + manches + questions) |
| Démarrer | 1 (**Lancer** en salle d'attente) |
| **Total avant 1re question** | **~3 clics** |
| Répondre | 1 tap |

➡️ **< 1 min** respecté pour un pack. Frictions restantes :
- L'étape **salle d'attente + Lancer** est superflue pour un **solo** → un bouton
  « Jouer maintenant » qui enchaîne `start pack → start partie` économiserait 1 écran.
  *(Reco UX, non codé ici.)*
- Le pack crée une partie `EN_ATTENTE` puis on relance `/parties/:id/start` (le draw
  ignore les manches déjà peuplées) → cohérent, mais un **lancement direct EN_COURS**
  pour les presets « 1 clic » serait plus fluide. *(Reco UX.)*

---

## 6. Modifications appliquées (résumé)

Toutes dans `server/src/data/packs.js` (puis `node prisma/seedPacks.js`) :

1. **Ajout de `modeRecommande` + `typesAutorises`** à **tous** les packs cœur et
   **toutes** les signatures.
2. **Bascule en `auto` + types à choix** des packs thématiques et de
   `double-ou-rien`, `survivor`, `choc-champions`, `marathon-culture`, `mort-subite`
   → vérifiés, plug & play (solo / téléphone / présentiel / distanciel).
3. **Packs média** (maquis, cinema + signatures musique/ciné) → `CHOIX_TYPES_AV`
   (inclut AUDIO/VIDEO, qui ont des choix).
4. **`cine-buzz`** : `auto` → **`animateur`** (buzz réellement jugé, plus de « buzz = gagner »).
5. **`sans-faute` / `grand-defi`** : `typesAutorises:['BUZZER']` pour que le **malus**
   s'applique de façon cohérente (chaque réponse jugée par l'animateur).
6. **`quiz-distance` / `blind-test-express`** : confirmés `auto` + `modeDistanciel`
   (réponses ouvertes vérifiées par saisie ; blind test restreint à `AUDIO`).
7. Deux constantes réutilisables : `CHOIX_TYPES` (`QCM,VRAI_FAUX,IMAGE`) et
   `CHOIX_TYPES_AV` (+`AUDIO,VIDEO`).
8. **Rétrocompatibilité** : aucun slug modifié, upsert idempotent (27 packs).

---

## 7. Livrables — synthèse

**Problèmes détectés**
- Défaut historique **animateur** (host obligatoire) sur les packs cœur.
- **Auto présentiel sur questions ouvertes = non vérifié** (cine-buzz, packs « tous types »).
- **Malus inopérant** hors mode animateur (packs malus mal cadrés).
- Élimination/multiplicateur **inutilement bridés** en animateur.

**Modifications appliquées** → cf. §6.

**Recommandations UX (non codées)**
- Bouton **« Jouer maintenant »** (solo / preset) qui saute la salle d'attente.
- **Afficher le bonus de rapidité** et les enjeux (déjà fait pour malus/multiplicateur en P2).
- Enrichir la banque en **QCM** (aujourd'hui 76 % d'ouvertes) pour densifier les
  packs auto thématiques (sinon complétion inter-catégories).

**Tableau des paramètres par défaut** → cf. §4.

**Impacts gameplay**
- La quasi-totalité des packs devient **jouable seul, à plusieurs, sur téléphone,
  en présentiel et à distance, sans animateur**, avec un **scoring vérifié**.
- Les formats nécessitant un humain (**buzz jugé**, **malus**) sont désormais
  **explicitement** en mode animateur (présentiel assumé), au lieu d'être le défaut subi.

---

## Philosophie respectée
**Scanner → Jouer → S'amuser** : moins de décisions (mode auto par défaut), réponses
vérifiées sans configuration, compatible téléphone / simulateur / buzzer physique,
présentiel **et** distanciel. Les seuls packs « host-only » sont ceux dont la
mécanique l'exige (buzz jugé, malus), et c'est désormais explicite.
