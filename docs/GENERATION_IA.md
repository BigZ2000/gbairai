# Création de quiz par IA — documentation technique

## État

- **Construit et testé avec une IA simulée** : droits, quotas, contrôle des questions, médias, enregistrement, lancement, écrans.
- **Jamais exécuté contre l'API Anthropic** : aucune clé n'est configurée pour Gbairai. La forme de l'appel suit le SDK officiel installé (`@anthropic-ai/sdk` 1.7), mais la qualité des quiz, la durée et le coût réels restent à mesurer.
- Sans clé, la fonction est **désactivée proprement** : l'interface l'annonce, l'API répond 503, l'écriture à la main reste disponible.

## Mise en service

```bash
# server/.env (ou .env de production)
ANTHROPIC_API_KEY=...          # crédits API (console.anthropic.com), distincts d'un abonnement Claude
IA_MODELE=claude-haiku-5-5     # défaut ; ou claude-sonnet-5-5, claude-opus-5-5
IA_REQUETES_PAR_HEURE=10       # par compte, échecs compris
IA_BUDGET_JOUR_USD=5.00        # plafond de dépense quotidien, tous comptes confondus
```

La migration `quiz_perso_ia` s'applique au déploiement (`prisma migrate deploy`). Elle n'ajoute que deux colonnes nullables à `Pack` et une table.

## Ce qui vient de SIREXE / ORIGINE

L'intégration SIREXE (ADR 0037) est en Java / Spring : le code ne se réutilise pas, les principes oui. Aucun secret ni configuration n'a été copié.

| Principe SIREXE | Dans Gbairai |
|---|---|
| Fournisseur derrière une interface | `services/ai/provider.js` : `{ nom, modele, generer() }`, injectable en test |
| Clé hors dépôt ; sans clé, 503 explicite | `ANTHROPIC_API_KEY` ; `getFournisseur()` rend `null` |
| Sortie structurée imposée par schéma | `SCHEMA_QUIZ` passé à `client.beta.messages.parse` |
| Contrôle serveur de la réponse | `validerBrouillon` : chaque question est re-vérifiée contre les règles du moteur |
| Sources inventées écartées | Un `mediaId` hors de la liste envoyée est ignoré |
| Refus du modèle → 422, panne → 503 / 502 | Erreurs typées `IaRefus`, `IaIndisponible` |
| Limite horaire par compte + budget quotidien | `services/ai/aiQuota.js` |
| Journal en ajout seul avec coût estimé | Table `AiGeneration` |
| Données de l'utilisateur balisées, jamais des instructions | `<demande>`, `<contexte>`, `<medias>` |

Comme SIREXE, Gbairai est réglé par défaut sur Claude Haiku 5.5 (décision du fondateur, 10 novembre 2026 — voir « Coûts »).

## Chaîne de traitement

```
POST /api/quiz/ia/generer { demande, nbQuestions, contexte? }
  1. compte requis (pas d'invité) ; une seule génération à la fois par compte
  2. peutGenerer : clé présente → quota de l'offre → limite horaire → budget du jour
  3. mediasCandidats : recherche dans la médiathèque à partir des mots de la demande
  4. appel du modèle (consignes + message balisé + schéma JSON)
  5. validerBrouillon : écarte les questions non jouables, les doublons, les médias inconnus
  6. moins de 3 questions jouables → 502, non décompté du quota
  7. journal (statut, jetons, coût estimé) → brouillon rendu au client
RIEN n'est enregistré à ce stade.

POST /api/quiz { titre, questions… }      ← après relecture par l'utilisateur
  1. le même contrôle est rejoué sur ce que le client envoie
  2. Question privées (publique = false) + Pack privé (ownerId) en contenu MANUEL
POST /api/packs/:id/start                 ← route existante, inchangée
```

## Règles imposées aux questions

| Mécanique | `choix` | `reponse` | Enregistré comme |
|---|---|---|---|
| `QCM` | 3 ou 4, distincts, 80 caractères au plus | exactement l'une des propositions | `type: QCM` |
| `VRAI_FAUX` | vide | `Vrai` ou `Faux` | `type: VRAI_FAUX` |
| `REPONSE_LIBRE` | vide | 3 à 40 caractères | `type: BUZZER` |

**Médias et mécanique sont indépendants.** Une image s'ajoute à n'importe quelle mécanique (`mediaUrl`). Un son ou une vidéo fait passer le type à `AUDIO` / `VIDEO` (condition de la lecture synchronisée du moteur) ; la mécanique reste portée par les choix — un Vrai/Faux sonore est enregistré `type: AUDIO, choix: ['Vrai','Faux']`. L'aller-retour est testé.

Le générateur n'utilise pas les « choix en images » (`choices`), réservés aux packs importés.

## Médiathèque

- **Recherche :** titre, nom de fichier, étiquettes, et — parce que la médiathèque est peu étiquetée — la réponse et les étiquettes de la question du catalogue qui utilise déjà le média (un drapeau lié à « Ghana » se retrouve en cherchant « Ghana »).
- **Association :** le modèle reçoit jusqu'à 40 candidats (`id`, type, libellé) et ne peut citer que ceux-là. Le serveur vérifie.
- **Rien de pertinent :** le modèle laisse `mediaId` vide et peut décrire l'image souhaitée (`mediaSuggestion`), affichée comme une idée dans l'éditeur.
- **Remplacer :** `GET /api/quiz/medias?q=&type=` (lecture seule) alimente le sélecteur de l'éditeur.
- **Limites :** les utilisateurs n'envoient pas leurs propres fichiers (stockage et modération à décider) ; l'IA ne « voit » pas les images, elle se fie à leur libellé. La qualité de l'association dépend donc de l'étiquetage (Admin → Médias).

