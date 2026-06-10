import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth, isAnimateurDePartie, isHostDePartie } from '../middleware/auth.js'
import { generateCode } from '../utils/codeGen.js'
import { broadcast } from '../ws/wsServer.js'
import { drawAndStoreQuestions, flattenManchesServer } from '../services/gameService.js'
import { joueursMax } from '../services/quotaService.js'
import { markBuzzersInGame, releaseBuzzerToOnline } from '../services/buzzerService.js'
import { setGameQuestions, startAutoQuestion, mediaStateMessage, questionDisplayMessage, pushLedToBuzzers } from '../ws/gameHandler.js'

const router = Router()

const partieFull = {
  include: {
    participants: { include: { user: { select: { prenom: true } }, buzzer: true } },
    animateur: { select: { prenom: true } },
    manches: {
      orderBy: { ordre: 'asc' },
      include: {
        mancheQuestions: {
          orderBy: { ordre: 'asc' },
          include: { question: true },
        },
      },
    },
  },
}

// ── Suspense : la réponse ne doit JAMAIS transiter par l'API tant que la partie
// n'est pas terminée. Seul l'évènement WS `question_reveal` révèle la réponse.
// On retire donc `reponse` / `explication` des questions de toute partie non
// terminée. Pour une partie TERMINEE (historique), on laisse passer.
function stripAnswer(question) {
  if (!question) return question
  const { reponse, explication, ...safe } = question
  return safe
}

function sanitizePartie(partie) {
  if (!partie) return partie
  const reveal = partie.status === 'TERMINEE'
  if (reveal) return partie
  return {
    ...partie,
    manches: (partie.manches ?? []).map(m => ({
      ...m,
      mancheQuestions: (m.mancheQuestions ?? []).map(mq => ({
        ...mq,
        question: stripAnswer(mq.question),
      })),
    })),
  }
}

const CreatePartieSchema = z.object({
  nom: z.string().min(1).max(100),
  mode: z.enum(['animateur', 'auto', 'vote']).default('animateur'),
  timerBuzz: z.number().int().min(3).max(60).default(10),
  timerVote: z.number().int().min(5).max(60).default(15),
  masquerReponses: z.boolean().default(false),
  modeDistanciel: z.boolean().default(false),
  eliminationActive: z.boolean().default(false),
})

// ── Routes statiques AVANT /:partieId ───────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const parsed = CreatePartieSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { nom, mode, timerBuzz, timerVote, masquerReponses, modeDistanciel, eliminationActive } = parsed.data
  let code
  let attempts = 0
  do {
    code = generateCode()
    const exists = await prisma.partie.findUnique({ where: { code } })
    if (!exists) break
    attempts++
  } while (attempts < 10)

  const animateurId = mode === 'animateur' ? req.userId : null
  const partie = await prisma.partie.create({
    data: {
      nom, code, animateurId,
      creatorId: req.userId,
      modeAuto: mode === 'auto',
      modeVote: mode === 'vote',
      // Le masquage des réponses n'a de sens qu'en mode animateur.
      masquerReponses: mode === 'animateur' ? masquerReponses : false,
      modeDistanciel: !!modeDistanciel,
      eliminationActive: !!eliminationActive,
      timerBuzz, timerVote,
    },
  })

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { prenom: true } })
  await prisma.participant.create({
    data: {
      partieId: partie.id,
      userId: req.userId,
      prenom: user?.prenom ?? 'Créateur',
      isAnimateur: mode === 'animateur',
    },
  })

  res.status(201).json(partie)
})

router.get('/', requireAuth, async (req, res) => {
  const parties = await prisma.partie.findMany({
    where: { participants: { some: { userId: req.userId } } },
    ...partieFull,
    orderBy: { createdAt: 'desc' },
  })
  res.json(parties.map(sanitizePartie))
})

router.get('/by-code/:code', requireAuth, async (req, res) => {
  const partie = await prisma.partie.findUnique({
    where: { code: req.params.code.toUpperCase() },
    ...partieFull,
  })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  res.json(sanitizePartie(partie))
})

