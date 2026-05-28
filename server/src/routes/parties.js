import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth, isAnimateurDePartie } from '../middleware/auth.js'
import { generateCode } from '../utils/codeGen.js'
import { broadcast } from '../ws/wsServer.js'

const router = Router()

const partieFull = {
  include: {
    participants: { include: { user: { select: { prenom: true } }, buzzer: true } },
    animateur: { select: { prenom: true } },
  },
}

const CreatePartieSchema = z.object({
  nom: z.string().min(1).max(100),
  mode: z.enum(['animateur', 'auto', 'vote']).default('animateur'),
  questions: z.array(z.any()).optional(),
  timerBuzz: z.number().int().min(3).max(60).default(10),
  timerVote: z.number().int().min(5).max(60).default(15),
})

// ── Toutes les routes statiques AVANT /:partieId ────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const parsed = CreatePartieSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { nom, mode, questions, timerBuzz, timerVote } = parsed.data
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
      modeAuto: mode === 'auto',
      modeVote: mode === 'vote',
      questions: questions ?? [],
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
  res.json(parties)
})

// Lookup par code (avant /:partieId pour éviter le conflit)
router.get('/by-code/:code', requireAuth, async (req, res) => {
  const partie = await prisma.partie.findUnique({
    where: { code: req.params.code.toUpperCase() },
    ...partieFull,
  })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  res.json(partie)
})

// Vérifier qu'un code existe sans rejoindre (pour valider avant navigation)
router.get('/check/:code', requireAuth, async (req, res) => {
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

// Rejoindre par code
router.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Code requis' })

  const partie = await prisma.partie.findUnique({ where: { code: code.toUpperCase() } })
  if (!partie) return res.status(404).json({ error: 'Aucune partie avec ce code' })
  if (partie.status === 'TERMINEE' || partie.status === 'ANNULEE') {
    return res.status(410).json({ error: 'Cette partie est terminée' })
  }

  // Déjà participant → retourner sans créer de doublon
  const existing = await prisma.participant.findUnique({
    where: { partieId_userId: { partieId: partie.id, userId: req.userId } },
  })
  if (existing) return res.json({ participant: existing, partie })

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { prenom: true } })
  const buzzerOwned = await prisma.buzzer.findFirst({
    where: { ownerId: req.userId, status: { not: 'OFFLINE' } },
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
  res.json(partie)
})

// Mettre à jour les questions d'une partie (avant lancement)
router.patch('/:partieId/questions', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const { questions } = req.body
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions doit être un tableau' })

  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })
  if (partie.status !== 'EN_ATTENTE') return res.status(400).json({ error: 'La partie a déjà commencé' })

  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur de cette partie' })

  const updated = await prisma.partie.update({
    where: { id: partieId },
    data: { questions },
  })
  res.json(updated)
})

// Ajouter un invité sans compte
router.post('/:partieId/participants/invite', requireAuth, async (req, res) => {
  const { partieId } = req.params
  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur' })

  const { prenom } = req.body
  if (!prenom?.trim()) return res.status(400).json({ error: 'Prénom requis' })

  const participant = await prisma.participant.create({
    data: { partieId, prenom: prenom.trim(), userId: null },
  })

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(partie.code, { type: 'participant_joined', participant })
  res.status(201).json(participant)
})

// Assigner un buzzer à un participant
router.post('/:partieId/participants/:participantId/assign-buzzer', requireAuth, async (req, res) => {
  const { partieId, participantId } = req.params
  const { buzzerId } = req.body

  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur' })

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

// Retirer l'assignation d'un buzzer
router.delete('/:partieId/participants/:participantId/assign-buzzer', requireAuth, async (req, res) => {
  const { partieId, participantId } = req.params
  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur' })

  const participant = await prisma.participant.update({
    where: { id: participantId },
    data: { buzzerId: null },
  })

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

  if (!partie.modeAuto && !partie.modeVote) {
    if (partie.animateurId !== req.userId) {
      return res.status(403).json({ error: 'Seul le créateur peut lancer cette partie' })
    }
  } else {
    const participant = await prisma.participant.findFirst({ where: { partieId, userId: req.userId } })
    if (!participant) return res.status(403).json({ error: 'Vous ne participez pas à cette partie' })
  }

  const updated = await prisma.partie.update({
    where: { id: partieId },
    data: { status: 'EN_COURS' },
  })

  broadcast(partie.code, { type: 'game_started', partieCode: partie.code })
  res.json(updated)
})

// Voter sur une réponse (mode vote collectif)
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

  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { code: true } })
  broadcast(partie.code, { type: 'vote_update', questionIndex, pour, contre, total: votes.length })
  res.json({ pour, contre, total: votes.length })
})

export default router
