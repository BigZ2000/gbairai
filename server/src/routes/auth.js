import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import dns from 'dns/promises'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../config/mailer.js'
import { sendVerificationSms, normalizePhone, sendPasswordResetSms } from '../config/sms.js'
import { getSettings } from '../config/settings.js'

const router = Router()

// Vérifie que le domaine de l'email possède des serveurs de mail (MX) ou au moins
// une adresse (A/AAAA, fallback SMTP). Bloque les domaines bidons SANS rien envoyer.
async function emailDomainResolvable(email) {
  const domain = String(email).split('@')[1]
  if (!domain) return false
  try {
    const mx = await dns.resolveMx(domain)
    if (mx && mx.length) return true
  } catch { /* pas de MX → on tente A/AAAA */ }
  try { return (await dns.lookup(domain)).address != null } catch { return false }
}

// Génère un code à 6 chiffres + un jeton de lien + une expiration (24 h).
function makeVerification() {
  return {
    verifyCode: String(Math.floor(100000 + Math.random() * 900000)),
    verifyToken: crypto.randomBytes(24).toString('hex'),
    verifyExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  prenom: z.string().min(1).max(50),
  username: z.string()
    .min(3).max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Lettres, chiffres, _ et - uniquement'),
})

const RegisterPhoneSchema = z.object({
  telephone: z.string().min(6).max(20),
  password: z.string().min(6),
  prenom: z.string().min(1).max(50),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Lettres, chiffres, _ et - uniquement'),
})

// Connexion par email OU téléphone (un seul des deux requis).
const LoginSchema = z.object({
  email: z.string().email().optional(),
  telephone: z.string().min(6).max(20).optional(),
  password: z.string(),
})

export function signTokens(userId) {
  const access = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
  // `jti` aléatoire → chaque refresh token est unique même si deux sont émis dans
  // la même seconde pour le même user (sinon collision sur l'index unique `token`).
  const refresh = jwt.sign({ sub: userId, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' })
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
  createdAt: true, isAdmin: true, isGuest: true, emailVerified: true, phoneVerified: true,
}

// Un compte est « vérifié » si son email OU son téléphone est confirmé.
function isVerified(u) { return !!(u?.emailVerified || u?.phoneVerified) }

// Génère un OTP SMS à 6 chiffres + expiration (15 min).
function makePhoneOtp() {
  return {
    phoneCode: String(Math.floor(100000 + Math.random() * 900000)),
    phoneCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
  }
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

  const settings = await getSettings()
  const verifyOnRegister = settings.emailVerifyOnRegister !== false

  // Pré-contrôle : le domaine de l'email doit être résolvable (MX/A) — bloque les
  // domaines inexistants avant même d'envoyer (réduit les fautes de frappe).
  // (Seulement si la vérification est activée.)
  if (verifyOnRegister && !(await emailDomainResolvable(email))) {
    return res.status(400).json({ error: "Cette adresse email semble invalide (domaine introuvable)." })
  }

  const hashed = await bcrypt.hash(password, 10)
  const verif = verifyOnRegister ? makeVerification() : null

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

  const data = {
    email, password: hashed, prenom, username: normalizedUsername,
    emailVerified: !verifyOnRegister, // auto-vérifié si la vérif est désactivée
    ...(verif ?? {}),
  }
  const user = guestId
    ? await prisma.user.update({ where: { id: guestId }, data: { ...data, isGuest: false }, select: USER_SELECT })
    : await prisma.user.create({ data, select: USER_SELECT })

  // Envoi du mail de vérification (best-effort) si activé.
  if (verif) {
    sendVerificationEmail({ to: email, prenom, code: verif.verifyCode, token: verif.verifyToken })
      .catch(e => console.error('[mail] envoi vérif échoué:', e?.message))
  }

  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh, req)
  res.status(guestId ? 200 : 201).json({ user, access, refresh })
})

// POST /auth/verify-email — confirmation par CODE (utilisateur connecté).
router.post('/verify-email', requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? '').trim()
  const u = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!u) return res.status(404).json({ error: 'Compte introuvable' })
  if (u.emailVerified) return res.json({ ok: true, alreadyVerified: true })
  if (!u.verifyCode || u.verifyCode !== code) return res.status(400).json({ error: 'Code incorrect' })
  if (u.verifyExpiry && u.verifyExpiry < new Date()) return res.status(400).json({ error: 'Code expiré — renvoie un nouveau code' })
  await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true, verifyCode: null, verifyToken: null, verifyExpiry: null } })
  res.json({ ok: true })
})

