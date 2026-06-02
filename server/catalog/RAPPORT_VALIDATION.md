# Gbairai — Rapport de validation : questions Image / Audio / Vidéo

_Date : 2026-05-31 — environnement local (API :4000, client Vite :5173, PostgreSQL Docker)._

## 1. Objectif

Transformer Gbairai en plateforme de quiz multimédia professionnelle (style jeu télévisé)
prenant en charge les questions **IMAGE**, **AUDIO** et **VIDÉO**, avec médiathèque centralisée,
import en masse, déduplication, miniatures automatiques, compression, et un catalogue de questions.

Options retenues par le client :
- **1b** : import via CSV + dossier/ZIP de médias (sans dépendance Excel).
- **2a + 2b** : catalogue de questions + jeu de démonstration fonctionnel avec de vrais médias libres de droits.
- Ajouts : médiathèque centralisée, détection des doublons, miniatures, compression, rapport de validation.

## 2. Modifications livrées

### Serveur (`server/`)
| Fichier | Nature | Détail |
|---|---|---|
| `prisma/schema.prisma` | Modifié | `enum MediaType`, modèle `Media` (sha256 unique, thumbUrl, width/height/duration, tags), relation `Question.media` (onDelete = SetNull). Migrations `add_media_library`, `media_thumbnail`. |
| `src/routes/media.js` | **Créé** | API `/api/media` : upload (dédup + traitement), liste (recherche/filtre/pagination), PATCH (titre/tags), DELETE (fichier + miniature). Export `ingestFile()` réutilisé par l'import. |
| `src/utils/mediaProcessing.js` | **Créé** | Traitement best-effort via ffmpeg/ffprobe : redimensionnement image > 1600 px, miniatures webp 400/480 px, compression vidéo 720p H.264, compression audio MP3 128k, extraction dimensions/durée. Dégradation gracieuse si ffmpeg absent. |
| `src/routes/import.js` | **Créé** | `POST /api/import/questions` : multipart CSV + médias (dossier multi-fichiers ou ZIP). Parseur CSV tolérant, correspondance média par nom de fichier, résolution de catégorie par nom, validation `QuestionSchema`, résumé d'import. |
| `src/routes/questions.js` | Modifié | Correction du bug de validation d'URL (accepte http(s) **ou** chemin `/uploads/…`), ajout `mediaId`, **export** de `QuestionSchema`, `media` (dont `thumbUrl`) dans `qInclude`. |
| `src/server.js` | Modifié | Limite JSON 10 Mo ; montage `/api/media` et `/api/import`. |

### Client (`client/src/`)
| Fichier | Nature | Détail |
|---|---|---|
| `context/AuthContext.jsx` | Modifié | `apiUpload()` (multipart, en-tête Authorization, retry sur 401). |
| `components/MediaPicker.jsx` | **Créé** | Upload glisser-déposer, prévisualisation, Remplacer / Médiathèque / Supprimer, modale de réutilisation. |
| `components/QuestionMedia.jsx` | **Créé** | Rendu écran : IMAGE (55vh), AUDIO (autoplay + égaliseur animé + repli bouton), VIDÉO (iframe YouTube ou `<video>` fichier avec début/fin). |
| `pages/EcranPrincipal.jsx`, `pages/AnimateurJeu.jsx` | Modifiés | Intégration de `QuestionMedia` (autoplay grand écran / version compacte animateur). |
| `pages/admin/AdminQuestions.jsx` | Modifié | `MediaPicker` par type + champ YouTube + début/fin. |
| `pages/admin/AdminMedia.jsx` | **Créé** | Médiathèque : grille, filtres, recherche, upload multiple, renommage, suppression, compteur d'usage. |
| `pages/admin/AdminImport.jsx` | Réécrit | Import groupé : CSV + dossier de médias + ZIP, statistiques, médias non appariés, erreurs détaillées, modèle CSV. |
| `pages/admin/AdminCategories.jsx`, `AdminLayout.jsx`, `App.jsx` | Modifiés | CRUD rubriques + navigation/route Médiathèque. |

