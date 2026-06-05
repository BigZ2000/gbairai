// ── ROUTES PACKS (PUBLIQUES) ──────────────────────────────────────────────────
// Catalogue piloté par la base + lancement instantané avec contrôle d'accès
// (plan / abonnement / achat) et quotas freemium. Notation des packs incluse.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { generateCode } from '../utils/codeGen.js'
import { pickQuestionsForPack } from '../services/gameService.js'
import { canAccessPack, isLockedForPlan } from '../services/accessService.js'
import { canCreatePartie } from '../services/quotaService.js'
import { recomputePackRating } from '../services/ratingService.js'
import { TIER_REQUIRED_PLAN } from '../config/plans.js'

const router = Router()

export const MODES = {
  rapide:   { id: 'rapide',   label: 'Rapide',   emoji: '⚡', dureeMin: 10, manches: 1, parManche: 8,  tempsLimite: 25 },
  standard: { id: 'standard', label: 'Standard', emoji: '🎯', dureeMin: 20, manches: 2, parManche: 10, tempsLimite: 30 },
  long:     { id: 'long',     label: 'Long',     emoji: '🏆', dureeMin: 40, manches: 3, parManche: 12, tempsLimite: 30 },
}

// ── Cache catalogue (TTL) ────────────────────────────────
// Petite optimisation : le catalogue actif change rarement mais est lu souvent.
let _cache = { at: 0, packs: null }
const CACHE_TTL = 15_000
export function invalidatePackCache() { _cache = { at: 0, packs: null } }

async function getActivePacksCached() {
  if (_cache.packs && Date.now() - _cache.at < CACHE_TTL) return _cache.packs
  const packs = await prisma.pack.findMany({
    where: { statut: 'ACTIF' },
    orderBy: [{ priorite: 'desc' }, { createdAt: 'desc' }],
  })
  _cache = { at: Date.now(), packs }
  return packs
}

function publicPack(p, { lancements = 0, user } = {}) {
  const tier = p.tier ?? 'GRATUIT'
  const verrouille = isLockedForPlan(user?.plan, user?.isAdmin, tier)
  return {
    id: p.id, slug: p.slug, nom: p.nom, description: p.description,
    emoji: p.emoji, couleur: p.couleur, imageUrl: p.imageUrl, banniereUrl: p.banniereUrl,
    categorie: p.categorie, categories: p.categories, tags: p.tags,
    difficulte: p.difficulte, duree: p.duree, modeRecommande: p.modeRecommande,
    nbManches: p.nbManches, nbQuestions: p.nbQuestions,
    tempsParQuestion: p.tempsParQuestion, pointsParQuestion: p.pointsParQuestion,
    priorite: p.priorite, vedette: p.vedette, signature: p.signature,
    tier, prix: p.prix ?? 0,
    noteMoyenne: p.noteMoyenne, nbAvis: p.nbAvis ?? 0,
    verrouille, requiredPlan: verrouille ? (TIER_REQUIRED_PLAN[tier] ?? 'PRO') : null,
    createdAt: p.createdAt, lancements,
  }
}

// GET /api/packs — catalogue (packs actifs) pour le Dashboard.
// Optionnel : ?q= &tier= &difficulte= &duree= &sort=priorite|recent|populaire &page= &limit=
router.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { plan: true, isAdmin: true } })
  let packs = await getActivePacksCached()

  // Lancements par pack.
  const counts = await prisma.partie.groupBy({ by: ['packId'], _count: { _all: true } })
  const countMap = Object.fromEntries(counts.map(c => [c.packId, c._count._all]))

  // Filtres serveur optionnels (la recherche Dashboard reste possible côté client).
  const { q, tier, difficulte, duree, sort, page, limit } = req.query
  if (q) {
    const needle = q.toLowerCase()
    packs = packs.filter(p => [p.nom, p.description, p.categorie, ...(p.tags ?? [])]
      .join(' ').toLowerCase().includes(needle))
  }
  if (tier) packs = packs.filter(p => p.tier === tier)
  if (difficulte) packs = packs.filter(p => p.difficulte === difficulte)
  if (duree) packs = packs.filter(p => p.duree === duree)

  if (sort === 'recent') packs = [...packs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  else if (sort === 'populaire') packs = [...packs].sort((a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0))
  // défaut : déjà trié par priorité.

  const total = packs.length
  if (page || limit) {
    const lim = Math.min(parseInt(limit) || 24, 100)
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * lim
    packs = packs.slice(skip, skip + lim)
  }

  const all = packs.map(p => publicPack(p, { lancements: countMap[p.id] ?? 0, user }))
  res.json({
    packs: all.filter(p => !p.signature),
    signatures: all.filter(p => p.signature),
    modes: Object.values(MODES),
    total,
  })
})

const StartSchema = z.object({
  mode: z.enum(['rapide', 'standard', 'long']).optional(),
  gameMode: z.enum(['animateur', 'auto', 'vote']).optional(),
  nom: z.string().min(1).max(100).optional(),
  animateurJoue: z.boolean().optional(),
  modeDistanciel: z.boolean().optional(), // A4/D5 : jeu en ligne vs présentiel
})

