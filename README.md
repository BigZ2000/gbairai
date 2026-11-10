# Gbairai — Plateforme de quiz & buzzers connectés

> **Philosophie : Scanner → Jouer → S'amuser.** Zéro friction, mobile-first,
> plug & play. Un invité rejoint par QR/code avec un simple pseudo — sans compte.

## Architecture

```
gbairai/
├── server/                  # Backend Node.js (ESM) + Express + Prisma + WebSocket (ws)
│   ├── prisma/              # Schéma PostgreSQL, migrations, seeds (questions, packs, médias démo)
│   ├── scripts/             # Outils (générateur pack drapeaux, purge invités…)
│   ├── catalog/             # Catalogues CSV (questions médias) + jeu de démo
│   └── src/
│       ├── routes/          # auth (email/téléphone/Google), parties, packs, import, admin…
│       ├── services/        # gameService (tirage), quotaService (freemium), buzzerService
│       │   └── ai/          # création de quiz par IA : fournisseur Claude, contrôle, quotas
│       ├── ws/              # wsServer + gameHandler (moteur de jeu temps réel)
│       └── config/          # mailer (SMTP), sms (Twilio), settings (réglages admin), plans
├── client/                  # Frontend React 18 + Vite + Tailwind (icônes lucide)
│   └── src/
│       ├── pages/           # Dashboard, QuizStudio, CreatePartie, SalleAttente,
│       │                    # JoueurJeu, AnimateurJeu, EcranPrincipal, admin/…
│       ├── components/      # Layout, LaunchSheet, QuestionMedia, BuzzerAnime, Podium…
│       └── context/         # AuthContext (JWT + refresh), WsContext
├── tools/
│   ├── firmware-esp32/      # Firmware buzzer physique (+ guide matériel complet)
│   └── buzzer-simulator/    # Simulateur de buzzer (même protocole WS)
└── docs/                    # Audits (jouabilité, packs, drapeaux), devops (AWS/CD), guides
```

## Lancer en développement

### Backend
```bash
cd server
cp .env.example .env          # DATABASE_URL, JWT_SECRET(S) — MAIL/SMS et ANTHROPIC_API_KEY si besoin
npm install
npx prisma migrate deploy && npx prisma generate
node prisma/seed-full.js      # bibliothèque de questions + admin
node prisma/seedPacks.js      # catalogue de packs (idempotent)
npm run dev                   # port 4000 (HTTP + WebSocket)
```

### Frontend
```bash
cd client
npm install
npm run dev                   # port 5173 (proxy /api et /ws → 4000)
# Port 4000 déjà pris ? GBAIRAI_API=http://localhost:4100 npm run dev
```

### Tests
```bash
cd server
npm test                      # unitaires (sans base ni réseau)
DATABASE_URL=… JWT_SECRET=test npm run test:integration
#   base réelle ; IA et CinetPay simulés : Mes quiz, IA, équipes jouées par le
#   moteur, bilan, images, logo, paiement, contrôle d'accès du jeu
BASE=http://localhost:4100 DATABASE_URL=… JWT_SECRET=<celui du serveur> npm run test:e2e
#   sur un serveur EN MARCHE, par de vraies connexions WebSocket : modes
#   animateur (avec un buzzer matériel simulé) et vote, tentatives de triche
cd ../client && npm test      # composants (jsdom) : équipes, lancement, retour de paiement…
```
La CI lance les tests unitaires, les tests du client et les tests d'intégration
(base PostgreSQL jetable), puis construit les images.

### Production
`docker-compose.prod.yml` : Caddy (TLS auto) + serveur Node + PostgreSQL.
Déploiement continu : push sur `main` → GitHub Actions → SSH EC2 →
`docker compose up -d --build`. L'entrypoint applique le schéma Prisma et
re-seed les packs (idempotent, `SEED_PACKS=false` pour désactiver).

## Concepts clés

