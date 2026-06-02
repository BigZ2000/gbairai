// ── ROUTES PROFIL ─────────────────────────────────────────────────────────────
// Gestion du compte par l'utilisateur lui-même : informations personnelles,
// sécurité (mot de passe, sessions), préférences (thème/langue) et statistiques.
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const USER_SELECT = {
  id: true, email: true, prenom: true, nom: true, username: true, telephone: true,
  avatarUrl: true, theme: true, langue: true, plan: true, planExpireAt: true,
  createdAt: true, isAdmin: true,
}

const ProfileSchema = z.object({
  prenom: z.string().min(1).max(50).optional(),
  nom: z.string().max(50).nullable().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  telephone: z.string().max(30).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  langue: z.string().max(5).optional(),
})

// PATCH /profile — met à jour les informations personnelles / préférences.
router.patch('/', async (req, res) => {
  const parsed = ProfileSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = { ...parsed.data }
  if (data.username) {
    const normalized = data.username.toLowerCase()
    const taken = await prisma.user.findFirst({
      where: { username: normalized, id: { not: req.userId } },
      select: { id: true },
    })
    if (taken) return res.status(409).json({ error: 'Ce pseudo est déjà pris' })
    data.username = normalized
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data, select: USER_SELECT })
  res.json(user)
})

// POST /profile/password — change le mot de passe.
const PasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6),
})
router.post('/password', async (req, res) => {
  const parsed = PasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

  // Si un mot de passe existe déjà, on exige l'ancien (sauf comptes Google sans mdp).
  if (user.password) {
    const ok = await bcrypt.compare(parsed.data.currentPassword ?? '', user.password)
    if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' })
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } })
  res.json({ ok: true })
})

// GET /profile/sessions — liste les sessions actives (refresh tokens).
router.get('/sessions', async (req, res) => {
  const currentToken = (req.query.current ?? '').toString()
  const sessions = await prisma.refreshToken.findMany({
    where: { userId: req.userId, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ip: true, lastUsedAt: true, createdAt: true, token: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  res.json(sessions.map(s => ({
    id: s.id,
    userAgent: s.userAgent,
    ip: s.ip,
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    current: s.token === currentToken,
  })))
})

// DELETE /profile/sessions/others — déconnecte tous les autres appareils.
router.delete('/sessions/others', async (req, res) => {
  const currentToken = (req.body?.current ?? '').toString()
  await prisma.refreshToken.deleteMany({
    where: { userId: req.userId, token: { not: currentToken } },
  })
  res.json({ ok: true })
})

// GET /profile/stats — statistiques personnelles.
router.get('/stats', async (req, res) => {
  const userId = req.userId

  const participations = await prisma.participant.findMany({
    where: { userId, partie: { status: 'TERMINEE' } },
    select: { score: true, rang: true, partie: { select: { startedAt: true, endedAt: true } } },
  })

  const partiesJouees = participations.length
  const partiesGagnees = participations.filter(p => p.rang === 1).length
  const meilleurScore = participations.reduce((max, p) => Math.max(max, p.score ?? 0), 0)
  const tempsTotalMs = participations.reduce((sum, p) => {
    const s = p.partie?.startedAt, e = p.partie?.endedAt
    return sum + (s && e ? Math.max(0, new Date(e) - new Date(s)) : 0)
  }, 0)
  const rangs = participations.filter(p => p.rang != null).map(p => p.rang)
  const rangMoyen = rangs.length ? rangs.reduce((a, b) => a + b, 0) / rangs.length : null
  const tauxVictoire = partiesJouees ? Math.round((partiesGagnees / partiesJouees) * 100) : 0

  const partiesCreees = await prisma.partie.count({
    where: { participants: { some: { userId, isAnimateur: true } } },
  })

  res.json({
    partiesJouees,
    partiesGagnees,
    partiesCreees,
    meilleurScore,
    tempsTotalMin: Math.round(tempsTotalMs / 60000),
    tauxVictoire,
    rangMoyen: rangMoyen != null ? Math.round(rangMoyen * 10) / 10 : null,
  })
})

export default router