function buildDynamicPlan(pack, modeId) {
  const override   = modeId ? MODES[modeId] : null
  const nbManches  = override?.manches    ?? pack.nbManches
  const parManche  = override?.parManche  ?? pack.nbQuestions
  const temps      = override?.tempsLimite ?? pack.tempsParQuestion
  const multFinale = pack.multiplicateurFinale ?? 1.0

  return Array.from({ length: nbManches }, (_, i) => {
    const isLast = (i === nbManches - 1) && nbManches > 1
    return {
      nom: nbManches === 1 ? pack.nom : `Manche ${i + 1}`,
      categories: pack.categories ?? [],
      difficulte: pack.difficulte ?? 'MIXTE',
      nbQuestions: parManche,
      pointsParQ: pack.pointsParQuestion,
      tempsLimite: temps,
      // D9.1 — barème croissant : la dernière manche applique le multiplicateur du pack.
      multiplicateurPoints: isLast ? multFinale : 1.0,
      // D3/D8 — malus par défaut du pack.
      malusEnabled:  pack.malusEnabled  ?? false,
      malusPenalite: pack.malusPenalite ?? 50,
      // D6 — élimination après chaque manche sauf la dernière.
      eliminationActive: (pack.eliminationActive ?? false) && !isLast,
    }
  })
}

async function createPartieFromPack({ userId, pack, gameMode, nom, mode, animateurJoue = false, modeDistanciel = false }) {
  let code
  for (let i = 0; i < 10; i++) {
    code = generateCode()
    const exists = await prisma.partie.findUnique({ where: { code } })
    if (!exists) break
  }
  const animateurId = gameMode === 'animateur' ? userId : null
  // Maître du jeu = animateur qui NE joue PAS (exclu du classement). Si l'animateur
  // « joue aussi », son participant n'est pas marqué maître → il est compté au score
  // (et peut buzzer via un buzzer qui lui est attribué).
  const estMaitre = gameMode === 'animateur' && !animateurJoue
  const partie = await prisma.partie.create({
    data: {
      nom, code, animateurId, creatorId: userId,
      modeAuto: gameMode === 'auto', modeVote: gameMode === 'vote',
      modeDistanciel,
      eliminationActive: pack.eliminationActive ?? false,
      packId: pack.id, packNom: `${pack.emoji ?? ''} ${pack.nom}`.trim(),
    },
  })
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { prenom: true } })
  await prisma.participant.create({
    data: { partieId: partie.id, userId, prenom: user?.prenom ?? 'Créateur', isAnimateur: estMaitre },
  })

  if (pack.contentMode === 'MANUEL') await buildManchesManuel(partie.id, pack)
  else await buildManchesDynamique(partie.id, pack, mode)
  return partie
}

async function buildManchesManuel(partieId, pack) {
  const pqs = await prisma.packQuestion.findMany({
    where: { packId: pack.id }, orderBy: [{ manche: 'asc' }, { ordre: 'asc' }],
  })
  const groupes = new Map()
  for (const pq of pqs) {
    if (!groupes.has(pq.manche)) groupes.set(pq.manche, [])
    groupes.get(pq.manche).push(pq.questionId)
  }
  if (groupes.size === 0) return buildManchesDynamique(partieId, pack, null)

  let ordre = 0
  for (const [numManche, questionIds] of [...groupes.entries()].sort((a, b) => a[0] - b[0])) {
    ordre++
    const manche = await prisma.manche.create({
      data: {
        partieId, nom: groupes.size === 1 ? pack.nom : `Manche ${numManche}`, ordre,
        theme: 'MELANGE', difficulte: pack.difficulte, nbQuestions: questionIds.length,
        pointsParQ: pack.pointsParQuestion, tempsLimite: pack.tempsParQuestion,
        malusEnabled: pack.malusEnabled ?? false,
        malusPenalite: pack.malusPenalite ?? 50,
        multiplicateurPoints: 1.0, // manuel : pas de multiplicateur auto
        eliminationActive: false,  // manuel : config explicite si nécessaire
      },
    })
    await prisma.mancheQuestion.createMany({
      data: questionIds.map((qId, i) => ({ mancheId: manche.id, questionId: qId, ordre: i + 1 })),
    })
  }
}