### Modes de partie
- **Solo** : préréglage auto + distanciel — on joue seul, tout s'affiche sur son écran.
- **Automatique** *(recommandé)* : le serveur rythme tout (minuteur, révélation,
  scores). QCM/Vrai-Faux vérifiés ; en distanciel, les questions ouvertes sont
  saisies et vérifiées par correspondance intelligente (tolère les fautes) ;
  en présentiel, le buzzer est un jeu de réflexe (le 1er qui buzze marque).
- **Avec animateur** : l'animateur présente, révèle et juge (il est hors classement).
- **Vote collectif** : la salle valide la réponse du buzzeur (minimum 3 joueurs).

### Création de partie (plug & play)
Deux écrans : **Essentiel** (nom + mode → « Créer la partie », options avancées
repliées : distanciel, élimination, vies, régie animateur) et **Manches** (optionnel) :
thème = catégories réelles de la base, **filtre par type de question**
(QCM, Vrai/Faux, réponse libre, image, audio, vidéo), difficulté, points, temps,
mécaniques jeux TV (malus, multiplicateur, élimination). Le tirage garantit
qu'une question (ou un même sujet, ex. un pays) ne sort jamais deux fois.

### Mes quiz et création par IA
Chaque compte crée ses propres quiz (`/quiz/nouveau`) : **en une phrase, avec
l'IA** (Claude — offre Premium, un essai offert), ou à la main. L'IA rend un
brouillon ; rien n'est enregistré avant relecture. Le serveur re-contrôle chaque
question contre les règles du moteur et n'accepte que des médias présents dans
la médiathèque. Un quiz personnel est un pack privé (`Pack.ownerId`) : il se
lance comme n'importe quel pack. Sans `ANTHROPIC_API_KEY`, la fonction est
désactivée et l'interface le dit. Détails : `docs/GENERATION_IA.md`.

### Lancer une partie
Deux choix au plus : **jouer seul** (démarrage immédiat, gratuit, illimité) ou
**à plusieurs** — « chacun son téléphone » ou « un grand écran », chacun pour
soi ou **en 2 à 4 équipes**. Le mode conseillé du pack s'applique ; « Qui
anime ? » reste accessible, replié.

### Équipes, écran public et bilan
- **Équipes** (`Partie.equipes`, `Participant.equipe`) : les joueurs sont
  répartis à l'arrivée, chacun peut changer de camp en salle d'attente, l'hôte
  déplace qui il veut et renomme les équipes. Score d'équipe = somme des scores
  des membres (à égalité, la plus petite équipe passe devant). Aucun barème
  propre : tous les modes fonctionnent en équipes.
- **Écran public** (`/screen/CODE`) : avant le lancement, un QR géant, le code
  et les prénoms qui arrivent (par équipe) ; en jeu, le score des équipes ;
  à la fin, équipes et podium côte à côte.