## Droits et quotas

| Offre | Créations par IA | Questions max | Quiz enregistrés |
|---|---|---|---|
| Gratuit | 1 essai, à vie | 10 | 3 |
| Premium (`PRO`) | 30 par mois | 30 | illimités |
| Organisation (`ENTREPRISE`) | 100 par mois et par membre | 40 | illimités |
| École (`ECOLE`) | 60 par mois | 40 | illimités |
| Administrateur | illimité | selon l'offre | illimités |

Seules les générations réussies consomment le quota. Les échecs comptent dans la limite horaire (anti-abus). Un plan dont l'échéance est passée est traité comme Gratuit. Réglages dans `server/src/config/plans.js`.

Codes d'erreur : `IA_NON_CONFIGUREE` (503), `IA_PREMIUM` / `IA_QUOTA` (402), `IA_TROP_VITE` / `IA_BUDGET` (429), `IA_REFUS` (422), `IA_INDISPONIBLE` (503 / 502), `IA_INVALIDE` (502), `IA_EN_COURS` (409), `QUIZ_LIMITE` (402), `QUIZ_INVALIDE` (400).

## Coûts — estimation, à mesurer

Tarifs Anthropic par million de jetons (entrée / sortie) : Opus 5.5 4 $ / 20 $ ; Sonnet 5.5 2 $ / 10 $ ; Haiku 5.5 0,10 $ / 0,50 $.

Hypothèse de calcul, **non mesurée** : environ 2 500 jetons en entrée (consignes + médias) et 400 à 500 jetons en sortie par question, réflexion du modèle comprise.

| Quiz | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| 10 questions | ≈ 0,10 $ | ≈ 0,05 $ | ≈ 0,003 $ |
| 30 questions | ≈ 0,30 $ | ≈ 0,15 $ | ≈ 0,008 $ |
| 30 quiz de 30 questions (quota Premium au maximum) | ≈ 9 $ | ≈ 4,5 $ | ≈ 0,25 $ |

**Haiku 5.5 est le réglage par défaut** (décision du 10 novembre 2026). Sur Opus 5.5, un abonné Premium (5 000 FCFA, soit de l'ordre de 8 $) qui épuiserait son quota avec de grands quiz coûterait plus qu'il ne rapporte ; sur Haiku 5.5, le même cas extrême coûte environ 0,25 $.

**Contrepartie à mesurer :** un modèle plus petit risque davantage d'erreurs factuelles, et une question fausse jouée en public coûte plus cher qu'un centime. Au premier essai réel, compter les questions à corriger par quiz ; si le taux est gênant, passer `IA_MODELE` à `claude-sonnet-5-5` (≈ 4,5 $ au quota Premium maximal, encore sous le prix du pass) avant d'envisager Opus.

Le coût journalisé est une estimation calculée sur les jetons facturés ; la facture Anthropic fait foi.

## Limites connues

- **Actualité :** le modèle ne connaît rien après son entraînement. Les consignes l'obligent à marquer « à vérifier » tout fait récent ou changeant ; l'éditeur l'affiche. Pour un quiz d'actualité fiable, coller les articles dans « contexte ».
- **Exactitude :** le contrôle serveur garantit qu'une question est *jouable*, pas qu'elle est *vraie*. La relecture humaine est obligatoire, et l'interface le dit.
- **Durée :** un appel unique, sans diffusion progressive ; délai maximal de 4 minutes. Si les grands quiz dépassent une minute en pratique, passer à la diffusion en continu.
- **Repli :** l'appel demande le repli côté serveur d'Anthropic (`fallbacks: "default"`) en cas de refus pour raison de politique ; non observé en conditions réelles.
- **Mode conseillé :** un quiz personnel est conseillé en automatique. Sur grand écran, ses questions à réponse libre se jouent alors au réflexe (premier buzz), sans vérification — préférer « J'anime ».
- **Confidentialité :** la demande et le contexte partent chez le fournisseur d'IA. L'interface demande de ne pas y mettre de données personnelles ou confidentielles ; à faire valider au regard de la loi ivoirienne n° 2013-450 avant de démarcher des entreprises.

## Tests

```bash
cd server
npm test                                   # 11 tests unitaires, sans base ni réseau
DATABASE_URL=... JWT_SECRET=test npm run test:integration   # 14 tests, base réelle, IA simulée
```

- `tests/quizGenerator.test.js` — règles par mécanique, médias × mécaniques, aller-retour, plans, coût, correspondance des réponses libres.
- `tests/quiz.integration.test.js` — sans clé, invité, Gratuit, Premium, Organisation, plan expiré, limite horaire, budget, refus, sortie inexploitable, enregistrement, confidentialité du quiz, lancement par le moteur, modification, suppression.
- `tests/serveur-demo-ia.js` — le vrai serveur avec l'IA simulée, pour dérouler les écrans en local. Jamais en production (le dossier `tests/` n'est pas copié dans l'image Docker).

**Premier essai réel conseillé :** les trois demandes du cahier des charges (musique ivoirienne, team building, commerciaux), en 10 et 30 questions, puis lecture critique des réponses et du journal `AiGeneration` (jetons, coût, durée).