async function buildManchesDynamique(partieId, pack, mode) {
  const plan = buildDynamicPlan(pack, mode)
  const used = new Set()
  let ordre = 0
  for (const m of plan) {
    ordre++
    const manche = await prisma.manche.create({
      data: {
        partieId, nom: m.nom, ordre, theme: 'MELANGE', difficulte: m.difficulte,
        nbQuestions: m.nbQuestions, pointsParQ: m.pointsParQ, tempsLimite: m.tempsLimite,
        malusEnabled:         m.malusEnabled ?? false,
        malusPenalite:        m.malusPenalite ?? 50,
        multiplicateurPoints: m.multiplicateurPoints ?? 1.0,
        eliminationActive:    m.eliminationActive ?? false,
      },
    })
    const ids = await pickQuestionsForPack({
      categories: m.categories, difficulte: m.difficulte, count: m.nbQuestions,
      exclude: used, types: pack.typesAutorises ?? [],
    })
    ids.forEach(id => used.add(id))
    if (ids.length > 0) {
      await prisma.mancheQuestion.createMany({
        data: ids.map((qId, i) => ({ mancheId: manche.id, questionId: qId, ordre: i + 1 })),
      })
    }
  }
}

async function findPlayablePack(idOrSlug) {
  return prisma.pack.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } })
}

// Contrôle d'accès + quota commun aux lancements.
async function guardLaunch(req, res, pack) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, plan: true, isAdmin: true },
  })
  // 1. Droits d'accès au pack (plan / achat).
  const access = await canAccessPack(user, pack)
  if (!access.allowed) {
    res.status(403).json({ error: access.reason, code: access.code, requiredPlan: access.requiredPlan, requiredTier: access.requiredTier })
    return null
  }
  // 2. Quota freemium (parties / mois).
  const quota = await canCreatePartie(user)
  if (!quota.allowed) {
    res.status(402).json({ error: quota.reason, code: quota.code, limite: quota.limite, usage: quota.usage })
    return null
  }
  return user
}

// POST /api/packs/:packId/start
router.post('/:packId/start', requireAuth, async (req, res) => {
  const pack = await findPlayablePack(req.params.packId)
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  if (pack.statut !== 'ACTIF') return res.status(403).json({ error: 'Ce pack est indisponible' })

  const parsed = StartSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const user = await guardLaunch(req, res, pack)
  if (!user) return

  const { mode, gameMode, nom, animateurJoue, modeDistanciel } = parsed.data
  const partie = await createPartieFromPack({
    userId: req.userId, pack, animateurJoue,
    modeDistanciel: modeDistanciel ?? pack.modeDistanciel ?? false,
    gameMode: gameMode ?? pack.modeRecommande ?? 'animateur',
    nom: nom?.trim() || `${pack.emoji ?? ''} ${pack.nom}`.trim(),
    mode: mode ?? null,
  })
  res.status(201).json(partie)
})

// POST /api/packs/signatures/:id/start — compat ancien id.
router.post('/signatures/:id/start', requireAuth, async (req, res) => {
  const id = req.params.id
  let pack = await findPlayablePack(id)
  if (!pack) pack = await findPlayablePack(`sig-${id}`)
  if (!pack) return res.status(404).json({ error: 'Partie signature introuvable' })
  if (pack.statut !== 'ACTIF') return res.status(403).json({ error: 'Indisponible' })

  const user = await guardLaunch(req, res, pack)
  if (!user) return

  const parsed = z.object({ gameMode: z.enum(['animateur', 'auto', 'vote']).optional() }).safeParse(req.body)
  const gameMode = (parsed.success && parsed.data.gameMode) || pack.modeRecommande || 'animateur'
  const partie = await createPartieFromPack({
    userId: req.userId, pack, gameMode, nom: `${pack.emoji ?? ''} ${pack.nom}`.trim(), mode: null,
  })
  res.status(201).json(partie)
})

// ── NOTATION ──────────────────────────────────────────────

// GET /api/packs/:id/ratings — avis récents + résumé + note de l'utilisateur.
router.get('/:id/ratings', requireAuth, async (req, res) => {
  const pack = await prisma.pack.findUnique({
    where: { id: req.params.id }, select: { id: true, noteMoyenne: true, nbAvis: true },
  })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  const [avis, mien] = await Promise.all([
    prisma.packRating.findMany({
      where: { packId: pack.id, NOT: { commentaire: null } },
      orderBy: { updatedAt: 'desc' }, take: 20,
      include: { user: { select: { prenom: true, username: true } } },
    }),
    prisma.packRating.findUnique({ where: { packId_userId: { packId: pack.id, userId: req.userId } } }),
  ])
  res.json({ noteMoyenne: pack.noteMoyenne, nbAvis: pack.nbAvis, mien, avis })
})

// POST /api/packs/:id/ratings — noter / commenter (upsert).
router.post('/:id/ratings', requireAuth, async (req, res) => {
  const parsed = z.object({
    note: z.number().int().min(1).max(5),
    commentaire: z.string().max(1000).nullable().optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Note invalide (1 à 5)' })

  const pack = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })

  await prisma.packRating.upsert({
    where: { packId_userId: { packId: pack.id, userId: req.userId } },
    create: { packId: pack.id, userId: req.userId, note: parsed.data.note, commentaire: parsed.data.commentaire ?? null },
    update: { note: parsed.data.note, commentaire: parsed.data.commentaire ?? null },
  })
  const agg = await recomputePackRating(pack.id)
  invalidatePackCache()
  res.json({ ok: true, ...agg })
})

export default router
