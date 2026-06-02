import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  prenom: z.string().min(1).max(50),
  username: z.string()
    .min(3).max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Lettres, chiffres, _ et - uniquement'),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export function signTokens(userId) {
  const access = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
  const refresh = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })
  return { access, refresh }
}

export async function storeRefreshToken(userId, token, req) {
  await prisma.refreshToken.create({
    data: {
      token, userId,
      userAgent: req?.headers?.['user-agent']?.slice(0, 255) ?? null,
      ip: (req?.headers?.['x-forwarded-for']?.toString().split(',')[0] || req?.socket?.remoteAddress || null),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}

const USER_SELECT = {
  id: true, email: true, prenom: true, nom: true, username: true, telephone: true,
  avatarUrl: true, theme: true, langue: true, plan: true, planExpireAt: true,
  createdAt: true, isAdmin: true, isGuest: true,
}

const GuestSchema = z.object({ prenom: z.string().min(1).max(30) })

// POST /auth/guest — compte invité (sans email/mot de passe) pour rejoindre
// une partie en un clic. Réutilise toute la machinerie (tokens, WS, participant).
router.post('/guest', async (req, res) => {
  const parsed = GuestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Pseudo requis' })
  const prenom = parsed.data.prenom.trim().slice(0, 30)

  // Email synthétique unique, jamais utilisé pour se connecter.
  const email = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@guest.gbairai`
  const user = await prisma.user.create({
    data: { email, prenom, isGuest: true, password: '' },
    select: USER_SELECT,
  })
  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh, req)
  res.status(201).json({ user, access, refresh })
})

// GET /auth/check-username?username=xxx
router.get('/check-username', async (req, res) => {
  const raw = (req.query.username ?? '').toString().trim().toLowerCase()
  if (!raw || raw.length < 3) return res.json({ available: false, suggestions: [] })

  const existing = await prisma.user.findUnique({ where: { username: raw } })
  if (!existing) return res.json({ available: true, suggestions: [] })

  const suggestions = []
  for (let i = 0; suggestions.length < 3 && i < 20; i++) {
    const candidate = `${raw}${Math.floor(10 + Math.random() * 990)}`
    const taken = await prisma.user.findUnique({ where: { username: candidate } })
    if (!taken) suggestions.push(candidate)
  }
  res.json({ available: false, suggestions })
})

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { email, password, prenom, username } = parsed.data
  const normalizedUsername = username.toLowerCase()

  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username: normalizedUsername } }),
  ])
  if (existingEmail) return res.status(409).json({ error: 'Email déjà utilisé' })
  if (existingUsername) return res.status(409).json({ error: 'Ce pseudo est déjà pris' })

  const hashed = await bcrypt.hash(password, 10)

  // CONVERSION INVITÉ → COMPTE (en place) : si la requête porte le jeton d'un
  // compte invité, on transforme CE compte (même id) au lieu d'en créer un
  // nouveau → score, historique et participations sont conservés.
  let guestId = null
  const authz = req.headers.authorization
  if (authz?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authz.slice(7), process.env.JWT_SECRET)
      const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isGuest: true } })
      if (u?.isGuest) guestId = u.id
    } catch { /* jeton invalide → inscription normale */ }
  }

  const user = guestId
    ? await prisma.user.update({
        where: { id: guestId },
        data: { email, password: hashed, prenom, username: normalizedUsername, isGuest: false },
        select: USER_SELECT,
      })
    : await prisma.user.create({
        data: { email, password: hashed, prenom, username: normalizedUsername },
        select: USER_SELECT,
      })

  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh, req)
  res.status(guestId ? 200 : 201).json({ user, access, refresh })
})

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
  }
  if (user.isActive === false) {
    return res.status(403).json({ error: 'Compte désactivé. Contactez un administrateur.' })
  }

  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh, req)
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {})

  const { password: _, ...safe } = user
  res.json({ user: safe, access, refresh })
})

router.post('/refresh', async (req, res) => {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token requis' })

  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  if (!stored || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Token expiré ou invalide' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    await prisma.refreshToken.delete({ where: { token } })
    const { access, refresh } = signTokens(payload.sub)
    await storeRefreshToken(payload.sub, refresh, req)
    res.json({ access, refresh })
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
})

router.post('/logout', requireAuth, async (req, res) => {
  const { token } = req.body
  if (token) await prisma.refreshToken.deleteMany({ where: { token, userId: req.userId } })
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT })
  res.json(user)
})

export default router
