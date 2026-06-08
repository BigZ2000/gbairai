import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { cleanupGuests } from '../../scripts/cleanupGuests.js'
import { getSettings, updateSettings } from '../config/settings.js'

const router = Router()

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin)

const ADMIN_USER_SELECT = {
  id: true, email: true, prenom: true, nom: true, username: true, telephone: true,
  plan: true, isAdmin: true, isActive: true, createdAt: true, lastSeenAt: true,
}

// Buckets [{ label:'JJ/MM', value }] par jour sur les N derniers jours.
function bucketParJour(dates, jours = 14) {
  const out = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = jours - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ label, value: 0, s: d.getTime(), e: next.getTime() })
  }
  for (const dt of dates) {
    const t = new Date(dt).getTime()
    const b = out.find(o => t >= o.s && t < o.e)
    if (b) b.value++
  }
  return out.map(({ label, value }) => ({ label, value }))
}

// Buckets par mois sur les N derniers mois → [{ label:'MM/AA', value }] (somme).
function bucketParMois(items, mois = 6, valueOf = () => 1) {
  const out = []
  const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0)
  for (let i = mois - 1; i >= 0; i--) {
    const d = new Date(base); d.setMonth(d.getMonth() - i)
    const next = new Date(d); next.setMonth(next.getMonth() + 1)
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
    out.push({ label, value: 0, s: d.getTime(), e: next.getTime() })
  }
  for (const it of items) {
    const t = new Date(it.date).getTime()
    const b = out.find(o => t >= o.s && t < o.e)
    if (b) b.value += valueOf(it)
  }
  return out.map(({ label, value }) => ({ label, value }))
}

// GET /admin/stats — dashboard d'activité.
router.get('/stats', async (_req, res) => {
  const since = new Date(); since.setDate(since.getDate() - 14)
  const [users, questions, parties, categories,
         usersRecents, partiesRecentes, parCategorie, parType, parDifficulte] = await Promise.all([
    prisma.user.count(),
    prisma.question.count(),
    prisma.partie.count(),
    prisma.categorie.count(),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.partie.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.question.groupBy({ by: ['categorieId'], _count: { _all: true } }),
    prisma.question.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.question.groupBy({ by: ['difficulte'], _count: { _all: true } }),
  ])

  const cats = await prisma.categorie.findMany({ select: { id: true, nom: true } })
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.nom]))

  res.json({
    users, questions, parties, categories,
    inscriptionsParJour: bucketParJour(usersRecents.map(u => u.createdAt)),
    partiesParJour: bucketParJour(partiesRecentes.map(p => p.createdAt)),
    questionsParCategorie: parCategorie
      .map(g => ({ label: catMap[g.categorieId] ?? '—', value: g._count._all }))
      .sort((a, b) => b.value - a.value),
    questionsParType: parType.map(g => ({ label: g.type, value: g._count._all })).sort((a, b) => b.value - a.value),
    questionsParDifficulte: parDifficulte.map(g => ({ label: g.difficulte, value: g._count._all })),
  })
})

// GET /admin/analytics — analytiques business (abonnés, revenus, conversion…).
router.get('/analytics', async (_req, res) => {
  const [parPlan, totalUsers, paiements, ventesPack, abonnementsActifs, usersDates] = await Promise.all([
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.paiement.findMany({ where: { statut: 'SUCCESS' }, select: { montant: true, plan: true, packId: true, createdAt: true } }),
    prisma.paiement.groupBy({
      by: ['packId'], where: { statut: 'SUCCESS', packId: { not: null } },
      _count: { _all: true }, _sum: { montant: true },
    }),
    prisma.subscription.count({ where: { statut: 'ACTIVE' } }),
    prisma.user.findMany({ select: { createdAt: true } }),
  ])

  const abonnes = Object.fromEntries(parPlan.map(p => [p.plan, p._count._all]))
  const free = abonnes.FREE ?? 0
  const payants = totalUsers - free
  const revenus = paiements.reduce((s, p) => s + (p.montant ?? 0), 0)
  const revenusAbonnements = paiements.filter(p => p.plan).reduce((s, p) => s + p.montant, 0)
  const revenusPacks = paiements.filter(p => p.packId).reduce((s, p) => s + p.montant, 0)

  // Enrichit le top des packs vendus avec leur nom.
  const packIds = ventesPack.map(v => v.packId)
  const packs = packIds.length
    ? await prisma.pack.findMany({ where: { id: { in: packIds } }, select: { id: true, nom: true, emoji: true } })
    : []
  const packMap = Object.fromEntries(packs.map(p => [p.id, p]))
  const topPacks = ventesPack
    .map(v => ({ packId: v.packId, nom: packMap[v.packId]?.nom ?? '—', emoji: packMap[v.packId]?.emoji, ventes: v._count._all, revenus: v._sum.montant ?? 0 }))
    .sort((a, b) => b.ventes - a.ventes).slice(0, 10)

  res.json({
    abonnes, totalUsers, payants,
    tauxConversion: totalUsers ? Math.round((payants / totalUsers) * 100) : 0,
    abonnementsActifs,
    revenus, revenusAbonnements, revenusPacks, devise: 'XOF',
    nbPaiements: paiements.length,
    topPacks,
    // Séries temporelles (6 derniers mois).
    revenusParMois: bucketParMois(paiements.map(p => ({ date: p.createdAt, montant: p.montant })), 6, it => it.montant ?? 0),
    inscriptionsParMois: bucketParMois(usersDates.map(u => ({ date: u.createdAt })), 6),
  })
})