- **Bilan** (fiche de la partie dans l'historique) : taux de bonnes réponses,
  question qui a piégé la salle, plus rapide, plus juste, taux par question,
  classement des équipes. Bouton « Imprimer ou PDF » (mise en page d'impression).
- **Logo d'organisation** : posé par le responsable (Mon organisation), affiché
  sur l'écran public, la salle d'attente et le bilan des parties de ses membres.

### Paiement (CinetPay)
API CinetPay v1, d'après le SDK officiel `cinetpay/cinetpay-js` : jeton
d'accès, initialisation (`/v1/payment`), statut (`/v1/payment/:id`). Une offre
n'est activée **qu'après vérification du statut auprès de CinetPay** : la
notification doit porter le `notify_token` reçu à l'initialisation, puis le
serveur redemande le statut ; la page de retour re-vérifie aussi. Sans
identifiants (`CINETPAY_ENABLED`, `CINETPAY_API_KEY`, `CINETPAY_API_PASSWORD`),
le paiement est **fermé** en production (la page des offres l'annonce) ; le
règlement simulé n'existe qu'en développement (`PAIEMENT_SIMULATION`).
Testé contre un CinetPay simulé, **pas encore contre le bac à sable réel**.

### Packs prêts à jouer
Catalogue piloté en base (Admin → Packs) : packs thématiques, « jeux TV »
(Survivor, Double ou Rien…), drapeaux/capitales par région (Afrique, CEDEAO,
G20, Francophonie). Un clic « Jouer maintenant » lance une partie solo
instantanée (la salle d'attente est sautée).

### Questions & médias
Types : `QCM`, `VRAI_FAUX`, `BUZZER` (réponse libre), `IMAGE`, `AUDIO`, `VIDEO`.
Le média est indépendant du type (une question Vrai/Faux peut montrer un drapeau)
et les **choix de réponse peuvent être des images** (`choices` riches).
Import en masse : Admin → Import (CSV + médias/ZIP, ou **pack visuel**
ZIP `manifest.json + media/` — voir `docs/manifest.exemple.json`).
Générateur drapeaux : `node scripts/flags/generateFlagsPack.js` (254 pays).

### Mécaniques de jeu
Barème unifié : `points × multiplicateur × (50 % garantis + 50 % rapidité)`.
Options : manche à risque (malus), multiplicateur, élimination du dernier,
**vies** (−1 par mauvaise réponse, éliminé à 0). Chronomètre visible sur
l'écran public **et** sur le téléphone du joueur.

### Comptes & accès
Inscription par **email** (code + lien) ou **téléphone** (OTP SMS, normalisation
+225) — vérifications activables dans Admin → Réglages (banc de test d'envoi
intégré). Connexion par email ou téléphone, Google OAuth. **Invités** : pseudo
seul via QR/lien, purgés après 7 jours. Freemium : plan FREE = solo illimité, 10 parties
à plusieurs par mois, 20 joueurs, 3 quiz personnels ; Premium ajoute ses
propres images dans ses quiz (privées, 100 max, 5 Mo chacune) ; plans PRO (« Premium »)
/ENTREPRISE/ECOLE au-delà. Un plan payant est un pass à échéance
(`planExpireAt`) : passé cette date, le compte retombe en FREE.

### Buzzers physiques (ESP32)
La MAC fait foi : le premier à réclamer un buzzer en est propriétaire permanent
(libération explicite dans Mon compte). Captive portal Wi-Fi au premier
démarrage, serveur codé en dur (wss), LED pilotée par le serveur
(prêt/armé/gagné/verrouillé/révélé), télémétrie batterie/RSSI, mises à jour OTA
depuis Admin → Buzzers. Firmware : `tools/firmware-esp32/` (guide matériel
complet : BOM AliExpress, brochage, alimentation, impression 3D). Le
**simulateur** (`tools/buzzer-simulator/`) parle exactement le même protocole.
Téléphone = repli automatique si le buzzer se déconnecte.

### Temps réel
Un seul évènement `buzz` (web ou matériel) résolu en participant côté serveur.
Le serveur ne croit pas le client sur parole : les commandes de régie (avancer,
révéler, valider, terminer, attribuer un buzzer) sont réservées à l'hôte ; une
réponse, un vote ou un buzz doit venir du compte du joueur concerné ; un buzz
matériel, de la connexion du buzzer lui-même.
Reconnexion transparente (snapshot complet : question, chrono, média, scores).
Médias synchronisés par l'horloge serveur (reprise au bon timecode).

## Identité visuelle
Jetons de couleur, typographie et composants de base : `client/src/index.css`
(thème clair « crème » par défaut, sombre « cacao » en option). Aucune couleur
de fond ou de texte ne se code en dur dans une page.

## Documentation
- `docs/REFONTE_2026.md` — analyse, marché, positionnement, direction artistique, feuille de route
- `docs/GENERATION_IA.md` — création de quiz par IA : mise en service, garde-fous, coûts, limites
- `docs/DEROULEMENT_DES_PARTIES.md` — déroulé réel par mode/type/paramètres
- `docs/AUDIT_JOUABILITE.md`, `docs/AUDIT_PACKS.md`, `docs/AUDIT_DRAPEAUX.md`
- `docs/devops/` — AWS, Docker, CI/CD, sauvegardes
- `tools/firmware-esp32/GUIDE_BUZZER_PHYSIQUE.md` — fabriquer un buzzer
