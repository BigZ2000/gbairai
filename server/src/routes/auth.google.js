import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { signTokens, storeRefreshToken } from './auth.js'

const router = Router()

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173'
const SERVER_URL = () => process.env.SERVER_URL || 'http://localhost:4000'
const REDIRECT_URI = () => `${SERVER_URL()}/api/auth/google/callback`

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
    // Exchange auth code for tokens
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

    // Decode the id_token (JWT) to extract user info — no verification needed here
    // since we just got it directly from Google's token endpoint over HTTPS
    const [, payloadB64] = tokenData.id_token.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    const { email, given_name: givenName, sub: googleId } = payload

    if (!email) {
      return res.redirect(`${clientUrl}/login?error=google_no_email`)
    }

    // Upsert user: find by googleId first, fall back to email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    })

    if (user) {
      // Link googleId if logging in via email account for first time with Google
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        })
      }
    } else {
      // New user — create account (username will be null, set later if needed)
      const baseUsername = (givenName ?? email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 25) || 'user'

      // Find an available username
      let username = baseUsername
      let attempt = 0
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${Math.floor(10 + Math.random() * 990)}`
        if (++attempt > 20) { username = null; break }
      }

      user = await prisma.user.create({
        data: {
          email,
          googleId,
          prenom: givenName ?? email.split('@')[0],
          username,
          password: '',
        },
      })
    }

    const { access, refresh } = signTokens(user.id)
    await storeRefreshToken(user.id, refresh)

    res.redirect(`${clientUrl}/auth/callback?access=${access}&refresh=${refresh}`)
  } catch (err) {
    console.error('Google OAuth error:', err)
    res.redirect(`${CLIENT_URL()}/login?error=google_server_error`)
  }
})

export default router
