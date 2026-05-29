import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /categories — list all with rubriques
router.get('/', async (_req, res) => {
  const categories = await prisma.categorie.findMany({
    where: { publique: true },
    include: { rubriques: { orderBy: { nom: 'asc' } } },
    orderBy: { nom: 'asc' },
  })
  res.json(categories)
})

// POST /categories — create (auth required)
router.post('/', requireAuth, async (req, res) => {
  const Schema = z.object({
    nom: z.string().min(1).max(80),
    emoji: z.string().max(10).optional(),
    description: z.string().max(300).optional(),
    publique: z.boolean().default(true),
  })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const categorie = await prisma.categorie.create({ data: parsed.data })
  res.status(201).json(categorie)
})

// POST /categories/:categorieId/rubriques — create rubrique
router.post('/:categorieId/rubriques', requireAuth, async (req, res) => {
  const { categorieId } = req.params
  const Schema = z.object({ nom: z.string().min(1).max(80) })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const cat = await prisma.categorie.findUnique({ where: { id: categorieId } })
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' })

  const rubrique = await prisma.rubrique.create({ data: { nom: parsed.data.nom, categorieId } })
  res.status(201).json(rubrique)
})

export default router