// GET /admin/users — liste paginée + recherche.
router.get('/users', async (req, res) => {
  const { page = '1', limit = '50', q } = req.query
  const take = Math.min(parseInt(limit) || 50, 100)
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take
  const where = q
    ? { OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { prenom: { contains: q, mode: 'insensitive' } },
        { nom: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ] }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...ADMIN_USER_SELECT,
        _count: { select: { partiesCreees: true, participations: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take,
    }),
    prisma.user.count({ where }),
  ])
  res.json({ users, total, page: parseInt(page) || 1, limit: take })
})

// GET /admin/users/:id — fiche détaillée + nombre de victoires.
router.get('/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { ...ADMIN_USER_SELECT, _count: { select: { partiesCreees: true, participations: true } } },
  })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })
  const victoires = await prisma.participant.count({ where: { userId: user.id, rang: 1 } })
  res.json({ ...user, victoires })
})

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  prenom: z.string().min(1).max(50),
  nom: z.string().max(50).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  telephone: z.string().max(30).optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTREPRISE', 'ECOLE']).optional(),
  isAdmin: z.boolean().optional(),
})

// POST /admin/users — création par un administrateur.
router.post('/users', async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { password, username, ...rest } = parsed.data

  const normalized = username?.toLowerCase()
  const [email, uname] = await Promise.all([
    prisma.user.findUnique({ where: { email: rest.email } }),
    normalized ? prisma.user.findUnique({ where: { username: normalized } }) : null,
  ])
  if (email) return res.status(409).json({ error: 'Email déjà utilisé' })
  if (uname) return res.status(409).json({ error: 'Ce pseudo est déjà pris' })

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { ...rest, username: normalized, password: hashed },
    select: ADMIN_USER_SELECT,
  })
  res.status(201).json(user)
})

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  prenom: z.string().min(1).max(50).optional(),
  nom: z.string().max(50).nullable().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTREPRISE', 'ECOLE']).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// PATCH /admin/users/:id — modification complète.
router.patch('/users/:id', async (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = { ...parsed.data }

  if (data.email) {
    const taken = await prisma.user.findFirst({ where: { email: data.email, id: { not: req.params.id } }, select: { id: true } })
    if (taken) return res.status(409).json({ error: 'Email déjà utilisé' })
  }
  if (data.username) {
    data.username = data.username.toLowerCase()
    const taken = await prisma.user.findFirst({ where: { username: data.username, id: { not: req.params.id } }, select: { id: true } })
    if (taken) return res.status(409).json({ error: 'Ce pseudo est déjà pris' })
  }
  // Empêche un admin de se retirer lui-même son propre statut admin (verrouillage).
  if (data.isAdmin === false && req.params.id === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre statut admin' })
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: ADMIN_USER_SELECT })
  res.json(user)
})

// POST /admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
  const schema = z.object({ newPassword: z.string().min(6) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const hashed = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } })
  // Révoque les sessions existantes par sécurité.
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })
  res.json({ ok: true })
})

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
  }
  // Nettoyage des dépendances avant suppression (les participations gardent l'historique
  // via onDelete par défaut Restrict → on détache l'utilisateur).
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } })
  await prisma.participant.updateMany({ where: { userId: req.params.id }, data: { userId: null } })
  await prisma.buzzer.updateMany({ where: { ownerId: req.params.id }, data: { ownerId: null } })
  await prisma.question.updateMany({ where: { createdById: req.params.id }, data: { createdById: null } })
  await prisma.partie.updateMany({ where: { animateurId: req.params.id }, data: { animateurId: null } })
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// POST /admin/cleanup-guests — purge manuelle des invités inactifs (body: { days }).
router.post('/cleanup-guests', async (req, res) => {
  const days = Math.max(0, Number(req.body?.days ?? 7))
  const r = await cleanupGuests(days)
  res.json(r)
})

// GET /admin/settings — réglages applicatifs courants.
router.get('/settings', async (_req, res) => {
  res.json(await getSettings())
})

// PATCH /admin/settings — met à jour les réglages.
router.patch('/settings', async (req, res) => {
  const body = req.body ?? {}
  const patch = {}
  if (typeof body.emailVerifyOnRegister === 'boolean') patch.emailVerifyOnRegister = body.emailVerifyOnRegister
  if (typeof body.emailBlockUnverifiedActions === 'boolean') patch.emailBlockUnverifiedActions = body.emailBlockUnverifiedActions
  if (Array.isArray(body.emailRequireVerifiedLoginPlans)) {
    const allowed = ['PRO', 'ENTREPRISE', 'ECOLE']
    patch.emailRequireVerifiedLoginPlans = body.emailRequireVerifiedLoginPlans.filter(p => allowed.includes(p))
  }
  res.json(await updateSettings(patch))
})

export default router
