// ── ROUTES ADMIN FIRMWARE / PARC DE BUZZERS ───────────────────────────────────
// Supervision du parc (batterie, signal, firmware) + cible OTA + déclenchement.
import { Router } from 'express'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { getFirmwareConfig, setFirmwareConfig } from '../config/firmware.js'
import {
  offerOtaToAllIdle, adminFactoryReset, adminReleaseBuzzer, adminForgetBuzzer,
  getBuzzerJournal, countOtaEligible,
} from '../services/buzzerService.js'

const router = Router()
router.use(requireAuth, requireAdmin)

// ── Hébergement des binaires firmware ─────────────────────────────────────────
// Les .bin sont servis par CE serveur, en HTTPS, sous /uploads/firmware/.
// C'est le même domaine que celui auquel les buzzers se connectent déjà
// (api.gbairai.robotechci.com) → aucun hébergement tiers à prévoir.
const FIRMWARE_DIR = path.join(process.cwd(), 'uploads', 'firmware')
fs.mkdirSync(FIRMWARE_DIR, { recursive: true })

const uploadBin = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FIRMWARE_DIR),
    // Nom lisible et versionné : gbairai_buzzer-<version>-<horodatage>.bin
    filename: (req, _file, cb) => {
      const v = String(req.body?.version || 'firmware').replace(/[^a-zA-Z0-9._-]/g, '')
      cb(null, `gbairai_buzzer-${v}-${Date.now()}.bin`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 Mo : très large pour un ESP32
  fileFilter: (_req, file, cb) => cb(null, file.originalname.toLowerCase().endsWith('.bin')),
}).single('file')

// Base publique utilisée pour construire l'URL du .bin donnée aux buzzers.
// Priorité à API_PUBLIC_URL ; sinon on la déduit des en-têtes (proxy Caddy inclus).
function publicBase(req) {
  const configured = process.env.API_PUBLIC_URL
  if (configured) return configured.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol || 'https'
  return `${proto}://${req.get('host')}`
}

// GET /api/admin/firmware — config OTA + état du parc + éligibles à la MAJ.
router.get('/', async (_req, res) => {
  const buzzers = await prisma.buzzer.findMany({
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true, mac: true, nom: true, status: true, firmware: true,
      battery: true, rssi: true, lastSeenAt: true, lastTelemetryAt: true,
      owner: { select: { email: true, prenom: true } },
    },
  })
  res.json({ config: getFirmwareConfig(), buzzers, otaEligible: await countOtaEligible() })
})

// POST /api/admin/firmware/upload — téléverser un .bin, servi ensuite en HTTPS.
// Renvoie l'URL publique à coller (ou déjà appliquée) dans la config OTA.
router.post('/upload', (req, res) => {
  uploadBin(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'Fichier .bin manquant (ou extension invalide)' })

    const url = `${publicBase(req)}/uploads/firmware/${req.file.filename}`
    // Confort : si une version est fournie, on applique directement la cible OTA.
    const version = String(req.body?.version || '').trim()
    const config = version
      ? await setFirmwareConfig({ version, url })
      : await setFirmwareConfig({ url })

    res.status(201).json({ ok: true, url, taille: req.file.size, config })
  })
})

// PUT /api/admin/firmware — définir la cible OTA (version, url, activation).
router.put('/', async (req, res) => {
  const parsed = z.object({
    enabled: z.boolean().optional(),
    version: z.string().max(40).optional(),
    url: z.string().max(500).optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })
  res.json(await setFirmwareConfig(parsed.data))
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
