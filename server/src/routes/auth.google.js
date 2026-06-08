import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { signTokens, storeRefreshToken } from './auth.js'

const router = Router()

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173'
const SERVER_URL = () => process.env.SERVER_URL || 'http://localhost:4000'
const REDIRECT_URI = () => `${SERVER_URL()}/api/auth/google/callback`

const PENDING_SECRET = () => process.env.JWT_SECRET + '_google_pending'

function signPendingToken(data) {
  return jwt.sign({ ...data, type: 'google_pending' }, PENDING_SECRET(), { expiresIn: '10m' })
}

function verifyPendingToken(token) {
  const payload = jwt.verify(token, PENDING_SECRET())
  if (payload.type !== 'google_pending') throw new Error('Invalid token type')
  return payload
}

// GET /api/auth/google — redirect to Google consent screen
router.get('/', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(`${CLIENT_URL()}/login?error=google_not_configured`)
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// GET /api/auth/google/callback — Google redirects here after consent
router.get('/callback', async (req, res) => {
  const { code, error } = req.query
  const clientUrl = CLIENT_URL()

  if (error || !code) {
    return res.redirect(`${clientUrl}/login?error=google_cancelled`)
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${clientUrl}/login?error=google_not_configured`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI(),
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.id_token) {
      return res.redirect(`${clientUrl}/login?error=google_token_failed`)
    }

    const [, payloadB64] = tokenData.id_token.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    const { email, given_name: givenName, sub: googleId } = payload

    if (!email) {
      return res.redirect(`${clientUrl}/login?error=google_no_email`)
    }

    // Check if user already exists (by googleId or email)
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    })

    if (user) {
      // Existing user — link googleId if needed + email vérifié (Google le garantit).
      if (!user.googleId || !user.emailVerified) {
        await prisma.user.update({ where: { id: user.id }, data: { googleId, emailVerified: true } })
      }
      const { access, refresh } = signTokens(user.id)
      await storeRefreshToken(user.id, refresh)
      return res.redirect(`${clientUrl}/auth/callback?access=${access}&refresh=${refresh}`)
    }

    // New user — redirect to profile completion page with a short-lived pending token
    const pendingToken = signPendingToken({
      email,
      googleId,
      prenom: givenName ?? email.split('@')[0],
    })
    res.redirect(`${clientUrl}/register/google?pending=${encodeURIComponent(pendingToken)}`)
  } catch (err) {
    console.error('Google OAuth error:', err)
    res.redirect(`${CLIENT_URL()}/login?error=google_server_error`)
  }
})

// POST /api/auth/google/complete — finalize registration after profile completion
const CompleteSchema = z.object({
  pendingToken: z.string(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  prenom: z.string().min(1).max(50),
})

router.post('/complete', async (req, res) => {
  const parsed = CompleteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { pendingToken, username, prenom } = parsed.data

  let pending
  try {
    pending = verifyPendingToken(pendingToken)
  } catch {
    return res.status(401).json({ error: 'Lien expiré ou invalide. Recommence la connexion Google.' })
  }

  const normalizedUsername = username.toLowerCase()

  // Double-check email and username aren't taken (race condition guard)
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: pending.email } }),
    prisma.user.findUnique({ where: { username: normalizedUsername } }),
  ])
  if (existingEmail) return res.status(409).json({ error: 'Ce compte Google est déjà enregistré. Connecte-toi.' })
  if (existingUsername) return res.status(409).json({ error: 'Ce pseudo est déjà pris.' })

  const user = await prisma.user.create({
    data: {
      email: pending.email,
      googleId: pending.googleId,
      prenom: prenom.trim(),
      username: normalizedUsername,
      password: '',
      emailVerified: true, // Google a déjà vérifié l'adresse
    },
  })

  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh)
  res.status(201).json({ access, refresh })
})

export default router
