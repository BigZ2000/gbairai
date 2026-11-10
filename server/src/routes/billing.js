// ── ROUTES BILLING / ABONNEMENTS ──────────────────────────────────────────────
// Offres, état des quotas, souscription, achat de pack, historique + webhook.
// Paiement réel par CinetPay quand il est configuré. Sinon, en développement
// seulement, /confirm simule un règlement (démonstration sans argent).
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { getSettings } from '../config/settings.js'
import { PLANS, effectivePlan } from '../config/plans.js'
import { modePaiement, simulationAutorisee } from '../config/cinetpay.js'
import { CinetpayErreur } from '../services/cinetpayClient.js'
import { getQuotaState } from '../services/quotaService.js'
import { getUserOrganisation, activeSeats } from '../services/orgService.js'
import {
  initiatePayment, confirmPayment, listPayments, traiterNotification, suivrePaiement, PaiementFerme,
} from '../services/paymentService.js'

// Initie un paiement et répond ; traduit les erreurs en messages lisibles.
async function lancerPaiement(res, params, montant) {
  try {
    const result = await initiatePayment(params)
    res.status(201).json({ reference: result.paiement.reference, montant, checkout: result.checkout })
  } catch (e) {
    if (e instanceof PaiementFerme) return res.status(503).json({ error: e.message, code: 'PAIEMENT_FERME' })
    if (e instanceof CinetpayErreur) return res.status(502).json({ error: 'CinetPay n\'a pas pu ouvrir le paiement. Réessaie dans un instant.', code: 'PAIEMENT_INDISPONIBLE' })
    throw e
  }
}

const router = Router()

async function loadUser(req, res, next) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, prenom: true, nom: true, plan: true, planExpireAt: true, isAdmin: true, emailVerified: true, phoneVerified: true },
  })
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  req.fullUser = user
  next()
}

// Bloque les actions sensibles (paiement) tant que l'email n'est pas vérifié —
// seulement si le réglage admin l'exige.
async function requireVerified(req, res, next) {
  const settings = await getSettings()
  const u = req.fullUser
  const verified = u && (u.emailVerified || u.phoneVerified)
  if (settings.emailBlockUnverifiedActions && u && !verified && !u.isAdmin) {
    return res.status(403).json({ error: 'Vérifie ton email ou ton téléphone avant de t\'abonner.', code: 'NOT_VERIFIED' })
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
    current: effectivePlan(req.fullUser),
    paiementsActifs: modePaiement() === 'reel',
    modePaiement: modePaiement(),
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

  await lancerPaiement(res, {
    user: req.fullUser,
    plan: offre.plan,
    offreId: offre.id,
    montant: offre.prix,
    description: `Pass ${offre.nom} (${offre.dureeJours} jours)`,
  }, offre.prix)
})

// POST /api/billing/packs/:id/buy — achat unitaire d'un pack payant.
router.post('/packs/:id/buy', requireAuth, loadUser, requireVerified, async (req, res) => {
  const pack = await prisma.pack.findUnique({ where: { id: req.params.id } })
  if (!pack) return res.status(404).json({ error: 'Pack introuvable' })
  if ((pack.prix ?? 0) <= 0) return res.status(400).json({ error: 'Ce pack n\'est pas en vente à l\'unité' })

  await lancerPaiement(res, {
    user: req.fullUser,
    packId: pack.id,
    montant: pack.prix,
    description: `Achat du pack « ${pack.nom} »`,
  }, pack.prix)
})

// GET /api/billing/paiements/:reference — suivi d'un paiement (page de retour).
router.get('/paiements/:reference', requireAuth, async (req, res) => {
  const p = await suivrePaiement(req.userId, req.params.reference)
  if (!p) return res.status(404).json({ error: 'Paiement introuvable' })
  res.json({ reference: p.reference, statut: p.statut, montant: p.montant, description: p.description, plan: p.plan, paymentUrl: p.statut === 'PENDING' ? p.paymentUrl : null })
})

// POST /api/billing/confirm — SIMULATION de règlement (démonstration).
// Refusée en production et dès que CinetPay est actif (le statut CinetPay fait foi).
router.post('/confirm', requireAuth, async (req, res) => {
  if (!simulationAutorisee()) {
    return res.status(403).json({ error: 'Le règlement simulé n\'est pas disponible.', code: 'SIMULATION_FERMEE' })
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

// POST /api/billing/webhook — notification CinetPay (publique). Le jeton de
// notification est vérifié, puis le statut est redemandé à CinetPay.
router.post('/webhook', async (req, res) => {
  try {
    const { http, corps } = await traiterNotification(req.body)
    res.status(http).json(corps)
  } catch {
    // CinetPay renverra la notification ; le suivi côté client re-vérifie aussi.
    res.status(502).json({ error: 'Vérification impossible pour le moment' })
  }
})

export default router
