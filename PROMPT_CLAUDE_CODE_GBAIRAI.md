# PROMPT CLAUDE CODE — PROJET GBAIRAI
# Plateforme SaaS de quiz interactif avec buzzers physiques connectés

---

## CONTEXTE DU PROJET

Tu vas implémenter **Gbairai**, une plateforme SaaS de jeux concours interactifs
avec buzzers physiques connectés via WiFi. Pense à Kahoot + Jackbox + buzzers
physiques, version Afrique de l'Ouest.

**Langue de l'interface** : Français uniquement
**Cible** : Côte d'Ivoire et Afrique de l'Ouest
**Environnement** : local d'abord, puis déploiement sur VPS

---

## STACK TECHNIQUE

### Backend
- Runtime      : Node.js 20+
- Framework    : Express.js
- WebSocket    : ws (npm)
- Base de données : PostgreSQL + Prisma ORM
- Auth         : JWT (access token 15min + refresh token 30j)
- Paiement     : CinetPay API (Mobile Money + Visa/Mastercard)
- Emails       : Nodemailer
- Upload media : Multer + stockage local /uploads
- Scheduler    : node-cron (renouvellements abonnements)
- Logs         : Winston
- Config       : dotenv

### Frontend
- Framework    : React 18 + Vite
- Routing      : React Router v6
- State        : Zustand
- UI           : Tailwind CSS + shadcn/ui
- WebSocket client : native browser WebSocket
- HTTP client  : Axios
- Formulaires  : React Hook Form + Zod

### ESP32 (Arduino)
- Board        : ESP32-C3 Mini (Arduino IDE)
- Librairies   : WiFiManager (tzapu), WebSockets (Links2004), ArduinoJson, Preferences

---

## STRUCTURE DU PROJET

