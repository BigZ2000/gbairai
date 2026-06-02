// ── ROUTES HISTORIQUE ─────────────────────────────────────────────────────────
// Consultation des parties jouées / créées par l'utilisateur, avec fiche détaillée
// (classement, déroulé, statistiques de buzz et temps de réponse).
import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { flattenManchesServer } from '../services/gameService.js'
import { getLiveProgress } from '../ws/gameHandler.js'

const router = Router()
router.use(requireAuth)

function typeLabel(partie) {
  if (partie.modeAuto) return 'auto'
  if (partie.modeVote) return 'vote'
  return 'animateur'
}

// GET /history — liste paginée des parties de l'utilisateur, avec filtres.
// Query: q (recherche), type (animateur|auto|vote), pack, status, from, to, result (win|loss)
router.get('/', async (req, res) => {
  const userId = req.userId
  const { q, type, pack, status, from, to, result } = req.query

  const where = { participants: { some: { userId } } }
  if (status) where.status = status
  if (pack) where.packId = pack
  if (type === 'auto') where.modeAuto = true
  else if (type === 'vote') where.modeVote = true
  else if (type === 'animateur') { where.modeAuto = false; where.modeVote = false }
  if (q) where.nom = { contains: q.toString(), mode: 'insensitive' }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from.toString())
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59`)
  }

  const parties = await prisma.partie.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { participants: true } },
      participants: {
        where: { userId },
        select: { score: true, rang: true },
      },
    },
  })

  let items = parties.map(p => {
    const mine = p.participants[0]
    const durationMin = p.startedAt && p.endedAt
      ? Math.max(1, Math.round((new Date(p.endedAt) - new Date(p.startedAt)) / 60000))
      : null
    return {
      id: p.id,
      code: p.code,
      nom: p.nom,
      type: typeLabel(p),
      pack: p.packNom ?? null,
      packId: p.packId ?? null,
      status: p.status,
      joueurs: p._count.participants,
      score: mine?.score ?? 0,
      rang: mine?.rang ?? null,
      durationMin,
      createdAt: p.createdAt,
      endedAt: p.endedAt,
    }
  })

  if (result === 'win') items = items.filter(i => i.rang === 1)
  else if (result === 'loss') items = items.filter(i => i.rang != null && i.rang !== 1)

  res.json(items)
})

// GET /history/:id — fiche détaillée d'une partie.
router.get('/:id', async (req, res) => {
  const userId = req.userId
  const partie = await prisma.partie.findUnique({
    where: { id: req.params.id },
    include: {
      participants: {
        orderBy: [{ rang: 'asc' }, { score: 'desc' }],
        include: { buzzer: { select: { couleur: true } } },
      },
      manches: {
        orderBy: { ordre: 'asc' },
        include: { mancheQuestions: { orderBy: { ordre: 'asc' }, include: { question: true } } },
      },
      events: true,
    },
  })
  if (!partie) return res.status(404).json({ error: 'Partie introuvable' })

  // L'utilisateur doit avoir participé à la partie.
  const isParticipant = partie.participants.some(p => p.userId === userId)
  if (!isParticipant) return res.status(403).json({ error: 'Accès refusé' })

  const finished = partie.status === 'TERMINEE'
  const flat = flattenManchesServer(partie.manches)

  // ── Partie NON terminée (EN_ATTENTE / EN_COURS / ANNULEE) ──────────────────
  // Confidentialité : tant que la partie n'est pas terminée, on ne divulgue NI
  // les questions, NI les réponses, NI le déroulé des manches, NI les médias à
  // venir, NI un quelconque classement final. On expose uniquement : infos
  // générales, participants, progression globale, score courant, statut, et
  // l'info « peut rejoindre » pour proposer le retour à la partie.
  if (!finished) {
    const live = getLiveProgress(partie.code)
    const current = Math.min(flat.length, Math.max(0, (live?.currentIndex ?? -1) + 1))
    const liveParticipants = partie.participants.map(p => ({
      id: p.id,
      prenom: p.prenom,
      score: p.score,
      couleur: p.buzzer?.couleur ?? '#6366F1',
    }))
    return res.json({
      id: partie.id,
      code: partie.code,
      nom: partie.nom,
      type: typeLabel(partie),
      pack: partie.packNom ?? null,
      status: partie.status,
      createdAt: partie.createdAt,
      startedAt: partie.startedAt,
      endedAt: null,
      durationMin: null,
      totalQuestions: flat.length,
      progress: { current, total: flat.length },
      participants: liveParticipants,
      manches: [],            // masqué tant que la partie n'est pas terminée
      restricted: true,
      canRejoin: partie.status === 'EN_COURS',
      isAnimateur: partie.animateurId === userId,
    })
  }

  // ── Partie TERMINEE : tout est consultable (historique complet) ────────────
  // Statistiques de buzz / temps de réponse par participant.
  const buzzEvents = partie.events.filter(e => e.type === 'buzz')
  const answerEvents = partie.events.filter(e => e.type === 'answer')
  const statsParPart = {}
  for (const p of partie.participants) statsParPart[p.id] = { buzz: 0, bonnes: 0, totalMs: 0, nbMs: 0 }
  for (const e of buzzEvents) {
    if (e.participantId && statsParPart[e.participantId]) {
      statsParPart[e.participantId].buzz++
      if (e.responseMs != null) { statsParPart[e.participantId].totalMs += e.responseMs; statsParPart[e.participantId].nbMs++ }
    }
  }
  for (const e of answerEvents) {
    if (e.valide && e.participantId && statsParPart[e.participantId]) statsParPart[e.participantId].bonnes++
  }

  const participants = partie.participants.map(p => {
    const s = statsParPart[p.id]
    return {
      id: p.id,
      prenom: p.prenom,
      score: p.score,
      rang: p.rang,
      couleur: p.buzzer?.couleur ?? '#6366F1',
      buzz: s.buzz,
      bonnes: s.bonnes,
      tempsMoyenMs: s.nbMs ? Math.round(s.totalMs / s.nbMs) : null,
    }
  })

  // Déroulé : manches + questions (réponses incluses uniquement si partie terminée).
  const manches = partie.manches.map(m => ({
    id: m.id,
    nom: m.nom,
    ordre: m.ordre,
    difficulte: m.difficulte,
    nbQuestions: m.nbQuestions,
    pointsParQ: m.pointsParQ,
    tempsLimite: m.tempsLimite,
    questions: m.mancheQuestions.map(mq => ({
      id: mq.question.id,
      enonce: mq.question.enonce,
      type: mq.question.type,
      reponse: finished ? mq.question.reponse : null,
      explication: finished ? (mq.question.explication ?? null) : null,
      difficulte: mq.question.difficulte,
    })),
  }))

  const durationMin = partie.startedAt && partie.endedAt
    ? Math.max(1, Math.round((new Date(partie.endedAt) - new Date(partie.startedAt)) / 60000))
    : null

  const totalBuzz = buzzEvents.length
  const allMs = buzzEvents.filter(e => e.responseMs != null).map(e => e.responseMs)
  const tempsMoyenMs = allMs.length ? Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length) : null

  res.json({
    id: partie.id,
    code: partie.code,
    nom: partie.nom,
    type: typeLabel(partie),
    pack: partie.packNom ?? null,
    status: partie.status,
    createdAt: partie.createdAt,
    startedAt: partie.startedAt,
    endedAt: partie.endedAt,
    durationMin,
    totalQuestions: flat.length,
    totalBuzz,
    tempsMoyenMs,
    participants,
    manches,
  })
})

export default router