// POST /auth/verify-email-token — confirmation par LIEN (public, jeton).
router.post('/verify-email-token', async (req, res) => {
  const token = String(req.body?.token ?? '').trim()
  if (!token) return res.status(400).json({ error: 'Jeton manquant' })
  const u = await prisma.user.findUnique({ where: { verifyToken: token } })
  if (!u) {
    // Jeton déjà consommé (compte déjà vérifié) → succès idempotent.
    return res.status(400).json({ error: 'Lien invalide ou déjà utilisé' })
  }
  if (u.verifyExpiry && u.verifyExpiry < new Date()) return res.status(400).json({ error: 'Lien expiré — renvoie un nouveau mail' })
  await prisma.user.update({ where: { id: u.id }, data: { emailVerified: true, verifyCode: null, verifyToken: null, verifyExpiry: null } })
  res.json({ ok: true })
})

// POST /auth/resend-verification — renvoyer le mail (utilisateur connecté).
router.post('/resend-verification', requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!u) return res.status(404).json({ error: 'Compte introuvable' })
  if (u.emailVerified) return res.json({ ok: true, alreadyVerified: true })
  if (u.isGuest) return res.status(400).json({ error: 'Crée d\'abord un compte' })
  const verif = makeVerification()
  await prisma.user.update({ where: { id: u.id }, data: verif })
  await sendVerificationEmail({ to: u.email, prenom: u.prenom, code: verif.verifyCode, token: verif.verifyToken })
    .catch(e => console.error('[mail] renvoi vérif échoué:', e?.message))
  res.json({ ok: true })
})

// ── INSCRIPTION PAR TÉLÉPHONE (OTP SMS) ───────────────────────────────────────
router.post('/register-phone', async (req, res) => {
  const parsed = RegisterPhoneSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { telephone, password, prenom, username } = parsed.data

  const phone = normalizePhone(telephone)
  if (!phone) return res.status(400).json({ error: 'Numéro de téléphone invalide.' })
  const normalizedUsername = username.toLowerCase()

  const [existingPhone, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { telephone: phone } }),
    prisma.user.findUnique({ where: { username: normalizedUsername } }),
  ])
  if (existingPhone) return res.status(409).json({ error: 'Numéro déjà utilisé' })
  if (existingUsername) return res.status(409).json({ error: 'Ce pseudo est déjà pris' })

  const settings = await getSettings()
  const verifyOnRegister = settings.phoneVerifyOnRegister !== false
  const hashed = await bcrypt.hash(password, 10)
  const otp = verifyOnRegister ? makePhoneOtp() : null
  // Email synthétique (le compte se connecte par téléphone) — jamais utilisé pour login.
  const synthEmail = `${phone.replace('+', '')}@phone.gbairai`

  // Conversion invité en place si un jeton invité est fourni.
  let guestId = null
  const authz = req.headers.authorization
  if (authz?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authz.slice(7), process.env.JWT_SECRET)
      const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isGuest: true } })
      if (u?.isGuest) guestId = u.id
    } catch { /* ignore */ }
  }

  const data = {
    telephone: phone, password: hashed, prenom, username: normalizedUsername,
    phoneVerified: !verifyOnRegister, ...(otp ?? {}),
  }
  const user = guestId
    ? await prisma.user.update({ where: { id: guestId }, data: { ...data, isGuest: false }, select: USER_SELECT })
    : await prisma.user.create({ data: { ...data, email: synthEmail }, select: USER_SELECT })

  if (otp) {
    sendVerificationSms({ to: phone, code: otp.phoneCode }).catch(e => console.error('[sms] envoi OTP échoué:', e?.message))
  }

  const { access, refresh } = signTokens(user.id)
  await storeRefreshToken(user.id, refresh, req)
  res.status(guestId ? 200 : 201).json({ user, access, refresh })
})

// POST /auth/verify-phone — confirmation par OTP (utilisateur connecté).
router.post('/verify-phone', requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? '').trim()
  const u = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!u) return res.status(404).json({ error: 'Compte introuvable' })
  if (u.phoneVerified) return res.json({ ok: true, alreadyVerified: true })
  if (!u.phoneCode || u.phoneCode !== code) return res.status(400).json({ error: 'Code incorrect' })
  if (u.phoneCodeExpiry && u.phoneCodeExpiry < new Date()) return res.status(400).json({ error: 'Code expiré — renvoie un nouveau code' })
  await prisma.user.update({ where: { id: u.id }, data: { phoneVerified: true, phoneCode: null, phoneCodeExpiry: null } })
  res.json({ ok: true })
})

