// ── ROUTES ADMIN FIRMWARE / PARC DE BUZZERS ───────────────────────────────────
// Supervision du parc (batterie, signal, firmware) + cible OTA + déclenchement.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { getFirmwareConfig, setFirmwareConfig } from '../config/firmware.js'
import { offerOtaToAllIdle, adminFactoryReset, adminReleaseBuzzer, adminForgetBuzzer, getBuzzerJournal } from '../services/buzzerService.js'

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

// ── Actions sur un buzzer précis (parc) ───────────────────────────────────────
const macParam = (req) => (req.params.mac ?? '').toUpperCase()

// POST /api/admin/firmware/buzzers/:mac/factory-reset — reset d'usine à distance.
router.post('/buzzers/:mac/factory-reset', async (req, res) => {
  const r = await adminFactoryReset(macParam(req))
  if (!r.success) return res.status(r.error?.includes('introuvable') ? 404 : 409).json({ error: r.error })
  res.json({ ok: true, delivered: r.delivered })
})

// POST /api/admin/firmware/buzzers/:mac/release — libération forcée (retire l'owner).
router.post('/buzzers/:mac/release', async (req, res) => {
  const r = await adminReleaseBuzzer(macParam(req))
  if (!r.success) return res.status(r.error?.includes('introuvable') ? 404 : 409).json({ error: r.error })
  res.json({ ok: true })
})

// DELETE /api/admin/firmware/buzzers/:mac — oublier (supprimer) l'enregistrement.
router.delete('/buzzers/:mac', async (req, res) => {
  const r = await adminForgetBuzzer(macParam(req))
  if (!r.success) return res.status(r.error?.includes('introuvable') ? 404 : 409).json({ error: r.error })
  res.json({ ok: true })
})

// GET /api/admin/firmware/journal — journal d'exploitation (survit aux resets/
// suppressions). Paginé, filtrable par MAC. ADMIN uniquement, jamais exposé aux users.
router.get('/journal', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const mac = typeof req.query.mac === 'string' && req.query.mac.trim() ? req.query.mac.trim() : null
  const result = await getBuzzerJournal({ mac, page, perPage: 30 })
  res.json(result)
})

export default router