```
gbairai/
├── server/                    # Backend Node.js
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js    # Connexion Prisma
│   │   │   ├── env.js         # Validation variables d'environnement
│   │   │   └── cinetpay.js    # Config CinetPay
│   │   ├── middleware/
│   │   │   ├── auth.js        # Vérification JWT
│   │   │   ├── plan.js        # Vérification limites Free/Pro
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js        # /api/auth/*
│   │   │   ├── buzzers.js     # /api/buzzers/*
│   │   │   ├── questions.js   # /api/questions/*
│   │   │   ├── parties.js     # /api/parties/*
│   │   │   ├── categories.js  # /api/categories/*
│   │   │   └── payments.js    # /api/payments/*
│   │   ├── websocket/
│   │   │   ├── wsServer.js    # Serveur WebSocket central
│   │   │   ├── handlers/
│   │   │   │   ├── buzzerHandler.js   # Connexions ESP32
│   │   │   │   ├── gameHandler.js     # Logique jeu temps réel
│   │   │   │   └── pairingHandler.js  # Pairing buzzer
│   │   │   └── rooms.js       # Gestion des salles de jeu
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── buzzerService.js
│   │   │   ├── gameService.js
│   │   │   ├── questionService.js
│   │   │   ├── paymentService.js
│   │   │   └── emailService.js
│   │   └── utils/
│   │       ├── arbitrage.js   # Horodatage et sélection du gagnant
│   │       └── qrcode.js      # Génération QR codes buzzers
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js            # Données initiales (catégories, questions démo)
│   ├── public/
│   │   └── get-started/       # Pages Get Started statiques (une par buzzer via MAC)
│   ├── uploads/               # Médias questions (images, audio)
│   ├── .env.example
│   └── package.json
│
├── client/                    # Frontend React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx           # Page d'accueil Gbairai
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── joueur/
│   │   │   │   ├── Dashboard.jsx     # Tableau de bord joueur
│   │   │   │   ├── MonBuzzer.jsx     # Gestion buzzer (pairing, statut)
│   │   │   │   └── MesParties.jsx    # Historique des parties
│   │   │   ├── animateur/
│   │   │   │   ├── Dashboard.jsx     # Tableau de bord animateur
│   │   │   │   ├── Buzzers.jsx       # Liste et gestion buzzers
│   │   │   │   ├── Questions.jsx     # Bibliothèque de questions
│   │   │   │   ├── CreateQuestion.jsx
│   │   │   │   ├── Parties.jsx       # Liste des parties
│   │   │   │   ├── CreatePartie.jsx  # Créer une partie (manches, rubriques)
│   │   │   │   └── Abonnement.jsx    # Gestion plan + paiement
│   │   │   ├── jeu/
│   │   │   │   ├── SalleAttente.jsx  # Salle d'attente avant la partie
│   │   │   │   ├── AnimateurJeu.jsx  # Interface animateur pendant la partie
│   │   │   │   ├── EcranPrincipal.jsx # Vue TV/projecteur (plein écran)
│   │   │   │   └── Podium.jsx        # Fin de partie + classement
│   │   │   ├── get-started/
│   │   │   │   └── GetStarted.jsx    # Page de configuration buzzer via QR
│   │   │   └── paiement/
│   │   │       ├── Checkout.jsx
│   │   │       └── Confirmation.jsx
│   │   ├── components/
│   │   │   ├── buzzer/
│   │   │   │   ├── BuzzerCard.jsx    # Carte affichant un buzzer (statut LED)
│   │   │   │   ├── PairingModal.jsx  # Modal d'ajout de buzzer
│   │   │   │   └── StatutBadge.jsx
│   │   │   ├── jeu/
│   │   │   │   ├── QuestionDisplay.jsx  # Affichage question (texte/image/video)
│   │   │   │   ├── Timer.jsx
│   │   │   │   ├── Classement.jsx
│   │   │   │   ├── BuzzResult.jsx    # "ZADI A BUZZÉ EN PREMIER !"
│   │   │   │   └── ScoreBoard.jsx
│   │   │   ├── question/
│   │   │   │   ├── QuestionCard.jsx
│   │   │   │   ├── VideoQuestion.jsx # Player YouTube/TikTok embed
│   │   │   │   └── ImportCSV.jsx
│   │   │   └── ui/                  # Composants génériques
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   ├── gameStore.js
│   │   │   └── buzzerStore.js
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js      # Hook WebSocket réutilisable
│   │   │   ├── useGame.js
│   │   │   └── useBuzzer.js
│   │   ├── services/
│   │   │   └── api.js               # Axios instance + intercepteurs
│   │   └── utils/
│   │       └── formatters.js
│   └── package.json
│
├── buzzer/                    # Code Arduino ESP32
│   └── buzzer_gbairai/
│       ├── buzzer_gbairai.ino # Fichier principal
│       ├── config.h           # Constantes (GPIO, serveur)
│       ├── wifi_manager.h     # Gestion WiFiManager
│       ├── websocket_client.h # Gestion WebSocket
│       ├── led_controller.h   # Gestion LED RGB
│       ├── button_handler.h   # Gestion bouton (buzz + pairing)
│       └── preferences_mgr.h  # Gestion NVS Preferences.h
│
└── docker-compose.yml         # PostgreSQL local pour le développement
```

---

## BASE DE DONNÉES — SCHÉMA PRISMA COMPLET

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── UTILISATEURS ─────────────────────────────────────────

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  password     String
  prenom       String
  role         Role     @default(JOUEUR)
  plan         Plan     @default(FREE)
  planExpireAt DateTime?
  createdAt    DateTime @default(now())

  buzzers      Buzzer[]
  parties      Partie[]
  scores       Score[]
  paiements    Paiement[]
  refreshTokens RefreshToken[]
}

enum Role {
  JOUEUR
  ANIMATEUR
  ADMIN
}

enum Plan {
  FREE
  PRO
}

// ── BUZZERS ───────────────────────────────────────────────

model Buzzer {
  id          String       @id @default(cuid())
  mac         String       @unique  // Adresse MAC = ID hardware unique
  nom         String?               // Nom donné par le joueur
  couleur     String       @default("#3B82F6")
  userId      String?
  user        User?        @relation(fields: [userId], references: [id])
  status      BuzzerStatus @default(OFFLINE)
  lastSeenAt  DateTime?
  firmware    String?
  createdAt   DateTime     @default(now())

  scores      Score[]
}

