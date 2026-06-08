// ── ROUTES BILLING / ABONNEMENTS ──────────────────────────────────────────────
// Offres, état des quotas, souscription, achat de pack, historique + webhook.
// Paiement réel non activé (préparation CinetPay) : l'endpoint /confirm permet
// de simuler un règlement pour tester tout le modèle économique sans argent.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { getSettings } from '../config/settings.js'
import { PLANS } from '../config/plans.js'
import { cinetpayConfig } from '../config/cinetpay.js'
import { getQuotaState } from '../services/quotaService.js'
import { getUserOrganisation, activeSeats } from '../services/orgService.js'
import {
  initiatePayment, confirmPayment, listPayments, verifyWebhookSignature,
} from '../services/paymentService.js'

const router = Router()

async function loadUser(req, res, next) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, prenom: true, plan: true, planExpireAt: true, isAdmin: true, emailVerified: true },
  })
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  req.fullUser = user
  next()
}

// Bloque les actions sensibles (paiement) tant que l'email n'est pas vérifié —
// seulement si le réglage admin l'exige.
async function requireVerified(req, res, next) {
  const settings = await getSettings()
  if (settings.emailBlockUnverifiedActions && req.fullUser && !req.fullUser.emailVerified && !req.fullUser.isAdmin) {
    return res.status(403).json({ error: 'Vérifie ton adresse email avant de t\'abonner.', code: 'EMAIL_NOT_VERIFIED' })
  }
  next()
}

// GET /api/billing/plans — offres (pilotées par l'admin) + plan courant.
// Côté UX, le client regroupe en 3 familles : Gratuit / Pro / Organisation.
router.get('/plans', requireAuth, loadUser, async (req, res) => {
  const offres = await prisma.offre.findMany({
    where: { visible: true },
    orderBy: [{ ordre: 'asc' }, { prix: 'asc' }],
  })
  res.json({
    offres: offres.map(o => ({
      id: o.id, code: o.code, nom: o.nom, description: o.description,
      categorie: o.categorie, prix: o.prix, dureeJours: o.dureeJours, sieges: o.sieges,
      couleur: o.couleur, populaire: o.populaire, fonctionnalites: o.fonctionnalites,
    })),
    current: req.fullUser.plan,
    paiementsActifs: cinetpayConfig.enabled,
  })
})

// GET /api/billing/me — état plan + limites + usage + contexte organisation.
router.get('/me', requireAuth, loadUser, async (req, res) => {
  const state = await getQuotaState(req.fullUser)
  const orgCtx = await getUserOrganisation(req.userId)
  if (orgCtx) {
    state.organisation = {
      id: orgCtx.organisation.id,
      nom: orgCtx.organisation.nom,
      type: orgCtx.organisation.type,
      role: orgCtx.role,
      sieges: orgCtx.organisation.sieges,
      siegesUtilises: await activeSeats(orgCtx.organisation.id),
      peutGerer: orgCtx.role === 'RESPONSABLE' || orgCtx.role === 'GESTIONNAIRE',
      expireAt: orgCtx.organisation.expireAt,
    }
  }
  res.json(state)
})

// GET /api/billing/history — historique des paiements.
router.get('/history', requireAuth, async (req, res) => {
  res.json(await listPayments(req.userId))
})

// POST /api/billing/subscribe — souscrire à une offre (initie un paiement).
router.post('/subscribe', requireAuth, loadUser, requireVerified, async (req, res) => {
  const parsed = z.object({ offreId: z.string() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Offre invalide' })

  const offre = await prisma.offre.findUnique({ where: { id: parsed.data.offreId } })
  if (!offre || !offre.visible) return res.status(404).json({ error: 'Offre introuvable' })
  if (offre.prix <= 0) return res.status(400).json({ error: 'Cette offre est gratuite' })

  const result = await initiatePayment({
    user: req.fullUser,
    plan: offre.plan,
    offreId: offre.id,
    montant: offre.prix,
    description: `Abonnement ${offre.nom} (${offre.dureeJours} jours)`,
  })
  res.status(201).json({ reference: result.paiement.reference, montant: offre.prix, checkout: result.checkout })
})

// POST /api/billing/packs/:id/buy — achat unitaire d'un pack payant.
router.post('/packs/:id/buy', requireAuth, loadUser, requireVerified, async (req, res) => {
  const pack = await prisma.pack.findUnique({ where: { id: req.params.id } })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  if ((pack.prix ?? 0) <= 0) return res.status(400).json({ error: 'Ce pack n\'est pas en vente à l\'unité' })

  const result = await initiatePayment({
    user: req.fullUser,
    packId: pack.id,
    montant: pack.prix,
    description: `Achat du pack « ${pack.nom} »`,
  })
  res.status(201).json({ reference: result.paiement.reference, montant: pack.prix, checkout: result.checkout })
})

// POST /api/billing/confirm — SIMULATION de règlement (préparation uniquement).
// Bloqué si CinetPay est réellement activé (le webhook fait foi).
router.post('/confirm', requireAuth, async (req, res) => {
  if (cinetpayConfig.enabled) {
    return res.status(403).json({ error: 'Confirmation manuelle désactivée : CinetPay est actif.' })
  }
  const parsed = z.object({
    reference: z.string(),
    status: z.enum(['SUCCESS', 'FAILED', 'CANCELLED']).default('SUCCESS'),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })

  // Sécurité : on ne confirme qu'un paiement appartenant à l'utilisateur.
  const paiement = await prisma.paiement.findUnique({ where: { reference: parsed.data.reference } })
  if (!paiement || paiement.userId !== req.userId) {
    return res.status(404).json({ error: 'Référence introuvable' })
  }

  const result = await confirmPayment({
    reference: parsed.data.reference,
    status: parsed.data.status,
    operateur: 'SIMULATION',
  })
  res.json(result)
})

// POST /api/billing/webhook — notification CinetPay (public, signé).
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-token'] || req.headers['x-cinetpay-signature']
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Signature invalide' })
  }
  const reference = req.body?.cpm_trans_id || req.body?.reference
  const status = (req.body?.cpm_result === '00' || req.body?.status === 'ACCEPTED') ? 'SUCCESS' : 'FAILED'
  if (!reference) return res.status(400).json({ error: 'Référence manquante' })

  await confirmPayment({
    reference, status,
    transactionId: req.body?.cpm_payid ?? null,
    operateur: req.body?.payment_method ?? null,
  })
  res.json({ ok: true })
})

export default router
