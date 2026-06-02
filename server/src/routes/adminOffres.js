// ── ROUTES ADMIN OFFRES ───────────────────────────────────────────────────────
// CRUD du catalogue commercial. Les offres sont pilotées ici, jamais dans le code.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()
router.use(requireAuth, requireAdmin)

const OffreSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9_]+$/),
  nom: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  categorie: z.enum(['PERSONNEL', 'ORGANISATION']).optional(),
  plan: z.enum(['FREE', 'PRO', 'PREMIUM', 'ENTREPRISE', 'ECOLE']).optional(),
  prix: z.number().int().min(0).max(100000000).optional(),
  dureeJours: z.number().int().min(0).max(3650).optional(),
  sieges: z.number().int().min(1).max(100000).optional(),
  fonctionnalites: z.array(z.string().max(80)).max(20).optional(),
  couleur: z.string().max(20).optional(),
  populaire: z.boolean().optional(),
  visible: z.boolean().optional(),
  ordre: z.number().int().min(0).max(1000).optional(),
})

// GET /api/admin/offres — liste + nombre d'abonnés par plan interne.
router.get('/', async (_req, res) => {
  const offres = await prisma.offre.findMany({ orderBy: [{ ordre: 'asc' }, { prix: 'asc' }] })
  const abonnes = await prisma.user.groupBy({ by: ['plan'], _count: { _all: true } })
  const abonneMap = Object.fromEntries(abonnes.map(a => [a.plan, a._count._all]))
  res.json(offres.map(o => ({ ...o, abonnesPlan: abonneMap[o.plan] ?? 0 })))
})

// POST /api/admin/offres — créer.
router.post('/', async (req, res) => {
  const parsed = OffreSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const exists = await prisma.offre.findUnique({ where: { code: parsed.data.code } })
  if (exists) return res.status(409).json({ error: 'Ce code existe déjà' })
  const offre = await prisma.offre.create({ data: parsed.data })
  res.status(201).json(offre)
})

// PATCH /api/admin/offres/:id — modifier.
router.patch('/:id', async (req, res) => {
  const parsed = OffreSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  if (parsed.data.code) {
    const taken = await prisma.offre.findFirst({ where: { code: parsed.data.code, id: { not: req.params.id } } })
    if (taken) return res.status(409).json({ error: 'Ce code existe déjà' })
  }
  const offre = await prisma.offre.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(offre)
})

// DELETE /api/admin/offres/:id — supprimer (préférer visible=false).
router.delete('/:id', async (req, res) => {
  await prisma.offre.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