enum BuzzerStatus {
  OFFLINE
  ONLINE
  PAIRING
  IN_GAME
}

// ── QUESTIONS ─────────────────────────────────────────────

model Categorie {
  id          String     @id @default(cuid())
  nom         String
  emoji       String?
  description String?
  publique    Boolean    @default(true)
  createdAt   DateTime   @default(now())

  rubriques   Rubrique[]
  questions   Question[]
}

model Rubrique {
  id          String    @id @default(cuid())
  nom         String
  categorieId String
  categorie   Categorie @relation(fields: [categorieId], references: [id])
  createdAt   DateTime  @default(now())

  questions   Question[]
}

model Question {
  id           String        @id @default(cuid())
  enonce       String
  type         QuestionType  @default(BUZZER)
  reponse      String
  indice       String?
  points       Int           @default(100)
  tempsLimite  Int           @default(30)   // secondes
  mediaUrl     String?       // image ou audio uploadé
  videoUrl     String?       // lien YouTube/TikTok
  videoDebut   Int?          // timestamp début extrait (secondes)
  videoFin     Int?          // timestamp fin extrait
  difficulte   Difficulte    @default(MOYEN)
  publique     Boolean       @default(false)
  categorieId  String?
  categorie    Categorie?    @relation(fields: [categorieId], references: [id])
  rubriqeId    String?
  rubrique     Rubrique?     @relation(fields: [rubriqeId], references: [id])
  createdById  String?
  createdAt    DateTime      @default(now())
}

enum QuestionType {
  BUZZER       // Premier à buzzer et répondre oralement
  QCM          // Choix multiple affiché à l'écran
  VRAI_FAUX
  IMAGE        // Identifier l'image
  VIDEO        // Extrait vidéo à identifier
  AUDIO        // Extrait audio à identifier
}

enum Difficulte {
  FACILE
  MOYEN
  DIFFICILE
}

// ── PARTIES ───────────────────────────────────────────────

model Partie {
  id           String       @id @default(cuid())
  nom          String
  code         String       @unique  // ex: QUIZ42 (6 chars)
  status       PartieStatus @default(EN_ATTENTE)
  animateurId  String
  animateur    User         @relation(fields: [animateurId], references: [id])
  pointsBonus  Int          @default(0)   // bonus premier buzzer
  createdAt    DateTime     @default(now())
  startedAt    DateTime?
  finishedAt   DateTime?

  manches      Manche[]
  scores       Score[]
}

enum PartieStatus {
  EN_ATTENTE
  EN_COURS
  TERMINEE
  ANNULEE
}

model Manche {
  id           String    @id @default(cuid())
  nom          String
  ordre        Int
  partieId     String
  partie       Partie    @relation(fields: [partieId], references: [id])
  pointsParQ   Int       @default(100)
  tempsLimite  Int       @default(30)

  questionIds  String[]  // IDs des questions dans l'ordre
}

model Score {
  id        String  @id @default(cuid())
  partieId  String
  partie    Partie  @relation(fields: [partieId], references: [id])
  buzzerId  String
  buzzer    Buzzer  @relation(fields: [buzzerId], references: [id])
  userId    String?
  user      User?   @relation(fields: [userId], references: [id])
  points    Int     @default(0)
  buzzCount Int     @default(0)
  rang      Int?

  @@unique([partieId, buzzerId])
}

// ── PAIEMENTS ─────────────────────────────────────────────

