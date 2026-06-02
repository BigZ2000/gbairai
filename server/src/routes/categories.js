import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()

// GET /categories — list all with rubriques + question counts
router.get('/', async (_req, res) => {
  const categories = await prisma.categorie.findMany({
    where: { publique: true },
    include: {
      rubriques: {
        orderBy: { nom: 'asc' },
        include: { _count: { select: { questions: true } } },
      },
      _count: { select: { questions: true } },
    },
    orderBy: { nom: 'asc' },
  })
  res.json(categories)
})

// POST /categories — create (admin)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
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

// PATCH /categories/:categorieId — edit (admin)
router.patch('/:categorieId', requireAuth, requireAdmin, async (req, res) => {
  const { categorieId } = req.params
  const Schema = z.object({
    nom: z.string().min(1).max(80).optional(),
    emoji: z.string().max(10).nullable().optional(),
    description: z.string().max(300).nullable().optional(),
    publique: z.boolean().optional(),
  })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const cat = await prisma.categorie.findUnique({ where: { id: categorieId } })
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' })

  const categorie = await prisma.categorie.update({ where: { id: categorieId }, data: parsed.data })
  res.json(categorie)
})

// DELETE /categories/:categorieId — delete (admin)
// Rubriques liées sont supprimées en cascade ; les questions perdent leur catégorie (SetNull).
router.delete('/:categorieId', requireAuth, requireAdmin, async (req, res) => {
  const { categorieId } = req.params
  const cat = await prisma.categorie.findUnique({ where: { id: categorieId } })
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' })

  await prisma.categorie.delete({ where: { id: categorieId } })
  res.json({ success: true })
})

// POST /categories/:categorieId/rubriques — create rubrique (admin)
router.post('/:categorieId/rubriques', requireAuth, requireAdmin, async (req, res) => {
  const { categorieId } = req.params
  const Schema = z.object({ nom: z.string().min(1).max(80) })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const cat = await prisma.categorie.findUnique({ where: { id: categorieId } })
  if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' })

  const rubrique = await prisma.rubrique.create({ data: { nom: parsed.data.nom, categorieId } })
  res.status(201).json(rubrique)
})

// PATCH /categories/:categorieId/rubriques/:rubriqueId — edit rubrique (admin)
router.patch('/:categorieId/rubriques/:rubriqueId', requireAuth, requireAdmin, async (req, res) => {
  const { categorieId, rubriqueId } = req.params
  const Schema = z.object({ nom: z.string().min(1).max(80) })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const rubrique = await prisma.rubrique.findUnique({ where: { id: rubriqueId } })
  if (!rubrique || rubrique.categorieId !== categorieId) {
    return res.status(404).json({ error: 'Rubrique introuvable' })
  }

  const updated = await prisma.rubrique.update({ where: { id: rubriqueId }, data: { nom: parsed.data.nom } })
  res.json(updated)
})

// DELETE /categories/:categorieId/rubriques/:rubriqueId — delete rubrique (admin)
// Les questions liées perdent leur rubrique (SetNull).
router.delete('/:categorieId/rubriques/:rubriqueId', requireAuth, requireAdmin, async (req, res) => {
  const { categorieId, rubriqueId } = req.params
  const rubrique = await prisma.rubrique.findUnique({ where: { id: rubriqueId } })
  if (!rubrique || rubrique.categorieId !== categorieId) {
    return res.status(404).json({ error: 'Rubrique introuvable' })
  }

  await prisma.rubrique.delete({ where: { id: rubriqueId } })
  res.json({ success: true })
})

export default router