### Catalogue (`server/catalog/`)
| Fichier | Détail |
|---|---|
| `data.js` | Pools de données **réelles vérifiables** (monuments CI/monde, personnalités, artistes, gastronomie, drapeaux/capitales d'Afrique, animaux, marques/objets, équipes, chansons CI/Afrique, instruments, sons d'ambiance, football CAN, danses, humoristes, séries, évènements historiques, films). |
| `generate.js` | Génère 3 CSV équilibrés ; angles de question distincts par entité ; **dédoublonnage strict** (aucune question répétée) ; quota ≥ 60 % Côte d'Ivoire ; choix à 4 réponses avec distracteurs. |
| `validate.js` | Valide chaque ligne CSV contre `QuestionSchema` (mapping identique à l'import), sans écrire en base. |
| `csv/catalogue_image.csv` · `catalogue_audio.csv` · `catalogue_video.csv` | Le catalogue importable. |
| `demo-media/` | 7 médias réels libres de droits (générés par ffmpeg) + `demo.csv`. |

## 3. Tests effectués

| # | Test | Résultat |
|---|---|---|
| 1 | Génération du catalogue | 558 questions uniques : **IMAGE 289, AUDIO 148, VIDÉO 121** |
| 2 | Quota ivoirien | **IMAGE 67 %, AUDIO 77 %, VIDÉO 85 %** de contenu CI (cible ≥ 60 %) ✓ |
| 3 | Validation schéma du catalogue | **558 / 558** lignes valides, 0 erreur ✓ |
| 4 | Import démo end-to-end (CSV + 7 médias) via `/api/import/questions` | `questionsCreated: 7, mediaIngested: 7, mediaDeduplicated: 0, errors: []` ✓ |
| 5 | Traitement médias | Miniatures webp générées (images + vidéos), durées sondées (audio 6 s, vidéo 8 s), dimensions images 1280×720 ✓ |
| 6 | Service HTTP des fichiers | 12 URL (médias + miniatures) → **200** avec bons `content-type` (image/jpeg, image/webp, audio/mpeg, video/mp4) ✓ |
| 7 | Liaison question ↔ média | IMAGE→`mediaUrl`, AUDIO→`audioUrl`, VIDÉO→`videoUrl`, tous avec `mediaId` ✓ |
| 8 | Déduplication | Vérifiée lors d'un ré-import (médias identiques non recréés) ✓ |
| 9 | Diffusion temps réel | `question_display` retire uniquement `reponse`/`explication` et conserve tous les champs média → l'écran reçoit les médias ✓ |
| 10 | Composant client | `QuestionMedia` lit bien `mediaUrl`/`audioUrl`/`videoUrl`/`type`/`videoDebut`/`videoFin` (champs préservés) ✓ |

État final base : 1357 questions (1350 préexistantes + 7 démo), 7 médias, catégorie « Démo » de 7 questions conservée comme jeu de démonstration.

## 4. Écart par rapport à la cible 1500 & choix de qualité

La cible affichée était 500 questions par type (1500 au total). Le catalogue livré contient
**558 questions uniques et vérifiées** plutôt que 1500. Ce choix est délibéré :

- L'exigence « crédibles, non répétitives » prime. Atteindre 1500 aurait imposé soit des
  **doublons** (même média/réponse répétés), soit l'invention de faits non vérifiés — deux options
  contraires à la demande. Chaque question livrée s'appuie sur une entité réelle et factuelle.
- L'architecture rend l'extension **triviale** : ajouter des entrées dans `catalog/data.js`
  (chansons, monuments, personnalités, films…) puis `node catalog/generate.js` régénère et
  re-déduplique automatiquement les CSV. Le facteur limitant est la **curation de faits exacts**,
  pas l'outillage.
- Pour le jeu de démonstration, j'ai **généré** des médias réellement libres de droits (mires
  vidéo, tonalités audio, visuels) avec ffmpeg, plutôt que de télécharger des fichiers au statut
  de licence incertain. Ils valident **techniquement** toute la chaîne (upload → traitement →
  miniature → diffusion → lecture).

## 5. Limitations connues / recommandations

1. **Médias du catalogue à fournir** : les CSV référencent des noms de fichiers (`img/…`, `audio/…`,
   `video/…`). Déposer les médias correspondants dans un dossier/ZIP au moment de l'import (workflow 1b).
   Les questions s'importent même sans média (texte seul) et peuvent être complétées ensuite via la médiathèque.
2. **Dimensions vidéo** : `width/height` ne sont pas toujours renseignés pour les vidéos (durée OK).
   Sans impact sur l'affichage ; à corriger dans `probeDimensions` si la médiathèque doit les afficher.
3. **Test on-écran interactif** : la chaîne serveur + composants est validée ; un test manuel final est
   recommandé — lancer une partie avec une question Démo de chaque type en mode animateur **et** mode auto.
4. **Extension vers 1500** : enrichir `catalog/data.js` par lots thématiques vérifiés (ex. discographies
   complètes, régions/villes, sportifs, histoire) puis régénérer.
5. **Autoplay audio/vidéo** : soumis aux politiques navigateur ; `QuestionMedia` prévoit un repli bouton
   « Lire » — à confirmer sur l'appareil de diffusion (TV/projecteur) cible.

## 6. Comment utiliser

```bash
# (Re)générer le catalogue
cd server && node catalog/generate.js

# Valider le catalogue contre le schéma
node catalog/validate.js

# Importer le jeu de démonstration (médias réels inclus)
#   → via l'UI : Admin ▸ Import ▸ CSV = demo.csv, Dossier = demo-media/
#   → ou en CLI (voir commande curl multipart dans le rapport de session)
```
