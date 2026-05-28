import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { claimBuzzer, releaseBuzzer } from '../services/buzzerService.js'

const router = Router()

// Mes buzzers
router.get('/', requireAuth, async (req, res) => {
  const buzzers = await prisma.buzzer.findMany({
    where: { ownerId: req.userId },
    orderBy: { createdAt: 'asc' },
  })
  res.json(buzzers)
})

// Réclamer un buzzer (premier appairage ou re-claim après libération)
router.post('/claim', requireAuth, async (req, res) => {
  const { mac } = req.body
  if (!mac) return res.status(400).json({ error: 'Adresse MAC requise' })
  const result = await claimBuzzer(mac.toUpperCase(), req.userId)
  if (!result.success) return res.status(409).json({ error: result.error, code: result.code })
  res.json(result.buzzer)
})

// Mettre à jour le nom ou la couleur
router.patch('/:mac', requireAuth, async (req, res) => {
  const mac = req.params.mac.toUpperCase()
  const UpdateSchema = z.object({
    nom: z.string().min(1).max(50).optional(),
    couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  })
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return res.status(404).json({ error: 'Buzzer introuvable' })
  if (buzzer.ownerId !== req.userId) return res.status(403).json({ error: 'Ce buzzer ne vous appartient pas' })

  const updated = await prisma.buzzer.update({
    where: { mac },
    data: parsed.data,
  })
  res.json(updated)
})

// Libérer un buzzer
router.delete('/:mac/claim', requireAuth, async (req, res) => {
  const mac = req.params.mac.toUpperCase()
  const result = await releaseBuzzer(mac, req.userId)
  if (!result.success) return res.status(400).json({ error: result.error })
  res.json({ ok: true })
})

export default router