// Réponses réservées à l'animateur de la partie (pour valider les buzz).
// Aucune autre personne (joueur, écran public) n'y a accès.
router.get('/:partieId/answers', requireAuth, async (req, res) => {
  const ok = await isAnimateurDePartie(req.userId, req.params.partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur' })

  // Mode « réponses masquées » : l'animateur projette son écran et découvre la
  // réponse en même temps que le public → l'API ne révèle rien avant l'heure.
  const meta = await prisma.partie.findUnique({
    where: { id: req.params.partieId },
    select: { masquerReponses: true },
  })
  if (meta?.masquerReponses) return res.json([])

  const partie = await prisma.partie.findUnique({
    where: { id: req.params.partieId },
    include: {
      manches: {
        orderBy: { ordre: 'asc' },
        include: {
          mancheQuestions: { orderBy: { ordre: 'asc' }, include: { question: true } },
        },
      },
    },
  })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })

  const flat = flattenManchesServer(partie.manches)
  const answers = flat.map((q, index) => ({ index, reponse: q.reponse, explication: q.explication ?? null }))
  res.json(answers)
})

// PUBLIC (pas de requireAuth) : c'est la cible du QR/lien de partie. Un invité
// arrive ici AVANT d'avoir un compte ; il doit pouvoir voir la partie (nom),
// puis créer un compte invité et rejoindre. Ne renvoie que des infos minimales.
router.get('/check/:code', async (req, res) => {
  const partie = await prisma.partie.findUnique({
    where: { code: req.params.code.toUpperCase() },
    select: { id: true, code: true, nom: true, status: true, animateurId: true, modeAuto: true, modeVote: true },
  })
  if (!partie) return res.status(404).json({ error: 'Aucune partie avec ce code' })
  if (partie.status === 'TERMINEE' || partie.status === 'ANNULEE') {
    return res.status(410).json({ error: 'Cette partie est terminée' })
  }
  res.json(partie)
})

router.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Code requis' })

  const partie = await prisma.partie.findUnique({ where: { code: code.toUpperCase() } })
  if (!partie) return res.status(404).json({ error: 'Aucune partie avec ce code' })
  if (partie.status === 'TERMINEE' || partie.status === 'ANNULEE') {
    return res.status(410).json({ error: 'Cette partie est terminée' })
  }

  const existing = await prisma.participant.findUnique({
    where: { partieId_userId: { partieId: partie.id, userId: req.userId } },
  })
  if (existing) return res.json({ participant: existing, partie })

  // Capacité : limite de joueurs selon le plan de l'hôte (null = illimité).
  const hostId = partie.animateurId ?? partie.creatorId
  if (hostId) {
    const host = await prisma.user.findUnique({ where: { id: hostId }, select: { plan: true, isAdmin: true } })
    const max = joueursMax(host)
    if (max != null) {
      const count = await prisma.participant.count({ where: { partieId: partie.id } })
      if (count >= max) {
        return res.status(403).json({ error: `Cette partie est complète (${max} joueurs maximum).`, code: 'PARTIE_PLEINE' })
      }
    }
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { prenom: true } })
  // Auto-association : on prend le buzzer en ligne le PLUS RÉCEMMENT actif
  // (cas « plusieurs buzzers » → dernier actif, sans sélecteur).
  const buzzerOwned = await prisma.buzzer.findFirst({
    where: { ownerId: req.userId, status: { not: 'OFFLINE' } },
    orderBy: { lastSeenAt: 'desc' },
  })

  const participant = await prisma.participant.create({
    data: {
      partieId: partie.id,
      userId: req.userId,
      prenom: user?.prenom ?? 'Joueur',
      buzzerId: buzzerOwned?.id ?? null,
    },
  })

  broadcast(partie.code, {
    type: 'participant_joined',
    participant: { ...participant, prenom: user?.prenom },
  })

  res.status(201).json({ participant, partie })
})

// ── Routes dynamiques /:partieId ────────────────────────────────────────────

router.get('/:partieId', requireAuth, async (req, res) => {
  const partie = await prisma.partie.findUnique({
    where: { id: req.params.partieId },
    ...partieFull,
  })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  res.json(sanitizePartie(partie))
})

// Édition d'une partie tant qu'elle est en attente (nom, mode, minuteurs).
const EditPartieSchema = z.object({
  nom: z.string().min(1).max(100).optional(),
  mode: z.enum(['animateur', 'auto', 'vote']).optional(),
  timerBuzz: z.number().int().min(3).max(60).optional(),
  timerVote: z.number().int().min(5).max(60).optional(),
  masquerReponses: z.boolean().optional(),
  modeDistanciel: z.boolean().optional(),
})

