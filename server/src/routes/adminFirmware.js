// ── ROUTES ADMIN FIRMWARE / PARC DE BUZZERS ───────────────────────────────────
// Supervision du parc (batterie, signal, firmware) + cible OTA + déclenchement.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { getFirmwareConfig, setFirmwareConfig } from '../config/firmware.js'
import { offerOtaToAllIdle } from '../services/buzzerService.js'

const router = Router()
router.use(requireAuth, requireAdmin)

// GET /api/admin/firmware — config OTA + état du parc.
router.get('/', async (_req, res) => {
  const buzzers = await prisma.buzzer.findMany({
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true, mac: true, nom: true, status: true, firmware: true,
      battery: true, rssi: true, lastSeenAt: true, lastTelemetryAt: true,
      owner: { select: { email: true, prenom: true } },
    },
  })
  res.json({ config: getFirmwareConfig(), buzzers })
})

// PUT /api/admin/firmware — définir la cible OTA (version, url, activation).
router.put('/', async (req, res) => {
  const parsed = z.object({
    enabled: z.boolean().optional(),
    version: z.string().max(40).optional(),
    url: z.string().max(500).optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })
  res.json(setFirmwareConfig(parsed.data))
})

// POST /api/admin/firmware/push — pousser l'OTA à tous les buzzers en ligne/au repos.
router.post('/push', async (_req, res) => {
  const pushed = await offerOtaToAllIdle()
  res.json({ ok: true, pushed })
})

export default router
