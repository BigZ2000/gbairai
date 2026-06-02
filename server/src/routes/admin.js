import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin)

const ADMIN_USER_SELECT = {
  id: true, email: true, prenom: true, nom: true, username: true, telephone: true,
  plan: true, isAdmin: true, isActive: true, createdAt: true, lastSeenAt: true,
}

// GET /admin/stats
router.get('/stats', async (_req, res) => {
  const [users, questions, parties, categories] = await Promise.all([
    prisma.user.count(),
    prisma.question.count(),
    prisma.partie.count(),
    prisma.categorie.count(),
  ])
  res.json({ users, questions, parties, categories })
})

// GET /admin/analytics — analytiques business (abonnés, revenus, conversion…).
router.get('/analytics', async (_req, res) => {
  const [parPlan, totalUsers, paiements, ventesPack, abonnementsActifs] = await Promise.all([
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.paiement.findMany({ where: { statut: 'SUCCESS' }, select: { montant: true, plan: true, packId: true } }),
    prisma.paiement.groupBy({
      by: ['packId'], where: { statut: 'SUCCESS', packId: { not: null } },
      _count: { _all: true }, _sum: { montant: true },
    }),
    prisma.subscription.count({ where: { statut: 'ACTIVE' } }),
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
  plan: z.enum(['FREE', 'PRO', 'PREMIUM']).optional(),
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
  plan: z.enum(['FREE', 'PRO', 'PREMIUM']).optional(),
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

export default router
