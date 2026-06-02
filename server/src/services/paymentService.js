// ── SERVICE PAIEMENT (PRÉPARATION CINETPAY) ───────────────────────────────────
// Toute l'architecture est en place : initiation, callback, webhook, historique,
// activation d'abonnement. La facturation réelle reste DÉSACTIVÉE tant que
// CinetPay n'est pas activé (cinetpayConfig.enabled). En mode préparation, on
// simule un paiement « PENDING » et l'activation se fait via le webhook simulé.
import crypto from 'crypto'
import { prisma } from '../utils/prisma.js'
import { cinetpayConfig, isCinetpayReady } from '../config/cinetpay.js'
import { resolvePlan, PLANS } from '../config/plans.js'
import { createOrganisationFromOffre } from './orgService.js'

// Génère une référence marchande unique.
function newReference(prefix = 'GBR') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

// Initie un paiement (abonnement ou achat de pack).
// Renvoie { paiement, checkout } — checkout.url = URL CinetPay si activé,
// sinon checkout.simulated = true (à confirmer via /billing/webhook simulé).
export async function initiatePayment({ user, plan = null, offreId = null, packId = null, montant, description }) {
  const reference = newReference()

  const paiement = await prisma.paiement.create({
    data: {
      userId: user.id,
      reference,
      montant,
      devise: cinetpayConfig.devise,
      statut: 'PENDING',
      plan: plan ?? null,
      offreId: offreId ?? null,
      packId: packId ?? null,
      description: description ?? null,
    },
  })

  // Création d'un abonnement en attente si c'est un achat de plan.
  if (plan) {
    await prisma.subscription.create({
      data: { userId: user.id, plan, offreId: offreId ?? null, statut: 'PENDING', montant, reference },
    })
  }

  if (isCinetpayReady()) {
    // ── Branche réelle (désactivée par défaut) ────────────────────────────────
    // À l'activation : appeler cinetpayConfig.apiUrl avec apiKey/siteId, montant,
    // transaction_id=reference, notify_url, return_url, channels, customer_*…
    // const resp = await fetch(cinetpayConfig.apiUrl, { ... })
    // return { paiement, checkout: { url: resp.data.payment_url, reference } }
    return {
      paiement,
      checkout: { url: null, reference, ready: true, note: 'Branche CinetPay réelle à appeler ici.' },
    }
  }

  // ── Mode préparation : pas d'appel réseau, paiement simulable ───────────────
  return {
    paiement,
    checkout: { url: null, reference, simulated: true },
  }
}

// Active l'abonnement / l'achat après confirmation du paiement.
async function fulfill(paiement) {
  if (paiement.plan) {
    // Durée : celle de l'offre si connue, sinon 30 jours.
    const offre = paiement.offreId
      ? await prisma.offre.findUnique({ where: { id: paiement.offreId } })
      : null
    const dureeJours = offre?.dureeJours || 30
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + dureeJours * 24 * 3600 * 1000)

    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { reference: paiement.reference },
        data: { statut: 'ACTIVE', startedAt, expiresAt },
      }),
      prisma.subscription.updateMany({
        where: { userId: paiement.userId, statut: 'ACTIVE', reference: { not: paiement.reference } },
        data: { statut: 'EXPIRED' },
      }),
      prisma.user.update({
        where: { id: paiement.userId },
        data: { plan: paiement.plan, planStartedAt: startedAt, planExpireAt: expiresAt },
      }),
    ])

    // Offre Organisation → crée (ou met à niveau) l'organisation du payeur.
    if (offre?.categorie === 'ORGANISATION') {
      const user = await prisma.user.findUnique({ where: { id: paiement.userId }, select: { id: true, prenom: true } })
      await createOrganisationFromOffre({ user, offre, expireAt: expiresAt })
    }
  }
  // Achat unitaire de pack : le statut SUCCESS suffit (accessService le vérifie).
}

// Confirme un paiement (appelé par le webhook réel OU la simulation).
export async function confirmPayment({ reference, status = 'SUCCESS', transactionId = null, operateur = null }) {
  const paiement = await prisma.paiement.findUnique({ where: { reference } })
  if (!paiement) return { ok: false, error: 'Référence inconnue' }
  if (paiement.statut === 'SUCCESS') return { ok: true, paiement, already: true }

  const statut = status === 'SUCCESS' ? 'SUCCESS' : status === 'CANCELLED' ? 'CANCELLED' : 'FAILED'
  const updated = await prisma.paiement.update({
    where: { reference },
    data: { statut, transactionId, operateur },
  })

  if (statut === 'SUCCESS') {
    await fulfill(updated)
  } else if (paiement.plan) {
    await prisma.subscription.updateMany({ where: { reference }, data: { statut: 'CANCELLED' } })
  }

  return { ok: true, paiement: updated }
}

// Vérifie la signature d'un webhook CinetPay (HMAC). En mode préparation, accepte.
export function verifyWebhookSignature(payload, signature) {
  if (!isCinetpayReady() || !cinetpayConfig.secretKey) return true // préparation : pas de blocage
  const computed = crypto
    .createHmac('sha256', cinetpayConfig.secretKey)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex')
  return computed === signature
}

// Historique des paiements d'un utilisateur.
export async function listPayments(userId) {
  return prisma.paiement.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}