model Paiement {
  id              String          @id @default(cuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  montant         Float
  devise          String          @default("XOF")
  moyen           MoyenPaiement
  status          PaiementStatus  @default(EN_ATTENTE)
  cinetpayRef     String?         @unique  // Référence CinetPay
  plan            Plan
  dureeMois       Int             @default(1)
  createdAt       DateTime        @default(now())
  confirmedAt     DateTime?
}

enum MoyenPaiement {
  WAVE
  MTN_MONEY
  MOOV_MONEY
  ORANGE_MONEY
  VISA_MASTERCARD
}

enum PaiementStatus {
  EN_ATTENTE
  CONFIRME
  ECHEC
  REMBOURSE
}

// ── AUTH ─────────────────────────────────────────────────

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## LIMITES DU PLAN (middleware/plan.js)

```javascript
// Limites strictes selon le plan de l'utilisateur
const LIMITES = {
  FREE: {
    partiesParMois:   3,
    joueursParPartie: 4,
    questionsParPartie: 10,
    buzzersMax:       4,
    categoriesAccess: ['CULTURE_GENERALE', 'SPORT', 'GEOGRAPHIE'],
    videoQuestions:   false,
    bibliothequePartagee: false,
    exportResultats:  false,
  },
  PRO: {
    partiesParMois:   Infinity,
    joueursParPartie: 20,
    questionsParPartie: Infinity,
    buzzersMax:       20,
    categoriesAccess: 'ALL',
    videoQuestions:   true,
    bibliothequePartagee: true,
    exportResultats:  true,
  }
}

// Prix abonnement Pro
const PRIX_PRO = {
  mensuel: 3500,  // XOF (~5€)
  devise: 'XOF'
}
```

---

## WEBSOCKET — PROTOCOLE MESSAGES COMPLET

### Connexion initiale (ESP32 → Serveur)
```json
{
  "type": "buzzer_connect",
  "mac": "A4CF12B309E1",
  "firmware": "1.0.0"
}
```

### Mode Pairing (ESP32 → Serveur)
Déclenché : bouton physique maintenu 3 secondes
```json
{ "type": "pairing_request", "mac": "A4CF12B309E1" }
```
Réponse serveur :
```json
{ "type": "pairing_waiting", "timeout": 30 }
```
Validation depuis la plateforme web (Client → Serveur) :
```json
{ "type": "pairing_confirm", "mac": "A4CF12B309E1", "userId": "clxxx" }
```
Confirmation finale vers le buzzer :
```json
{ "type": "pairing_success", "playerName": "Zadi", "userId": "clxxx" }
```

### Rejoindre une salle
```json
{ "type": "join_room", "mac": "A4CF12B309E1", "roomCode": "QUIZ42" }
```

### Buzz
```json
{ "type": "buzz", "mac": "A4CF12B309E1", "roomCode": "QUIZ42", "tsLocal": 1748432156 }
```

### Résultat arbitrage (Serveur → tous dans la salle)
```json
{
  "type": "buzz_result",
  "winnerId": "A4CF12B309E1",
  "winnerName": "Zadi",
  "reactionMs": 342,
  "loserIds": ["B8271A...", "C3F09B..."]
}
```

### Commandes animateur (Client → Serveur)
```json
{ "type": "start_game",    "roomCode": "QUIZ42" }
{ "type": "next_question", "roomCode": "QUIZ42" }
{ "type": "validate_answer","roomCode": "QUIZ42", "winnerId": "A4CF12B309E1", "correct": true }
{ "type": "invalidate",    "roomCode": "QUIZ42" }
{ "type": "reset_buzz",    "roomCode": "QUIZ42" }
{ "type": "end_game",      "roomCode": "QUIZ42" }
```

### Mises à jour serveur → tous (Serveur → broadcast salle)
```json
{ "type": "game_started",    "firstQuestion": { ...question } }
{ "type": "question_display","question": { ...question }, "mancheNom": "Culture G.", "timer": 30 }
{ "type": "score_update",    "scores": [ {"name":"Zadi","points":300,"rang":1}, ... ] }
{ "type": "round_over",      "classement": [...] }
{ "type": "game_over",       "podium": [ {"rang":1,"name":"Zadi","points":850}, ... ] }
```

### Statuts LED (Serveur → buzzer spécifique)
```json
{ "type": "led_ready"  }  // Vert fixe
{ "type": "led_locked" }  // Rouge fixe
{ "type": "led_winner" }  // Bleu fixe
{ "type": "reset"      }  // Retour vert
```

---

## CODE ESP32 COMPLET (Arduino)

### config.h
```cpp
#pragma once

// GPIO
#define PIN_BUTTON        4
#define PIN_LED_R         5
#define PIN_LED_G         6
#define PIN_LED_B         7

// Timings
#define DEBOUNCE_MS       50
#define PAIRING_HOLD_MS   3000   // Maintenir 3s pour pairing
#define PAIRING_TIMEOUT   30000  // 30s de fenêtre pairing
#define WS_RECONNECT_MS   5000
#define WS_HEARTBEAT_MS   15000

// Serveur
#define SERVER_HOST       "localhost"   // Changer pour production
#define SERVER_PORT       3001
#define SERVER_PATH       "/ws"
#define USE_SSL           false         // true en production

// WiFiManager
#define WIFI_AP_PASSWORD  "gbairai123"
#define WIFI_TIMEOUT_S    180
```

### buzzer_gbairai.ino
Implémenter la logique complète avec les états suivants :

**États LED :**
- `LED_OFF` : éteinte
- `LED_PORTAL` : blanc clignotant 500ms → portail captif WiFiManager actif
- `LED_SEARCHING` : rouge clignotant 1s → connexion WiFi
- `LED_CONNECTING` : jaune clignotant 200ms → connexion WebSocket serveur
- `LED_READY` : vert fixe → connecté et prêt
- `LED_PAIRING` : violet clignotant 300ms → mode pairing actif
- `LED_PRESSED` : bleu flash → buzz envoyé, attente résultat
- `LED_WINNER` : bleu fixe → gagné ce round
- `LED_LOCKED` : rouge fixe → quelqu'un d'autre a buzzé
- `LED_ERROR` : 3 flash rouge rapides → pas connecté

**Logique bouton :**
- Appui court (<3s) : envoyer buzz si connecté et non verrouillé
- Maintien 3s : déclencher mode pairing, LED violette
- Maintien 5s au démarrage : reset WiFi (effacer credentials)

**Preferences NVS :**
- Namespace : "gbairai"
- Clés : "name" (String), "room" (String), "userId" (String), "paired" (Bool)

**WiFiManager :**
- Paramètres custom dans le portail : prénom joueur, code salle
- Nom hotspot : "Gbairai-XXXXXX" (6 derniers chars MAC)
- Page de config visible à 192.168.4.1

---

## PAGE "GET STARTED" (QR Code)

URL unique par buzzer : `https://gbairai.ci/start?mac=A4CF12B309E1`

La page doit afficher un guide visuel étape par étape en français :

**Étape 1 — Votre buzzer crée un réseau WiFi temporaire**
Afficher : nom du réseau `Gbairai-XXXXXX` (calculé depuis MAC)
Bouton cliquable : "Se connecter au réseau Gbairai-XXXXXX"
(deep link mobile : `wifi://...` ou instructions claires)

**Étape 2 — Configurer votre WiFi**
Lien cliquable direct : `http://192.168.4.1`
Instruction : choisir son réseau et entrer le mot de passe

**Étape 3 — C'est prêt !**
La LED verte indique que le buzzer est connecté
Bouton : "Créer mon compte Gbairai" → `/register`

---

## INTERFACES UTILISATEUR

### Page Landing (/)
- Hero : "Gbairai — Le jeu de quiz avec vrais buzzers"
- Section comment ça marche (3 étapes illustrées)
- Tarifs Free vs Pro
- CTA : S'inscrire gratuitement

### Dashboard Joueur (/joueur)
- Statut de son buzzer (connecté / hors ligne / en pairing)
- Bouton "Ajouter mon buzzer" → PairingModal
  - Instructions : allumer le buzzer, maintenir le bouton 3s
  - Champ : Adresse MAC (imprimée sous le buzzer)
  - Bouton Valider
- Rejoindre une salle : champ code + bouton Rejoindre
- Historique des 5 dernières parties

### Dashboard Animateur (/animateur)
- Tableau de bord :
  - Nombre de buzzers enregistrés et connectés (en temps réel)
  - Parties du mois restantes (plan Free) ou illimitées (Pro)
  - Prochaines parties planifiées
- Mes Buzzers : liste avec statut temps réel, ajout/suppression
- Bibliothèque de questions : filtres par catégorie/rubrique/difficulté
- Créer une partie :
  - Nom de la partie
  - Ajouter des manches (nom, points, timer)
  - Pour chaque manche : ajouter des questions depuis la bibliothèque ou en créer
  - Bouton Lancer la partie → génère le code salle (6 chars aléatoires)

### Interface Jeu Animateur (/jeu/:code/animateur)
- Colonne gauche : liste joueurs/buzzers avec statut
- Centre : question actuelle (grand affichage)
- Boutons : Question suivante, Valider bonne réponse, Invalider, Reset buzz
- Timer visible
- Classement temps réel

### Écran Principal (/jeu/:code/ecran)
- Conçu pour TV/projecteur (mode plein écran)
- Affiche : question courante, timer, classement
- Animation "BUZZZ !" quand quelqu'un buzze (nom en grand)
- Podium animé en fin de partie

### Abonnement Pro (/animateur/abonnement)
- Comparatif Free vs Pro
- Prix : 3 500 XOF/mois
- Bouton Passer Pro → Checkout CinetPay
- Moyens de paiement : Wave, MTN Money, Moov Money, Orange Money, Visa/Mastercard

---

## INTÉGRATION CINETPAY

Documentation : https://cinetpay.com/docs

**Flux de paiement :**
1. Client clique "Passer Pro"
2. Backend crée une transaction CinetPay :
   ```javascript
   POST https://api-checkout.cinetpay.com/v2/payment
   {
     "apikey": process.env.CINETPAY_API_KEY,
     "site_id": process.env.CINETPAY_SITE_ID,
     "transaction_id": paiement.id,
     "amount": 3500,
     "currency": "XOF",
     "description": "Abonnement Gbairai Pro - 1 mois",
     "return_url": "https://gbairai.ci/paiement/confirmation",
     "notify_url": "https://gbairai.ci/api/payments/webhook",
     "customer_name": user.prenom,
     "customer_email": user.email
   }
   ```
3. Redirection vers la page de paiement CinetPay
4. Webhook CinetPay → `/api/payments/webhook` (vérification signature)
5. Si paiement confirmé → upgrade user.plan = PRO, planExpireAt = +30j
6. Cron job quotidien : vérifier les plans expirés → downgrade FREE

---

## VARIABLES D'ENVIRONNEMENT (.env.example)

```env
# Base de données
DATABASE_URL="postgresql://gbairai:password@localhost:5432/gbairai_db"

# JWT
JWT_SECRET="CHANGE_MOI_EN_PROD_64_CHARS_MIN"
JWT_REFRESH_SECRET="CHANGE_MOI_AUSSI_64_CHARS_MIN"

# Serveur
PORT=3001
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"

# CinetPay
CINETPAY_API_KEY="votre_api_key"
CINETPAY_SITE_ID="votre_site_id"

# Email (optionnel pour le dev)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="votre@email.com"
SMTP_PASS="votre_mot_de_passe"
```

---

## DOCKER-COMPOSE (PostgreSQL local)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: gbairai
      POSTGRES_PASSWORD: password
      POSTGRES_DB: gbairai_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## ORDRE D'IMPLÉMENTATION — ÉTAPE PAR ÉTAPE

Implémenter dans cet ordre strict. Valider chaque étape avant de passer à la suivante.

### ÉTAPE 1 — Infrastructure de base
1. Initialiser le projet (server/ + client/ + docker-compose.yml)
2. Lancer PostgreSQL via Docker
3. Configurer Prisma + créer le schéma + migrer
4. Configurer Express avec les middlewares de base (cors, json, helmet)
5. Implémenter le serveur WebSocket (wsServer.js)
6. Seeder les données initiales (catégories, 10 questions de démo)
7. Vérifier : `npm run dev` fonctionne sans erreur

### ÉTAPE 2 — Authentification
1. Routes : POST /api/auth/register, POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout
2. Middleware auth.js (vérification JWT)
3. Frontend : pages Login.jsx et Register.jsx fonctionnelles
4. Vérifier : inscription → connexion → token valide

### ÉTAPE 3 — Gestion des buzzers
1. Routes CRUD : GET/POST/DELETE /api/buzzers
2. WebSocket : gérer buzzer_connect, pairing_request, pairing_confirm
3. Mise à jour statut buzzer en temps réel dans la DB
4. Frontend : BuzzerCard.jsx avec statut live, PairingModal.jsx
5. Vérifier : simuler une connexion buzzer via wscat ou Postman WS

### ÉTAPE 4 — Questions et bibliothèque
1. Routes : CRUD /api/questions, /api/categories
2. Upload d'images : POST /api/questions/upload (Multer)
3. Frontend : liste questions avec filtres, formulaire création, import CSV
4. Vérifier : créer 5 questions de types différents

### ÉTAPE 5 — Création et gestion des parties
1. Routes : CRUD /api/parties, gestion manches
2. Génération code salle unique 6 chars
3. Frontend : CreatePartie.jsx avec ajout manches + questions par drag & drop
4. Vérifier : créer une partie complète avec 2 manches et 5 questions chacune

### ÉTAPE 6 — Moteur de jeu temps réel
1. gameHandler.js : machine à états de la partie
   - États : EN_ATTENTE → EN_COURS → QUESTION_AFFICHEE → BUZZ_RECU → VALIDATION → QUESTION_SUIVANTE → TERMINEE
2. arbitrage.js : horodatage serveur, sélection gagnant, calcul points
3. rooms.js : gestion des salles (join, leave, broadcast)
4. Frontend : AnimateurJeu.jsx avec tous les contrôles
5. Frontend : EcranPrincipal.jsx (mode TV)
6. Vérifier : jouer une partie complète en local avec 2 buzzers simulés

### ÉTAPE 7 — Page Get Started et QR codes
1. Route GET /start?mac=XXXXXX → page React GetStarted.jsx
2. Affichage dynamique du nom du hotspot selon MAC
3. Guide visuel étape par étape en français
4. Backend : générer et stocker le QR code image pour chaque buzzer
5. Vérifier : scanner le QR → arriver sur la bonne page avec le bon hotspot

### ÉTAPE 8 — Code ESP32 complet
1. buzzer_gbairai.ino avec tous les états LED
2. wifi_manager.h : WiFiManager + portail captif
3. websocket_client.h : connexion + reconnexion auto + heartbeat
4. button_handler.h : debounce + appui court + maintien 3s pairing + reset 5s
5. preferences_mgr.h : load/save NVS
6. Vérifier : buzzer physique se configure, se connecte et buzze correctement

### ÉTAPE 9 — Freemium et limites
1. Middleware plan.js : vérifier les limites selon le plan à chaque action
2. Afficher les limites restantes dans le dashboard
3. Bloquer les actions quand limite atteinte + afficher CTA upgrade
4. Vérifier : compte FREE ne peut pas créer une 4e partie dans le mois

### ÉTAPE 10 — Paiement CinetPay
1. Routes : POST /api/payments/initiate, POST /api/payments/webhook
2. Webhook sécurisé (vérification signature CinetPay)
3. Cron job : vérification quotidienne des plans expirés
4. Frontend : page Abonnement.jsx avec comparatif + bouton checkout
5. Vérifier : simuler un paiement en mode test CinetPay

---

## RÈGLES DE DÉVELOPPEMENT

- Toujours valider les données entrantes (Zod côté client, Joi ou validation manuelle côté serveur)
- Toutes les réponses API en JSON avec la structure : `{ success: true, data: ... }` ou `{ success: false, error: "message" }`
- Les erreurs WebSocket ne doivent jamais crasher le serveur (try/catch partout)
- L'arbitrage du buzz se fait TOUJOURS côté serveur, jamais côté client
- Les mots de passe : bcrypt avec salt rounds = 12
- Les codes de salle : 6 caractères alphanumériques majuscules, sans ambiguïté (pas de 0/O, 1/I/L)
- Logger toutes les actions importantes (Winston) : connexions buzzers, buzz, paiements
- Commenter le code en français
- Chaque fichier doit avoir un commentaire d'en-tête décrivant son rôle

---

## POUR COMMENCER

Commence par l'ÉTAPE 1. Pour chaque étape :
1. Créer tous les fichiers nécessaires
2. Implémenter la logique complète
3. Tester que ça fonctionne
4. Afficher un résumé de ce qui a été fait
5. Demander confirmation avant de passer à l'étape suivante

Commence maintenant par initialiser la structure du projet et configurer l'infrastructure de base.
