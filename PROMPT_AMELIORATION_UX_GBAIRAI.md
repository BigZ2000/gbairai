# PROMPT AMÉLIORATION — GBAIRAI
# UX/UI : Rôles unifiés, buzzers flexibles, interface animée
#
# CE PROMPT COMPLÈTE ET CORRIGE LE PROMPT PRINCIPAL (PROMPT_CLAUDE_CODE_GBAIRAI.md)
# déjà présent à la racine du projet. Applique ces changements PAR-DESSUS
# ce qui a déjà été implémenté à l'étape 1.

---

## CHANGEMENT 1 — SUPPRIMER LA NOTION DE RÔLE FIXE

### Ancien modèle (à supprimer)
```
User { role: JOUEUR | ANIMATEUR }
```

### Nouveau modèle
Il n'existe qu'un seul type d'utilisateur. Le rôle est **contextuel à une partie** :
- Celui qui **crée** une partie = animateur de CETTE partie
- Celui qui **rejoint** = joueur de CETTE partie
- Le même utilisateur peut être animateur d'une partie et joueur dans une autre

### Modifier le schéma Prisma

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  password     String
  prenom       String
  // SUPPRIMER le champ role
  plan         Plan      @default(FREE)
  planExpireAt DateTime?
  createdAt    DateTime  @default(now())

  buzzers      Buzzer[]
  partiesCreees Partie[] @relation("AnimateurParties")
  participations Participant[]
  paiements    Paiement[]
  refreshTokens RefreshToken[]
}

// Nouveau modèle pour gérer la participation à une partie
model Participant {
  id          String   @id @default(cuid())
  partieId    String
  partie      Partie   @relation(fields: [partieId], references: [id])
  userId      String?                      // null = joueur invité sans compte
  user        User?    @relation(fields: [userId], references: [id])
  prenom      String                       // affiché en jeu
  buzzerId    String?                      // buzzer utilisé pour CETTE partie
  buzzer      Buzzer?  @relation(fields: [buzzerId], references: [id])
  isAnimateur Boolean  @default(false)     // vrai uniquement pour le créateur
  score       Int      @default(0)
  rang        Int?
  joinedAt    DateTime @default(now())

  @@unique([partieId, userId])
}