router.patch('/:partieId', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const parsed = EditPartieSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })

  // Seul l'hôte (animateur ou créateur) peut modifier la partie.
  if (!(await isHostDePartie(req.userId, partieId))) {
    return res.status(403).json({ error: 'Seul le créateur peut modifier cette partie' })
  }

  if (partie.status !== 'EN_ATTENTE') {
    return res.status(400).json({ error: 'Seule une partie non démarrée peut être modifiée' })
  }

  const { nom, mode, timerBuzz, timerVote, masquerReponses, modeDistanciel } = parsed.data
  const data = {}
  if (nom !== undefined) data.nom = nom
  if (timerBuzz !== undefined) data.timerBuzz = timerBuzz
  if (timerVote !== undefined) data.timerVote = timerVote
  if (masquerReponses !== undefined) data.masquerReponses = masquerReponses
  if (modeDistanciel !== undefined) data.modeDistanciel = modeDistanciel

  const effectiveMode = mode ?? (partie.modeAuto ? 'auto' : partie.modeVote ? 'vote' : 'animateur')
  if (mode !== undefined) {
    data.modeAuto = mode === 'auto'
    data.modeVote = mode === 'vote'
    // En mode animateur, le créateur (1er participant) devient l'animateur ;
    // dans les autres modes, il n'y a pas d'animateur attitré.
    const creator = await prisma.participant.findFirst({
      where: { partieId }, orderBy: { joinedAt: 'asc' },
    })
    if (mode === 'animateur') {
      data.animateurId = creator?.userId ?? partie.creatorId ?? partie.animateurId
    } else {
      data.animateurId = null
    }
    if (creator) {
      await prisma.participant.update({
        where: { id: creator.id }, data: { isAnimateur: mode === 'animateur' },
      })
    }
  }
  // Le masquage des réponses n'a de sens qu'en mode animateur.
  if (effectiveMode !== 'animateur') data.masquerReponses = false

  await prisma.partie.update({ where: { id: partieId }, data })

  const full = await prisma.partie.findUnique({ where: { id: partieId }, ...partieFull })
  broadcast(partie.code, { type: 'partie_updated', partieCode: partie.code })
  res.json(sanitizePartie(full))
})

router.post('/:partieId/participants/invite', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const { prenom } = req.body
  if (!prenom?.trim()) return res.status(400).json({ error: 'Prénom requis' })

  const participant = await prisma.participant.create({
    data: { partieId, prenom: prenom.trim(), userId: null },
  })

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(partie.code, { type: 'participant_joined', participant })
  res.status(201).json(participant)
})

// Recherche d'utilisateurs à inviter (par pseudo ou prénom) — autocomplete.
router.get('/:partieId/participants/search', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const q = (req.query.q ?? '').toString().trim()
  if (q.length < 1) return res.json([])

  // Exclure les utilisateurs déjà participants.
  const existing = await prisma.participant.findMany({
    where: { partieId, userId: { not: null } },
    select: { userId: true },
  })
  const excludeIds = existing.map(e => e.userId)

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeIds },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { prenom: { contains: q, mode: 'insensitive' } },
        { nom: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, prenom: true, nom: true, username: true, avatarUrl: true },
    take: 8,
    orderBy: { prenom: 'asc' },
  })
  res.json(users)
})

// Ajout d'un participant inscrit (par userId), depuis la recherche.
router.post('/:partieId/participants/add-user', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId requis' })

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true, status: true } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  if (partie.status !== 'EN_ATTENTE') return res.status(400).json({ error: 'La partie a déjà commencé' })

  const existing = await prisma.participant.findUnique({
    where: { partieId_userId: { partieId, userId } },
  })
  if (existing) return res.status(409).json({ error: 'Ce joueur est déjà dans la partie' })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { prenom: true } })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

  const participant = await prisma.participant.create({
    data: { partieId, userId, prenom: user.prenom || 'Joueur' },
  })

  broadcast(partie.code, { type: 'participant_joined', participant })
  res.status(201).json(participant)
})

// Retirer un participant avant le démarrage.
router.delete('/:partieId/participants/:participantId', requireAuth, async (req, res) => {
  const { partieId, participantId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true, status: true, animateurId: true } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  if (partie.status !== 'EN_ATTENTE') return res.status(400).json({ error: 'La partie a déjà commencé' })

  const participant = await prisma.participant.findUnique({ where: { id: participantId } })
  if (!participant || participant.partieId !== partieId) return res.status(404).json({ error: 'Participant introuvable' })
  // On ne retire pas l'animateur lui-même.
  if (participant.userId && participant.userId === partie.animateurId) {
    return res.status(400).json({ error: 'Impossible de retirer l\'animateur' })
  }

  await prisma.participant.delete({ where: { id: participantId } })
  // Détache proprement son buzzer éventuel (statut + LED idle).
  if (participant.buzzerId) await releaseBuzzerToOnline(participant.buzzerId)
  broadcast(partie.code, { type: 'participant_removed', participantId })
  res.json({ ok: true })
})