// POST /auth/resend-phone — renvoyer l'OTP (utilisateur connecté).
router.post('/resend-phone', requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!u) return res.status(404).json({ error: 'Compte introuvable' })
  if (u.phoneVerified) return res.json({ ok: true, alreadyVerified: true })
  if (!u.telephone) return res.status(400).json({ error: 'Aucun numéro associé' })
  const otp = makePhoneOtp()
  await prisma.user.update({ where: { id: u.id }, data: otp })
  await sendVerificationSms({ to: u.telephone, code: otp.phoneCode }).catch(e => console.error('[sms] renvoi OTP échoué:', e?.message))
  res.json({ ok: true })
})

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { email, telephone, password } = parsed.data
  if (!email && !telephone) return res.status(400).json({ error: 'Email ou téléphone requis' })

  // Résolution par email OU téléphone (normalisé).
  const phone = telephone ? normalizePhone(telephone) : null
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : (phone ? await prisma.user.findUnique({ where: { telephone: phone } }) : null)

  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
  }
  if (user.isActive === false) {
    return res.status(403).json({ error: 'Compte désactivé. Contactez un administrateur.' })
  }

  // Certains plans (réglage admin) exigent un contact vérifié (email OU tél) pour se connecter.
  const settings = await getSettings()
  const requirePlans = Array.isArray(settings.emailRequireVerifiedLoginPlans) ? settings.emailRequireVerifiedLoginPlans : []
  if (!isVerified(user) && !user.isAdmin && requirePlans.includes(user.plan)) {
    // On (re)génère un code sur le canal disponible et on l'envoie pour débloquer.
    if (user.telephone) {
      const otp = makePhoneOtp()
      await prisma.user.update({ where: { id: user.id }, data: otp })
      sendVerificationSms({ to: user.telephone, code: otp.phoneCode }).catch(() => {})
    } else {
      const verif = makeVerification()
      await prisma.user.update({ where: { id: user.id }, data: verif })
      sendVerificationEmail({ to: user.email, prenom: user.prenom, code: verif.verifyCode, token: verif.verifyToken }).catch(() => {})
    }
    return res.status(403).json({ error: 'Vérifie ton compte pour te connecter (un nouveau code vient d\'être envoyé).', code: 'NOT_VERIFIED' })
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

// ── Mot de passe oublié ───────────────────────────────────────────────────────

function makeResetOtp() {
  return {
    resetCode: String(Math.floor(100000 + Math.random() * 900000)),
    resetExpiry: new Date(Date.now() + 15 * 60 * 1000),
  }
}

// POST /auth/forgot-password — envoie un OTP de réinitialisation par email ou SMS.
router.post('/forgot-password', async (req, res) => {
  const { email, telephone } = req.body ?? {}
  if (!email && !telephone) return res.status(400).json({ error: 'Email ou téléphone requis' })

  const phone = telephone ? normalizePhone(telephone) : null
  const user = email
    ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
    : (phone ? await prisma.user.findUnique({ where: { telephone: phone } }) : null)

  // Réponse générique même si l'utilisateur n'existe pas (anti-enumération).
  if (!user) return res.json({ ok: true, channel: email ? 'email' : 'sms' })

  const otp = makeResetOtp()
  await prisma.user.update({ where: { id: user.id }, data: otp })

  if (email) {
    sendPasswordResetEmail({ to: user.email, prenom: user.prenom, code: otp.resetCode }).catch(() => {})
  } else {
    sendPasswordResetSms({ to: user.telephone, code: otp.resetCode }).catch(() => {})
  }

  res.json({ ok: true, channel: email ? 'email' : 'sms' })
})

// POST /auth/reset-password — vérifie l'OTP et définit le nouveau mot de passe.
router.post('/reset-password', async (req, res) => {
  const { email, telephone, code, newPassword } = req.body ?? {}
  if (!code || !newPassword) return res.status(400).json({ error: 'Code et nouveau mot de passe requis' })
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' })

  const phone = telephone ? normalizePhone(telephone) : null
  const user = email
    ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
    : (phone ? await prisma.user.findUnique({ where: { telephone: phone } }) : null)

  if (!user) return res.status(400).json({ error: 'Code invalide ou expiré' })
  if (!user.resetCode || user.resetCode !== String(code).trim()) return res.status(400).json({ error: 'Code incorrect' })
  if (!user.resetExpiry || user.resetExpiry < new Date()) return res.status(400).json({ error: 'Code expiré — demande un nouveau code' })

  const hashed = await bcrypt.hash(String(newPassword), 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetCode: null, resetExpiry: null },
  })

  res.json({ ok: true })
})

export default router
