import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin)

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

// GET /admin/users
router.get('/users', async (req, res) => {
  const { page = '1', limit = '50', q } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const where = q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { prenom: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] } : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, prenom: true, username: true, plan: true, isAdmin: true, createdAt: true, _count: { select: { partiesCreees: true, questionsCreees: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ])
  res.json({ users, total })
})

// PATCH /admin/users/:id — toggle admin
router.patch('/users/:id', async (req, res) => {
  const { isAdmin } = req.body
  if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'isAdmin booléen requis' })
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isAdmin },
    select: { id: true, email: true, prenom: true, isAdmin: true },
  })
  res.json(user)
})

export default router