// Annuler une partie (uniquement avant le démarrage).
router.post('/:partieId/cancel', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })

  // Seul l'hôte (animateur ou créateur) peut annuler.
  if (!(await isHostDePartie(req.userId, partieId))) {
    return res.status(403).json({ error: 'Seul le créateur peut annuler cette partie' })
  }

  if (partie.status !== 'EN_ATTENTE') {
    return res.status(400).json({ error: 'Seule une partie non démarrée peut être annulée' })
  }

  const updated = await prisma.partie.update({
    where: { id: partieId },
    data: { status: 'ANNULEE' },
  })
  broadcast(partie.code, { type: 'partie_cancelled', partieCode: partie.code })
  res.json(updated)
})

router.post('/:partieId/participants/:participantId/assign-buzzer', requireAuth, async (req, res) => {
  const { partieId, participantId } = req.params
  const { buzzerId } = req.body

  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const buzzer = await prisma.buzzer.findUnique({ where: { id: buzzerId } })
  if (!buzzer) return res.status(404).json({ error: 'Buzzer introuvable' })
  if (buzzer.ownerId !== req.userId) {
    return res.status(403).json({ error: 'Ce buzzer ne vous appartient pas' })
  }

  const conflict = await prisma.participant.findFirst({
    where: { buzzerId, partieId: { not: partieId }, partie: { status: 'EN_COURS' } },
  })
  if (conflict) {
    return res.status(409).json({ error: 'Ce buzzer est déjà utilisé dans une partie en cours' })
  }

  const participant = await prisma.participant.update({
    where: { id: participantId },
    data: { buzzerId },
    include: { buzzer: true },
  })

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(partie.code, { type: 'buzzer_assigned', buzzerId, participantId, prenom: participant.prenom })
  res.json(participant)
})

router.delete('/:partieId/participants/:participantId/assign-buzzer', requireAuth, async (req, res) => {
  const { partieId, participantId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const before = await prisma.participant.findUnique({ where: { id: participantId }, select: { buzzerId: true } })
  const participant = await prisma.participant.update({
    where: { id: participantId },
    data: { buzzerId: null },
  })
  // Le buzzer détaché repasse ONLINE et sa LED s'éteint (idle).
  if (before?.buzzerId) await releaseBuzzerToOnline(before.buzzerId)

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(partie.code, { type: 'unassign_buzzer', participantId })
  res.json(participant)
})

// Lancer la partie
router.post('/:partieId/start', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  if (partie.status !== 'EN_ATTENTE') {
    return res.status(400).json({ error: 'La partie a déjà commencé ou est terminée' })
  }

  // Quel que soit le mode, seul l'hôte (animateur ou créateur) peut lancer.
  if (!(await isHostDePartie(req.userId, partieId))) {
    return res.status(403).json({ error: 'Seul l\'hôte peut lancer cette partie' })
  }

  // P0 — Le mode VOTE collectif exige au moins 3 joueurs. Sinon, après un buzz,
  // le nombre de votants attendus peut tomber à 0 → la réponse se résout
  // instantanément sans que personne ne marque (le buzzeur ne vote pas sa propre
  // réponse). On bloque proprement au lancement, avec un message clair.
  if (partie.modeVote) {
    const joueurs = await prisma.participant.count({
      where: { partieId, isAnimateur: false },
    })
    if (joueurs < 3) {
      return res.status(400).json({
        error: 'Le mode vote collectif nécessite au moins 3 joueurs pour fonctionner.',
        code: 'VOTE_MIN_JOUEURS',
      })
    }
  }

  // Draw random questions for each manche
  await drawAndStoreQuestions(partieId)

  // P2 — Garde-fou « vivier vide » : si aucune question n'a pu être tirée (thème/
  // difficulté trop restrictifs, bibliothèque vide), on refuse au lieu de lancer
  // une partie qui se terminerait instantanément. La partie reste EN_ATTENTE.
  const qCount = await prisma.mancheQuestion.count({ where: { manche: { partieId } } })
  if (qCount === 0) {
    return res.status(400).json({
      error: 'Aucune question disponible pour ces critères. Change le thème ou la difficulté de tes manches.',
      code: 'AUCUNE_QUESTION',
    })
  }

  const updated = await prisma.partie.update({
    where: { id: partieId },
    data: { status: 'EN_COURS', startedAt: new Date() },
  })

  // Les buzzers matériels assignés passent EN JEU (statut IN_GAME).
  await markBuzzersInGame(partieId)

  broadcast(partie.code, { type: 'game_started', partieCode: partie.code })

  // Cache questions in game state + broadcast first question_display
  const fullPartie = await prisma.partie.findUnique({
    where: { id: partieId },
    include: {
      manches: {
        orderBy: { ordre: 'asc' },
        include: {
          mancheQuestions: {
            orderBy: { ordre: 'asc' },
            include: { question: true },
          },
        },
      },
    },
  })
  const questions = flattenManchesServer(fullPartie.manches)
  setGameQuestions(partie.code, questions)

  if (questions.length > 0) {
    // Message d'affichage centralisé (inclut le chronomètre) — identique à
    // celui produit lors des avancements → écran public synchronisé.
    broadcast(partie.code, questionDisplayMessage(partie.code))
    // Démarrage synchronisé du média de la 1re question (horloge serveur).
    broadcast(partie.code, mediaStateMessage(partie.code))
    // LED des buzzers matériels assignés : prêts à buzzer dès la 1re question.
    pushLedToBuzzers(partie.code, 'armed').catch(() => {})

    // En mode auto, le serveur pilote le rythme : révélation puis avancement
    // automatique à l'expiration du minuteur de chaque question.
    if (fullPartie.modeAuto) {
      startAutoQuestion(partie.code)
    }
  }

  res.json(updated)
})

