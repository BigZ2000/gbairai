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
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

function signTokens(userId) {
  const access = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
  const refresh = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })
  return { access, refresh }
}

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { email, password, prenom } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email déjà utilisé' })

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, password: hashed, prenom },
    select: { id: true, email: true, prenom: true, plan: true },
  })

  const { access, refresh } = signTokens(user.id)
  await prisma.refreshToken.create({
    data: {
      token: refresh,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  res.status(201).json({ user, access, refresh })
})

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
  }

  const { access, refresh } = signTokens(user.id)
  await prisma.refreshToken.create({
    data: {
      token: refresh,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

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
    await prisma.refreshToken.create({
      data: {
        token: refresh,
        userId: payload.sub,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
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
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, prenom: true, plan: true, planExpireAt: true, createdAt: true },
  })
  res.json(user)
})

export default router
