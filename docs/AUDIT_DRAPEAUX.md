# 🏳️ GBAIRAI — Audit d'architecture pour le pack « Drapeaux du Monde »

> **Analyse uniquement — aucun code modifié.** Basé sur le code réel :
> `prisma/schema.prisma`, `services/gameService.js`, `ws/gameHandler.js`,
> `routes/import.js`, `routes/media.js`, `components/QuestionMedia.jsx`,
> `pages/JoueurJeu.jsx`, `pages/EcranPrincipal.jsx`, `pages/admin/AdminQuestions.jsx`,
> `components/QuestionEditor.jsx`.
> *(Le dossier `Downloads/W2560` est hors dépôt : non analysé. L'audit porte sur la
> capacité de GBAIRAI à accueillir ce contenu.)*

---

## 0. Réponse directe (TL;DR)

| Type voulu | Supporté aujourd'hui ? |
|---|---|
| **Type 1 — IMAGE → réponse texte / QCM texte** | ✅ **Oui, immédiatement** (et importable via l'import CSV existant) |
| **Type 3 — BUZZER sur image** | ✅ Oui (type `IMAGE` + `choix` vide = question ouverte) |
| **Type 4 — VRAI/FAUX sur image** | ⚠️ **Partiel** : le média est masqué pour le type `VRAI_FAUX` (contournement possible) |
| **Type 2 — TEXTE → choix = images de drapeaux** | ❌ **Non** : `choix` est `String[]` (texte). Refonte requise |
| **Type 5 — Élimination / vies** | ⚠️ Élimination du dernier par manche : ✅ ; système de **vies (-1)** : ❌ |
| **Anti-doublon « même pays sous formes différentes »** | ❌ Non (dédup par `id` de question uniquement) |
| **Filtres par région (CEDEAO, G20, Francophonie…)** | ❌ Non (tirage par catégorie/difficulté/type, pas par tags/région) |

➡️ **Le PO a raison** : pour les types 2/4 et l'anti-doublon métier, il faut faire évoluer
le modèle **avant** de générer des milliers de questions.

---

## 1. Backend — modèle de données réel

### Question (`schema.prisma`)
```
enonce String · type QuestionType · reponse String · choix String[]   ← TEXTE seulement
mediaUrl? · audioUrl? · videoUrl? · videoDebut? · videoFin? · mediaId? (→ Media)
tags String[] · difficulte · categorieId? · rubriqueId? · points · tempsLimite
```
- **`type`** mélange deux notions : la **nature du média** (IMAGE/AUDIO/VIDEO) **et**
  le **format de réponse** (BUZZER ouvert / QCM / VRAI_FAUX). Il n'y a pas de notion
  séparée « média principal » + « format de réponse ».
- **`choix String[]`** = **uniquement du texte**. Aucun champ pour des choix-images.
- **Un seul média principal** par question (`mediaId`/`mediaUrl`/`audioUrl`/`videoUrl`).
  Aucun média rattaché à un **choix**.
- **`Media`** (table dédiée, dédup `sha256`, `type`, `url`, `thumbUrl`, dimensions) :
  solide et réutilisable. ✅

### Scoring (`ws/gameHandler.js`)
- `questionAChoix` (QCM/VF/ou `choix` non vide) → sélection simultanée, **comparaison
  exacte** sur le texte du choix.
- Question ouverte → réflexe (auto présentiel) / `answersMatch` (auto distanciel) /
  jugée (animateur).
- ✅ OK pour des réponses **texte**. Aucune logique pour comparer un **choix-image**.

### Sélection aléatoire (`services/gameService.js → pickQuestionsForPack`)
```
where: { publique: true, id: { notIn: [...exclude] }, type ∈ typesAutorises }
+ filtre categorieId + difficulte
```
- Exclusion = **par `id` de question uniquement**.
- **Aucun** filtre par `tags` / région.
- **Aucune** dédup par `mediaId` ni par « sujet » (pays).

### Historique
- `GameEvent` référence `questionId` → OK pour l'historique, mais n'aide pas l'unicité métier.

---

## 2. Frontend — rendu réel

### Affichage du média (`components/QuestionMedia.jsx`)
```
if (type === 'IMAGE' && mediaUrl) → <img>
if (type === 'AUDIO' && audioUrl) → lecteur
if (type === 'VIDEO' && videoUrl) → vidéo
return null   ← sinon RIEN
```
➡️ **Le média est conditionné au `type`.** Une question `VRAI_FAUX` ou `QCM` qui
porterait un `mediaUrl` **n'affiche pas l'image**. C'est le point bloquant du **Type 4**.

### Choix de réponse
- **Joueur** (`JoueurJeu.jsx → AnswerPad`) : options construites depuis
  `question.choix` (texte) ou `Vrai/Faux` → **boutons texte uniquement**.
- **Écran public** (`EcranPrincipal.jsx`) : QCM rendu en **cartes texte**.
- ❌ **Aucun rendu de choix-image** nulle part.
- ✅ Responsive / écran public / écran joueur / modes auto-animateur-collectif :
  fonctionnels pour question-image + réponses **texte**.

---

## 3. Éditeur de questions

| Cas | Éditeur admin (`AdminQuestions.jsx`) | Verdict |
|---|---|---|
| **Cas A** — image en question + réponses **texte** | type `IMAGE` + `MediaPicker` (média principal) + `choix` texte | ✅ **Possible** |
| **Cas B** — réponses = **images** | aucun champ image pour les choix | ❌ **Impossible** |
| **Cas C** — réponses **mixtes** (texte + image) | idem | ❌ **Impossible** |

- `AdminQuestions.jsx` : `type`, `reponse` (texte), `choix` (ajout de chaînes texte),
  média principal via `MediaPicker` (un seul). Choix affichés seulement si QCM/VF.
- `QuestionEditor.jsx` (parties personnalisées) : encore plus limité (question/réponse/points).
- L'**import en masse** (`routes/import.js`) gère `IMAGE/AUDIO/VIDEO` + `choixA..D`
  **texte** + fichiers médias/ZIP → **parfait pour le Type 1**, pas pour les choix-images.

---

## 4. Moteur aléatoire & unicité métier

| Règle souhaitée | Aujourd'hui |
|---|---|
| Même **question** 2× dans une partie | ✅ empêché (`id notIn exclude`) |
| Même **image** (mediaId) 2× | ❌ non empêché |
| Même **pays** sous 2 formes (Q5 « drapeau du Japon » + Q7 « quel pays ? ») | ❌ non empêché |

➡️ Il manque une **clé métier d'unicité** (ex. `subjectKey` = code ISO du pays) et une
dédup du tirage sur cette clé (et/ou `mediaId`).

---

## 5. Limitations à lever (synthèse)

1. **Choix-images impossibles** (`choix String[]`) → bloque Types 2 / Cas B-C.
2. **Média gaté par `type`** → bloque Type 4 (drapeau + Vrai/Faux natif).
3. **Pas d'unicité métier** (pays/média) dans le tirage.
4. **Pas de filtre par région/tags** (CEDEAO, UEMOA, G20…).
5. **Pas de métadonnées** pays/ISO/continent/sous-région.
6. **Système de vies** (-1) inexistant (seule l'élimination du dernier existe).
7. **Éditeur** sans gestion de choix-images.

---

## 6. Modèle de données recommandé (générique, rétrocompatible)

> Objectif PO : **Question = média ou texte**, **Choix = texte / image / mixte**.
> Valable aussi pour logos, monuments, célébrités, animaux, cartes, œuvres d'art.

**Évolution incrémentale (3 ajouts, sans casser l'existant) :**

1. **Découpler média et format** côté rendu : afficher `mediaUrl/audioUrl/videoUrl`
   **dès qu'ils sont présents**, quel que soit le `type` (lève le gating). *(Débloque Type 4.)*
2. **Choix riches** : ajouter
   ```
   choices Json?   // [{ "text": "...", "mediaId": "...", "correct": true|false }]
   ```
   (on conserve `choix String[]` + `reponse` pour la rétrocompatibilité ; `choices`
   prime quand présent). Le rendu lit `choices` → texte et/ou image. *(Débloque Types 2 / Cas B-C.)*
3. **Métadonnées d'unicité & de regroupement** :
   ```
   subjectKey String?   // ex. "CIV" (ISO3) → unicité métier
   continent  String?   // "Afrique"…
   sousRegion String?   // "Afrique de l'Ouest"…
   // (régions politiques CEDEAO/UEMOA/Francophonie/G20 → via tags[])
   ```
   + faire filtrer `pickQuestionsForPack` par **tags** et dédupliquer par
   **`subjectKey`** (en plus de `id`). *(Débloque anti-doublon + packs régionaux.)*

> Le **système de vies** (Type 5 « -1 vie ») est une **mécanique de jeu** séparée
> (compteur de vies par participant) — à traiter indépendamment du contenu drapeaux.

---

## 7. Structure d'import recommandée

| Format | Adapté aux choix-images / métadonnées ? |
|---|---|
| **CSV** (existant) | ⚠️ OK pour **Type 1** uniquement (colonnes `choixA..D` texte). Fragile/illisible dès qu'on ajoute des choix-images + métadonnées. |
| **JSON (manifest) dans un ZIP** | ✅ **Le plus robuste** : structures imbriquées (choix multi-médias), typage, métadonnées riches. |

**ZIP idéal :**
```
drapeaux-monde.zip
├── manifest.json
└── media/
    ├── civ.png   ├── jpn.png   ├── gha.png ...
```
**`manifest.json` (par question) :**
```json
{
  "pack": { "slug": "drapeaux-monde", "nom": "Drapeaux du Monde", "emoji": "🏳️" },
  "questions": [
    {
      "format": "QCM",                 // OUVERT | QCM | VRAI_FAUX
      "media": { "kind": "IMAGE", "file": "media/civ.png" },
      "enonce": "Quel est ce pays ?",
      "reponse": "Côte d'Ivoire",
      "choices": [
        { "text": "Côte d'Ivoire", "correct": true },
        { "text": "Ghana" }, { "text": "Sénégal" }, { "text": "Mali" }
      ],
      "meta": { "subjectKey": "CIV", "continent": "Afrique",
                "sousRegion": "Afrique de l'Ouest", "tags": ["CEDEAO","UEMOA","Francophonie"] },
      "difficulte": "FACILE", "points": 100
    },
    {
      "format": "QCM",
      "enonce": "Quel est le drapeau du Japon ?",
      "choices": [
        { "media": "media/jpn.png", "correct": true },
        { "media": "media/chn.png" }, { "media": "media/kor.png" }, { "media": "media/tha.png" }
      ],
      "meta": { "subjectKey": "JPN", "continent": "Asie", "tags": ["G20"] }
    }
  ]
}
```
➡️ **JSON+ZIP** : extensible (drapeaux, logos, monuments…), gère texte **et** image en
choix, et porte les métadonnées d'unicité/région. **CSV à réserver au Type 1.**

---

## 8. Estimation du volume générable (254 drapeaux)

| Angle de question | Pré-requis | Volume |
|---|---|---|
| « Quel est ce pays ? » (IMAGE → QCM/texte/buzz) | ✅ aujourd'hui | **254** |
| « Quel est le drapeau de X ? » (TEXTE → choix-images) | refonte (choix-images) | **254** |
| « Ce drapeau est-il celui de Y ? » (Vrai/Faux) | refonte (média+VF) | 254 × variantes (**~500+**) |
| « Sur quel continent ? » | métadonnée continent | **254** |
| « Quelle est la capitale ? » | métadonnée capitale (à fournir) | **254** |

- **Immédiat (Type 1 seul, sans refonte)** : **~254** (identifier le pays), extensible
  à ~508 avec une 2ᵉ formulation.
- **Après refonte + métadonnées** : **~1 500–2 500** questions distinctes.
- **Avec anti-doublon par `subjectKey`** : **au plus ~254 par partie** sur un même pays
  (1 forme par pays/partie) → garantit zéro répétition métier.
- **Sous-packs gratuits** issus du même vivier via tags : Afrique (~54), Europe (~45),
  CEDEAO (15), UEMOA (8), Francophonie (~30+), G20 (19), Monde (254).

---

## 9. Recommandation finale (ordre de bataille)

**Faire la refonte AVANT de générer** (sinon Types 2/4 et anti-doublon rendront le
contenu à refaire). Priorité :

1. **P0 — Rendu média découplé du `type`** (afficher tout média présent). *Petit, débloque Type 4.*
2. **P0 — Choix riches `choices Json`** (texte/image/mixte) + rendu joueur & écran public.
3. **P1 — `subjectKey` + dédup tirage** (anti-doublon métier) + **filtre par tags** (packs régionaux).
4. **P1 — Import JSON+ZIP** (manifest) en plus du CSV.
5. **P2 — Métadonnées** continent/sous-région (+ capitale si on veut ces questions).
6. **P2 — Système de vies** (si Type 5 « -1 vie » souhaité, mécanique séparée).

Une fois (1)+(2)+(3)+(4) en place, **générer les 254 drapeaux** via un ZIP+manifest est
direct, robuste et réutilisable pour les futurs packs visuels (logos, monuments, etc.).