router.post('/:partieId/votes', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const { questionIndex, valide } = req.body

  const participant = await prisma.participant.findFirst({ where: { partieId, userId: req.userId } })
  if (!participant) return res.status(403).json({ error: 'Vous ne participez pas à cette partie' })

  await prisma.vote.upsert({
    where: { partieId_questionIndex_participantId: { partieId, questionIndex, participantId: participant.id } },
    create: { partieId, questionIndex, participantId: participant.id, valide },
    update: { valide },
  })

  const votes = await prisma.vote.findMany({ where: { partieId, questionIndex } })
  const pour = votes.filter(v => v.valide).length
  const contre = votes.filter(v => !v.valide).length

  const p = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(p.code, { type: 'vote_update', questionIndex, pour, contre, total: votes.length })
  res.json({ pour, contre, total: votes.length })
})

// ── Manches ──────────────────────────────────────────────────────────────────

const MancheSchema = z.object({
  nom: z.string().min(1).max(100),
  pointsParQ: z.number().int().min(1).max(10000).default(100),
  tempsLimite: z.number().int().min(5).max(300).default(30),
  theme: z.string().max(100).default('MELANGE'),
  difficulte: z.string().max(20).default('MIXTE'),
  nbQuestions: z.number().int().min(1).max(100).default(10),
  // Mécaniques avancées (manches inspirées des jeux TV).
  malusEnabled: z.boolean().default(false),
  malusPenalite: z.number().int().min(0).max(100).default(50),
  multiplicateurPoints: z.number().min(0.5).max(5).default(1.0),
  eliminationActive: z.boolean().default(false),
})

router.post('/:partieId/manches', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  if (partie.status !== 'EN_ATTENTE') return res.status(400).json({ error: 'La partie a déjà commencé' })

  const parsed = MancheSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const count = await prisma.manche.count({ where: { partieId } })
  const manche = await prisma.manche.create({
    data: { ...parsed.data, partieId, ordre: count + 1 },
    include: { mancheQuestions: { include: { question: true } } },
  })

  res.status(201).json(manche)
})

router.delete('/:partieId/manches/:mancheId', requireAuth, async (req, res) => {
  const { partieId, mancheId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  await prisma.manche.delete({ where: { id: mancheId } })
  res.json({ ok: true })
})

router.post('/:partieId/manches/:mancheId/questions', requireAuth, async (req, res) => {
  const { partieId, mancheId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  const { questionId } = req.body
  if (!questionId) return res.status(400).json({ error: 'questionId requis' })

  const question = await prisma.question.findUnique({ where: { id: questionId } })
  if (!question) return res.status(404).json({ error: 'Question introuvable' })

  const count = await prisma.mancheQuestion.count({ where: { mancheId } })
  const mq = await prisma.mancheQuestion.create({
    data: { mancheId, questionId, ordre: count + 1 },
    include: { question: true },
  })

  res.status(201).json(mq)
})

router.delete('/:partieId/manches/:mancheId/questions/:mqId', requireAuth, async (req, res) => {
  const { partieId, mancheId, mqId } = req.params
  const ok = await isHostDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'hôte de la partie' })

  await prisma.mancheQuestion.delete({ where: { id: mqId } })
  res.json({ ok: true })
})

export default router
