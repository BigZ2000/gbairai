# Gbairai — Plateforme de jeux concours avec buzzers connectés

## Architecture

```
gbairai/
├── server/          # Backend Node.js + Express + Prisma + WebSocket
│   ├── prisma/      # Schéma DB (PostgreSQL)
│   └── src/
│       ├── routes/  # auth, parties, buzzers
│       ├── services/# buzzerService (propriété permanente)
│       ├── ws/      # WebSocket server + gameHandler
│       └── middleware/
└── client/          # Frontend React + Tailwind
    └── src/
        ├── pages/   # Dashboard, SalleAttente, AnimateurJeu, EcranPrincipal, MonCompte, CreatePartie
        ├── components/buzzer/BuzzerAnime.jsx
        └── context/ # AuthContext, WsContext
```

## Lancer en développement

### Backend
```bash
cd gbairai/server
cp .env.example .env      # configurer DATABASE_URL et JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run dev               # port 4000
```

### Frontend
```bash
cd gbairai/client
npm install
npm run dev               # port 5173
```

## Concepts clés

### Rôles contextuels
Pas de rôle global. Celui qui **crée** une partie est animateur de cette partie. Celui qui **rejoint** est joueur.

### Propriété des buzzers
La MAC fait foi. Le premier utilisateur à claimer un buzzer en devient propriétaire permanent.  
Changer de WiFi ne change pas le propriétaire.  
La libération est explicite uniquement (depuis MonCompte).

### Modes de partie
- **Avec animateur** : validation manuelle de chaque réponse
- **Automatique** : timer seul, aucune intervention humaine
- **Vote collectif** : les joueurs votent 👍/👎 sur chaque réponse

### Composant BuzzerAnime
Buzzer visuel animé avec 5 états :
- `offline` → gris, opacité 50%
- `ready` → couleur + glow pulsant
- `pressed` → enfoncement + ripple
- `winner` → bounce + étoiles + "PREMIER !"
- `locked` → rouge + shake

Mis à jour en <100ms via WebSocket.