model Partie {
  id           String       @id @default(cuid())
  nom          String
  code         String       @unique
  status       PartieStatus @default(EN_ATTENTE)
  animateurId  String                        // créateur de la partie
  animateur    User         @relation("AnimateurParties", fields: [animateurId], references: [id])
  // ...reste inchangé
  participants Participant[]
}
```

### Modifier le middleware auth.js
Remplacer les checks `user.role === 'ANIMATEUR'` par des checks sur la participation :
```javascript
// Vérifier si l'utilisateur est animateur d'UNE partie spécifique
const isAnimateurDePartie = async (userId, partieId) => {
  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  return partie?.animateurId === userId
}
```

### Modifier la navigation frontend
Supprimer les menus séparés "Espace Joueur" / "Espace Animateur".
Un seul dashboard unifié avec deux sections :

```
TABLEAU DE BORD
├── Mes parties créées    (parties où je suis animateur)
└── Mes participations    (parties où je joue)
```

Bouton unique en haut : **"+ Créer une partie"** (accessible à tous)
Champ unique : **"Rejoindre avec un code"** (accessible à tous)

---

## CHANGEMENT 2 — BUZZERS MULTIPLES ET PRÊT FLEXIBLE

### Schéma buzzer enrichi

```prisma
model Buzzer {
  id           String       @id @default(cuid())
  mac          String       @unique
  nom          String?                        // ex: "Buzzer Rouge", "Buzzer de Zadi"
  couleur      String       @default("#3B82F6")
  ownerId      String                         // propriétaire permanent
  owner        User         @relation(fields: [ownerId], references: [id])
  status       BuzzerStatus @default(OFFLINE)
  lastSeenAt   DateTime?
  firmware     String?
  createdAt    DateTime     @default(now())

  participations Participant[]                // utilisé dans ces parties
}
```

### Trois cas d'usage à supporter simultanément dans une partie

**Cas 1 — Joueur avec son propre buzzer**
Le joueur a un buzzer appairé à son compte. Il rejoint la partie.
Son buzzer se lie automatiquement à sa participation.
```
Joueur A (owner buzzer #1) rejoint QUIZ42
→ Participant { userId: A, buzzerId: #1 } créé automatiquement
```

**Cas 2 — Animateur prête un de ses buzzers**
L'animateur possède 4 buzzers. Un joueur n'en a pas.
L'animateur assigne un de ses buzzers à ce joueur depuis son dashboard.
Aucun re-appairage. Valable uniquement pour cette partie.
```
Joueur B (sans buzzer) rejoint QUIZ42
Animateur assigne buzzer #3 (qu'il possède) à Joueur B
→ Participant { userId: B, buzzerId: #3 } mis à jour
Le buzzer #3 reste dans le compte de l'animateur après la partie
```

**Cas 3 — Joueur invité sans compte**
Quelqu'un veut jouer mais n'a pas de compte Gbairai.
L'animateur crée un "joueur invité" avec juste un prénom.
L'animateur lui assigne un buzzer.
```
Animateur crée invité "Kouassi"
→ Participant { userId: null, prenom: "Kouassi", buzzerId: #4 }
```

### Route d'assignation de buzzer (nouvelle)
```
POST /api/parties/:partieId/participants/:participantId/assign-buzzer
Body: { buzzerId: "xxx" }
Auth: doit être l'animateur de la partie ET owner du buzzer
```

### Règle de validation
Un buzzer ne peut être assigné qu'à UN SEUL participant actif à la fois.
Si le buzzer est déjà assigné dans une autre partie EN_COURS → refuser.

---

## CHANGEMENT 3 — INTERFACE DE GESTION DES BUZZERS EN PARTIE

### Nouvelle page : SalleAttente.jsx (redesign complet)

L'animateur voit en temps réel tous les buzzers connectés et peut les assigner.

```
┌─────────────────────────────────────────────────────────┐
│  QUIZ42 · En attente (3/8 joueurs)          [Lancer →] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  JOUEURS                        BUZZERS DISPONIBLES     │
│  ┌──────────────────┐           ┌───────────────────┐   │
│  │ 🟢 Zadi          │           │ 🟢 Buzzer Rouge   │   │
│  │    Buzzer #1 ✓   │           │    Non assigné    │   │
│  └──────────────────┘           └───────────────────┘   │
│  ┌──────────────────┐           ┌───────────────────┐   │
│  │ 🟡 Kouassi       │◄──────────│ 🟢 Buzzer Bleu    │   │
│  │    [Assigner →]  │  glisser  │    Non assigné    │   │
│  └──────────────────┘           └───────────────────┘   │
│  ┌──────────────────┐                                   │
│  │ + Ajouter invité │                                   │
│  └──────────────────┘                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Fonctionnalités :
- Drag & drop ou bouton "Assigner" pour lier buzzer → joueur
- Les buzzers de l'animateur ET ceux des joueurs présents apparaissent
- Indicateur temps réel : buzzer connecté (vert) / hors ligne (gris)
- Chaque joueur peut aussi se connecter avec son propre buzzer sans intervention

---

## CHANGEMENT 4 — COMPOSANT BUZZER ANIMÉ (UI)

### Créer : client/src/components/buzzer/BuzzerAnime.jsx

Un bouton buzzer visuel qui :
- S'**allume** (glow coloré) quand le buzzer est connecté/prêt
- S'**enfonce** (scale down + shadow) quand pressé (physiquement OU en jeu)
- Pulsation douce en attente
- Animation "BUZZ !" explosive quand quelqu'un buzze en premier

```jsx
// BuzzerAnime.jsx
// Props :
//   couleur    : string hex ("#EF4444", "#3B82F6", etc.)
//   statut     : "offline" | "ready" | "pressed" | "winner" | "locked"
//   prenom     : string (affiché sous le buzzer)
//   onPress    : function (si cliquable depuis l'écran)
//   size       : "sm" | "md" | "lg" | "xl"

// ÉTATS VISUELS :
//
// "offline"  → bouton gris, pas de glow, opacité 50%
//
// "ready"    → bouton coloré, glow doux pulsant (animation CSS)
//              scale: 1.0, shadow: 0 0 20px couleur/50%
//              pulsation: scale 1.0 → 1.03 → 1.0 (2s loop)
//
// "pressed"  → enfoncement immédiat
//              scale: 0.88, shadow réduite, transition 80ms
//              cercles concentriques qui s'expandent (ripple)
//
// "winner"   → bounce + explosion de couleur
//              scale: 1.0 → 1.25 → 1.0, glow intense
//              particules étoiles autour (CSS keyframes)
//              texte "PREMIER !" apparaît en surimpression
//
// "locked"   → teinte rouge, légère vibration (shake 3x)
//              opacité 70%, glow rouge

// STRUCTURE SVG/CSS du bouton :
// - Cercle extérieur (anneau) : couleur principale, shadow glow
// - Cercle intermédiaire : dégradé légèrement plus clair
// - Bouton central (le dôme) : couleur principale + highlight blanc en haut
//   → c'est lui qui se "déplace" vers le bas au press (translateY +4px)
// - Ombre portée sous le bouton : disparaît au press (effet 3D)
// - Prénom en dessous
// - Indicateur WiFi tiny en haut à droite (vert/gris)

// IMPLÉMENTATION :
// Utiliser uniquement CSS animations + Tailwind
// Pas de librairie d'animation externe
// Les transitions doivent être fluides à 60fps
// Supporter le dark mode automatiquement
```

### Utiliser BuzzerAnime dans ces pages :

**SalleAttente.jsx** : taille `lg`, tous les buzzers de la partie

**AnimateurJeu.jsx** : taille `sm`, colonne latérale, mis à jour en temps réel

**EcranPrincipal.jsx** : taille `xl`, affiché en grand quand quelqu'un buzze

**MonCompte.jsx** : taille `md`, liste de tous ses buzzers avec statut

### Synchronisation temps réel

Quand un buzzer physique est pressé, le serveur envoie via WebSocket :
```json
{ "type": "buzzer_pressed_visual", "mac": "A4CF12B309E1" }
```
→ Tous les clients de la salle reçoivent ce message
→ Le composant BuzzerAnime correspondant passe en statut "pressed" instantanément
→ Si c'est le gagnant, passe à "winner" 200ms après

---

## CHANGEMENT 5 — DASHBOARD UNIFIÉ (redesign)

### Supprimer
- Page `/joueur/Dashboard.jsx`
- Page `/animateur/Dashboard.jsx`
- Toute logique de redirection selon le rôle

### Créer : client/src/pages/Dashboard.jsx (page unique)

```
┌──────────────────────────────────────────────────────┐
│  Bonsoir, Zadi 👋                    [+ Créer] [⚙️]  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Rejoindre avec un code : _______ ] [→ Rejoindre]   │
│                                                       │
├───────────────────────┬──────────────────────────────┤
│   MES PARTIES         │   MES BUZZERS                │
│   ─────────────────   │   ─────────────────────────  │
│   [Actives]           │   [BuzzerAnime sm] Buzz #1   │
│   QUIZ42 · En cours   │   🟢 Connecté                │
│   3 joueurs · >       │                              │
│                       │   [BuzzerAnime sm] Buzz #2   │
│   [Passées]           │   ⚫ Hors ligne              │
│   Soirée du 24 mai    │                              │
│   5 joueurs · >       │   [+ Ajouter un buzzer]      │
│                       │                              │
└───────────────────────┴──────────────────────────────┘
```

---

## CHANGEMENT 6 — WEBSOCKET : NOUVEAUX MESSAGES

Ajouter ces types de messages au wsServer.js existant :

```javascript
// Buzzer pressé visuellement (broadcast à toute la salle)
{ type: "buzzer_pressed_visual", mac: "...", partieCode: "QUIZ42" }

// Assignation buzzer à un joueur (animateur → serveur)
{ type: "assign_buzzer", buzzerId: "...", participantId: "...", partieCode: "QUIZ42" }

// Confirmation assignation (serveur → salle)
{ type: "buzzer_assigned", buzzerId: "...", participantId: "...", prenom: "Kouassi" }

// Retrait assignation
{ type: "unassign_buzzer", buzzerId: "...", partieCode: "QUIZ42" }

// Statut buzzer mis à jour (diffusé en continu)
{ type: "buzzer_status_update", mac: "...", status: "ready" | "offline" | "in_game" }
```

---

## ORDRE D'APPLICATION DE CES CHANGEMENTS

Applique dans cet ordre, en modifiant le code déjà généré :

1. **Schéma Prisma** : modifier User (supprimer role), créer Participant et Vote,
   modifier Partie (animateurId nullable, modeAuto, modeVote) et Buzzer (claimedAt)
   → `npx prisma migrate dev --name "refactor_roles_buzzer_propriete"`

2. **buzzerService.js** : implémenter `onBuzzerConnect` avec logique premier arrivé,
   route de libération `DELETE /api/buzzers/:mac/claim`,
   notification au propriétaire si tentative de claim sur buzzer pris

3. **Backend routes** :
   - Mettre à jour `/api/auth` (supprimer la notion de rôle à l'inscription)
   - Mettre à jour `/api/parties` (animateurId nullable, modeAuto, modeVote)
   - Ajouter `POST /api/parties/:id/participants` (rejoindre)
   - Ajouter `POST /api/parties/:id/participants/:pid/assign-buzzer`
   - Ajouter `POST /api/parties/:id/participants/invite` (invité sans compte)
   - Ajouter `POST /api/parties/:id/votes` (vote collectif)

4. **WebSocket** : ajouter tous les nouveaux types de messages dans wsServer.js
   et gameHandler.js (mode auto, mode vote, buzzer_pressed_visual, claim/libération)

5. **Composant BuzzerAnime.jsx** : créer le composant animé complet

6. **Dashboard.jsx unifié** : remplacer les deux dashboards séparés

7. **SalleAttente.jsx** : refaire avec la nouvelle logique d'assignation

8. **CreatePartie.jsx** : ajouter le sélecteur de mode (avec animateur / auto / vote)

9. **AnimateurJeu.jsx** : adapter selon le mode de la partie (boutons différents)

10. **EcranPrincipal.jsx** : intégrer BuzzerAnime + interface vote si mode vote

11. **Nettoyer** : supprimer tous les fichiers des anciens dashboards séparés,
    supprimer toutes les références à `user.role` partout dans le code

---

## CHANGEMENT 7 — PARTIE SANS ANIMATEUR (MODE AUTONOME)

### Concept
Une partie peut se dérouler sans qu'il y ait un animateur humain désigné.
Dans ce cas, la partie se pilote de façon **collective ou automatique**.

### Deux sous-modes à implémenter

**Mode automatique (timer seul)**
La partie avance toute seule : chaque question s'affiche pendant le temps imparti,
le buzz est arbitré par le serveur, puis la question suivante s'affiche automatiquement.
Aucune intervention humaine requise.

**Mode vote collectif**
Après chaque buzz, les participants votent ensemble (👍 / 👎) sur l'interface web
pour valider ou invalider la réponse. La majorité l'emporte.
Si égalité → la réponse est invalidée par défaut.

### Modifier le schéma Prisma

```prisma
model Partie {
  // ...champs existants...
  animateurId   String?              // NULLABLE — null = partie sans animateur
  animateur     User?   @relation(...)
  modeAuto      Boolean @default(false)  // true = avance automatiquement
  modeVote      Boolean @default(false)  // true = validation par vote collectif
}

// Vote des participants sur une réponse
model Vote {
  id            String      @id @default(cuid())
  partieId      String
  partie        Partie      @relation(fields: [partieId], references: [id])
  questionIndex Int
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id])
  valide        Boolean     // true = bonne réponse, false = mauvaise
  createdAt     DateTime    @default(now())

  @@unique([partieId, questionIndex, participantId])
}
```

### Modifier la création de partie (CreatePartie.jsx)

Ajouter un sélecteur de mode dans le formulaire :

```
MODE DE LA PARTIE
  ○ Avec animateur       → l'animateur valide chaque réponse manuellement
  ○ Automatique          → timer seul, pas de validation humaine
  ○ Vote collectif       → les joueurs votent ensemble pour valider
```

Si "Avec animateur" est sélectionné → le créateur devient animateur (comportement actuel)
Si "Automatique" ou "Vote collectif" → `animateurId = null`, tous les participants sont égaux

### Règles spécifiques au mode sans animateur

- N'importe quel participant peut lancer la partie (pas de rôle exclusif)
- L'interface ne montre pas de boutons "Valider / Invalider" réservés à un animateur
- En mode automatique : après le buzz, le serveur attend 10 secondes (configurable)
  puis passe à la question suivante automatiquement
- En mode vote : une barre de progression s'affiche montrant les votes en temps réel.
  Dès que tous ont voté OU après 15 secondes → résultat affiché → question suivante
- Les deux modes peuvent coexister dans la même partie (configurable par manche)

### Nouveaux messages WebSocket pour le mode sans animateur

```json
// Lancement par n'importe quel participant (mode sans animateur)
{ "type": "start_game_collective", "partieCode": "QUIZ42", "participantId": "..." }

// Vote sur la réponse (mode vote collectif)
{ "type": "submit_vote", "partieCode": "QUIZ42", "questionIndex": 3, "valide": true, "participantId": "..." }

// Résultat du vote (broadcast)
{ "type": "vote_result", "valide": true, "pour": 3, "contre": 1, "total": 4 }

// Question suivante automatique (mode auto)
{ "type": "auto_next_question", "countdown": 5 }
```

### UI : Interface jeu en mode sans animateur (AnimateurJeu.jsx adapté)

En mode sans animateur, l'interface de contrôle est **visible par tous** mais
les actions sont **restreintes selon le mode** :
- Mode auto → les boutons "Suivant / Valider" sont grisés, un compte à rebours s'affiche
- Mode vote → les boutons "Valider / Invalider" deviennent des boutons de vote (👍 / 👎)
  avec le compteur en temps réel visible par tous

---

## CHANGEMENT 8 — PROPRIÉTÉ DU BUZZER : PREMIER ARRIVÉ, PROPRIÉTAIRE PERMANENT

### Règle fondamentale
**Un buzzer appartient définitivement à la première personne qui l'a connecté
à la plateforme Gbairai**, indépendamment de :
- Tout changement de réseau WiFi
- Toute reconnexion depuis un autre lieu
- Toute utilisation temporaire par un autre joueur pendant une partie

La propriété ne change que si le propriétaire actuel effectue une **action explicite
de libération** depuis son compte sur la plateforme.

### Logique de premier appairage (buzzerService.js)

```javascript
// Appelé à chaque connexion d'un buzzer au serveur WebSocket
async function onBuzzerConnect(mac, firmware) {
  let buzzer = await prisma.buzzer.findUnique({ where: { mac } })

  if (!buzzer) {
    // Premier contact de ce buzzer avec la plateforme
    // Créer sans propriétaire — en attente de pairing
    buzzer = await prisma.buzzer.create({
      data: {
        mac,
        firmware,
        status: 'ONLINE',
        ownerId: null,       // pas encore de propriétaire
        claimedAt: null,
      }
    })
    // Envoyer au buzzer : "en attente de pairing"
    sendToBuzzer(mac, { type: 'awaiting_claim' })
  } else {
    // Buzzer déjà connu → mettre à jour statut seulement, NE PAS toucher ownerId
    await prisma.buzzer.update({
      where: { mac },
      data: { status: 'ONLINE', lastSeenAt: new Date(), firmware }
    })
    // Le propriétaire est notifié que son buzzer est en ligne
    if (buzzer.ownerId) {
      notifyUser(buzzer.ownerId, { type: 'buzzer_online', mac, nom: buzzer.nom })
    }
  }

  return buzzer
}
```

### Compléter le schéma Prisma

```prisma
model Buzzer {
  id           String       @id @default(cuid())
  mac          String       @unique
  nom          String?
  couleur      String       @default("#3B82F6")
  ownerId      String?                          // null = pas encore réclamé
  owner        User?        @relation(fields: [ownerId], references: [id])
  claimedAt    DateTime?                        // date du premier pairing
  status       BuzzerStatus @default(OFFLINE)
  lastSeenAt   DateTime?
  firmware     String?
  createdAt    DateTime     @default(now())

  participations Participant[]
}
```

### Flux de premier pairing (claim)

```
Buzzer se connecte pour la première fois
→ ownerId = null, LED violette clignotante (attente de claim)

Sur la plateforme, l'utilisateur clique "Ajouter un buzzer"
→ Entre la MAC imprimée sous le buzzer
→ Maintient le bouton physique 3 secondes (signal pairing_request)
→ Serveur vérifie : ownerId est-il null ?
   OUI → assigner ownerId = userId, claimedAt = now()
   NON → refuser avec message "Ce buzzer appartient déjà à quelqu'un"

Buzzer reçoit pairing_success → LED verte fixe
```

### Libération de propriété (transfert ou abandon)

Depuis la page "Mes Buzzers" dans le compte :

```
[Buzzer Rouge - A4:CF:12:B3]    🟢 Connecté
Dernière connexion : il y a 2 min
Utilisé dans : Aucune partie active

[Renommer]  [Changer couleur]  [⚠️ Libérer ce buzzer]
```

Clic sur "Libérer ce buzzer" :
- Confirmation modal : "Êtes-vous sûr ? Ce buzzer pourra être réclamé par quelqu'un d'autre."
- Si confirmé :
  ```javascript
  await prisma.buzzer.update({
    where: { mac },
    data: { ownerId: null, claimedAt: null, nom: null }
  })
  ```
- Le buzzer passe en mode "awaiting_claim" (LED violette) dès qu'il se reconnecte
- **Bloquer la libération si le buzzer est actuellement IN_GAME**

### Message d'erreur si quelqu'un essaie de claimer un buzzer déjà pris

```json
{
  "success": false,
  "error": "Ce buzzer est déjà enregistré sur un autre compte Gbairai. Seul son propriétaire peut le libérer depuis son profil.",
  "code": "BUZZER_ALREADY_CLAIMED"
}
```

### Notification au propriétaire (sécurité)

Si quelqu'un tente de claimer un buzzer qui appartient déjà à quelqu'un,
envoyer une notification au propriétaire actuel :
```
"⚠️ Quelqu'un a tenté de réclamer votre buzzer [Buzzer Rouge].
 Si ce n'est pas vous, votre buzzer est en sécurité."
```

---

## RÈGLES UX À RESPECTER

- **Zéro friction** : un utilisateur ne doit jamais se demander "suis-je joueur ou animateur ?" — le contexte le détermine automatiquement
- **Pas de re-pairing** : prêter un buzzer = juste une assignation en base, le buzzer reste appairé au propriétaire
- **Propriété inviolable** : changer de WiFi ne change pas le propriétaire, c'est la MAC qui fait foi
- **Mode sans animateur fluide** : la partie doit avancer sans blocage même si personne ne pilote
- **Indicateurs visuels clairs** : chaque buzzer doit toujours montrer son statut (connecté, hors ligne, qui l'utilise)
- **L'animation du buzzer est fonctionnelle** : elle doit refléter l'état réel en moins de 100ms via WebSocket
- **Responsive** : le dashboard et la salle d'attente doivent fonctionner sur mobile (les joueurs rejoignent depuis leur téléphone)
- **Libération explicite uniquement** : aucune action automatique ne doit jamais changer le propriétaire d'un buzzer
