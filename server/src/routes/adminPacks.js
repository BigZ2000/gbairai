// ── ROUTES ADMIN PACKS ────────────────────────────────────────────────────────
// CRUD complet + duplication + archivage + statistiques des packs.
// Réservé aux administrateurs. Monté sur /api/admin/packs.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { invalidatePackCache } from './packs.js'

const router = Router()
router.use(requireAuth, requireAdmin)

// ── Helpers ───────────────────────────────────────────────

// Transforme un nom en slug URL-safe et unique.
function slugify(str) {
  return (str || 'pack')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'pack'
}

async function uniqueSlug(base, excludeId = null) {
  let slug = slugify(base)
  let i = 1
  while (true) {
    const found = await prisma.pack.findUnique({ where: { slug } })
    if (!found || found.id === excludeId) return slug
    i++
    slug = `${slugify(base)}-${i}`
  }
}

// Calcule les statistiques d'un pack à partir des parties lancées.
async function computeStats(packId) {
  const parties = await prisma.partie.findMany({
    where: { packId },
    select: {
      id: true, status: true, startedAt: true, endedAt: true,
      _count: { select: { participants: true } },
    },
  })
  const lancements = parties.length
  const joueurs = parties.reduce((s, p) => s + (p._count?.participants ?? 0), 0)
  const terminees = parties.filter(p => p.status === 'TERMINEE')
  const tauxCompletion = lancements ? Math.round((terminees.length / lancements) * 100) : 0

  // Temps moyen (secondes) sur les parties terminées disposant des 2 horodatages.
  const durees = terminees
    .filter(p => p.startedAt && p.endedAt)
    .map(p => (new Date(p.endedAt) - new Date(p.startedAt)) / 1000)
  const tempsMoyen = durees.length
    ? Math.round(durees.reduce((s, d) => s + d, 0) / durees.length)
    : 0

  return {
    lancements,
    joueurs,
    tempsMoyen,           // secondes
    tauxCompletion,       // %
    noteMoyenne: null,    // pas encore de système de notation
    // Score de popularité simple : lancements pondérés par le taux de complétion.
    popularite: Math.round(lancements * (1 + tauxCompletion / 100)),
  }
}

// ── Schémas ───────────────────────────────────────────────

const DIFFICULTES = ['FACILE', 'MOYEN', 'DIFFICILE', 'MIXTE']
const TYPES = ['BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO']

const PackSchema = z.object({
  nom: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  emoji: z.string().max(8).nullable().optional(),
  couleur: z.string().max(20).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  banniereUrl: z.string().max(500).nullable().optional(),
  categorie: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().max(40)).max(40).optional(),
  difficulte: z.enum(DIFFICULTES).optional(),
  duree: z.enum(['RAPIDE', 'STANDARD', 'LONGUE']).optional(),
  categories: z.array(z.string().max(80)).max(40).optional(),
  typesAutorises: z.array(z.enum(TYPES)).max(6).optional(),
  modeRecommande: z.enum(['animateur', 'auto', 'vote']).optional(),
  contentMode: z.enum(['DYNAMIQUE', 'MANUEL']).optional(),
  // Monétisation
  tier: z.enum(['GRATUIT', 'PREMIUM', 'ENTREPRISE', 'EVENEMENT', 'ECOLE']).optional(),
  prix: z.number().int().min(0).max(1000000).optional(),
  nbManches: z.number().int().min(1).max(10).optional(),
  nbQuestions: z.number().int().min(1).max(50).optional(),
  tempsParQuestion: z.number().int().min(5).max(300).optional(),
  pointsParQuestion: z.number().int().min(10).max(1000).optional(),
  priorite: z.number().int().min(0).max(1000).optional(),
  vedette: z.boolean().optional(),
  signature: z.boolean().optional(),
  statut: z.enum(['ACTIF', 'INACTIF', 'ARCHIVE']).optional(),
})

// ── Liste ─────────────────────────────────────────────────

// GET /api/admin/packs — tous les packs (tous statuts) + stats résumées.
router.get('/', async (req, res) => {
  const { statut, q } = req.query
  const where = {}
  if (statut && ['ACTIF', 'INACTIF', 'ARCHIVE'].includes(statut)) where.statut = statut
  if (q) {
    where.OR = [
      { nom: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { categorie: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
    ]
  }

  const packs = await prisma.pack.findMany({
    where,
    orderBy: [{ priorite: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { questions: true } } },
  })

  // Lancements par pack (un seul groupBy pour toute la liste).
  const counts = await prisma.partie.groupBy({ by: ['packId'], _count: { _all: true } })
  const countMap = Object.fromEntries(counts.map(c => [c.packId, c._count._all]))

  res.json(packs.map(p => ({
    ...p,
    nbQuestionsManuelles: p._count.questions,
    lancements: countMap[p.id] ?? 0,
  })))
})

// GET /api/admin/packs/:id — fiche détaillée + questions manuelles + stats.
router.get('/:id', async (req, res) => {
  const pack = await prisma.pack.findUnique({
    where: { id: req.params.id },
    include: {
      questions: {
        orderBy: [{ manche: 'asc' }, { ordre: 'asc' }],
        include: {
          question: {
            select: { id: true, enonce: true, type: true, difficulte: true, categorie: { select: { nom: true } } },
          },
        },
      },
    },
  })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  const stats = await computeStats(pack.id)
  res.json({ ...pack, stats })
})

// GET /api/admin/packs/:id/stats — statistiques seules.
router.get('/:id/stats', async (req, res) => {
  const pack = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  res.json(await computeStats(pack.id))
})

// ── Création ──────────────────────────────────────────────

// POST /api/admin/packs — créer un pack.
router.post('/', async (req, res) => {
  const parsed = PackSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = { ...parsed.data }
  data.slug = await uniqueSlug(data.nom)
  const pack = await prisma.pack.create({ data })
  invalidatePackCache()
  res.status(201).json(pack)
})

// PATCH /api/admin/packs/:id — modifier un pack.
router.patch('/:id', async (req, res) => {
  const parsed = PackSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const existing = await prisma.pack.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Pack introuvable' })

  const data = { ...parsed.data }
  // Le slug n'est pas modifié automatiquement (référence stable).
  const pack = await prisma.pack.update({ where: { id: req.params.id }, data })
  invalidatePackCache()
  res.json(pack)
})

// DELETE /api/admin/packs/:id — supprimer définitivement.
// Recommandé : préférer l'archivage (PATCH statut=ARCHIVE) pour garder l'historique.
router.delete('/:id', async (req, res) => {
  const existing = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: 'Pack introuvable' })
  // Les parties déjà jouées conservent packId/packNom (champs scalaires) → pas de FK cassée.
  await prisma.pack.delete({ where: { id: req.params.id } })
  invalidatePackCache()
  res.json({ ok: true })
})

// POST /api/admin/packs/:id/duplicate — dupliquer un pack (+ questions manuelles).
router.post('/:id/duplicate', async (req, res) => {
  const src = await prisma.pack.findUnique({
    where: { id: req.params.id },
    include: { questions: true },
  })
  if (!src) return res.status(404).json({ error: 'Pack introuvable' })

  const nom = (req.body?.nom?.trim()) || `${src.nom} (copie)`
  const { id, slug, createdAt, updatedAt, questions, ...rest } = src
  const copy = await prisma.pack.create({
    data: {
      ...rest,
      nom,
      slug: await uniqueSlug(nom),
      noteMoyenne: null,       // une copie repart sans avis
      nbAvis: 0,
      vedette: false,          // une copie ne récupère pas la mise en avant
      statut: 'INACTIF',       // créée désactivée pour révision avant publication
      questions: {
        create: questions.map(qq => ({ questionId: qq.questionId, manche: qq.manche, ordre: qq.ordre })),
      },
    },
  })
  invalidatePackCache()
  res.status(201).json(copy)
})

// PUT /api/admin/packs/:id/questions — définir la sélection manuelle de questions.
// Remplace l'intégralité de la liste. body: { questions: [{ questionId, manche, ordre }] }
router.put('/:id/questions', async (req, res) => {
  const schema = z.object({
    questions: z.array(z.object({
      questionId: z.string(),
      manche: z.number().int().min(1).max(10).optional().default(1),
      ordre: z.number().int().min(0).optional().default(0),
    })).max(500),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const pack = await prisma.pack.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })

  // Déduplique par questionId (contrainte @@unique([packId, questionId])).
  const seen = new Set()
  const rows = []
  parsed.data.questions.forEach((it, i) => {
    if (seen.has(it.questionId)) return
    seen.add(it.questionId)
    rows.push({ packId: pack.id, questionId: it.questionId, manche: it.manche ?? 1, ordre: it.ordre ?? i })
  })

  await prisma.$transaction([
    prisma.packQuestion.deleteMany({ where: { packId: pack.id } }),
    ...(rows.length ? [prisma.packQuestion.createMany({ data: rows })] : []),
  ])

  res.json({ ok: true, count: rows.length })
})

export default router
