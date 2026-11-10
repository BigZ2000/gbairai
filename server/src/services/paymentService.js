// ── SERVICE PAIEMENT (CINETPAY) ───────────────────────────────────────────────
// Initiation, notification, vérification, historique, activation de l'offre.
//  • CinetPay configuré  → vrai paiement mobile money ; l'offre n'est activée
//    qu'après vérification du statut AUPRÈS DE CINETPAY (jamais sur la seule
//    foi d'une notification reçue).
//  • Sinon, en développement → règlement simulé (démonstration).
//  • Sinon (production sans CinetPay) → paiement fermé, rien n'est activable.
import crypto from 'crypto'
import { prisma } from '../utils/prisma.js'
import { cinetpayConfig, isCinetpayReady, modePaiement } from '../config/cinetpay.js'
import { resolvePlan, PLANS } from '../config/plans.js'
import { createOrganisationFromOffre } from './orgService.js'
import { initialiserPaiement, statutPaiement, CinetpayErreur } from './cinetpayClient.js'

export class PaiementFerme extends Error {}

// Référence marchande unique (≤ 30 caractères, exigence CinetPay).
function newReference(prefix = 'GBR') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

// Initie un paiement (abonnement ou achat de pack).
// Renvoie { paiement, checkout } : checkout.url = page CinetPay en mode réel,
// checkout.simulated = true en démonstration.
export async function initiatePayment({ user, plan = null, offreId = null, packId = null, montant, description }) {
  const mode = modePaiement()
  if (mode === 'ferme') throw new PaiementFerme('Le paiement en ligne n\'est pas encore ouvert.')
  if (mode === 'reel' && (montant < cinetpayConfig.montantMin || montant > cinetpayConfig.montantMax)) {
    throw new PaiementFerme('Montant hors des limites acceptées par CinetPay.')
  }
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

  if (mode === 'reel') {
    try {
      const init = await initialiserPaiement({
        reference, montant, designation: description ?? 'Gbairai',
        client: { email: user.email, prenom: user.prenom, nom: user.nom },
      })
      const maj = await prisma.paiement.update({
        where: { id: paiement.id },
        data: { notifyToken: init.notifyToken, transactionId: init.transactionId, paymentUrl: init.paymentUrl },
      })
      return { paiement: maj, checkout: { url: init.paymentUrl, reference } }
    } catch (e) {
      await prisma.paiement.update({ where: { id: paiement.id }, data: { statut: 'FAILED' } })
      if (plan) await prisma.subscription.updateMany({ where: { reference }, data: { statut: 'CANCELLED' } })
      throw e instanceof CinetpayErreur ? e : new CinetpayErreur('Paiement impossible pour le moment')
    }
  }

  return { paiement, checkout: { url: null, reference, simulated: true } }
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

// Comparaison à temps constant du jeton de notification.
function memeJeton(attendu, recu) {
  if (typeof attendu !== 'string' || typeof recu !== 'string' || attendu.length !== recu.length) return false
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(recu))
}

/**
 * Traite une notification CinetPay ({ notify_token, transaction_id,
 * merchant_transaction_id }). Le jeton doit être celui reçu à l'initiation,
 * puis le statut est redemandé à CinetPay : seul ce statut fait foi.
 * @returns {{ http: number, corps: object }}
 */
export async function traiterNotification(body) {
  if (!isCinetpayReady()) return { http: 403, corps: { error: 'Paiement réel non activé' } }
  const reference = body?.merchant_transaction_id
  const transactionId = body?.transaction_id
  if (!reference || !transactionId || !body?.notify_token) return { http: 400, corps: { error: 'Notification incomplète' } }

  const paiement = await prisma.paiement.findUnique({ where: { reference: String(reference) } })
  if (!paiement || !memeJeton(paiement.notifyToken, String(body.notify_token))) {
    return { http: 401, corps: { error: 'Notification non reconnue' } }
  }
  if (paiement.statut === 'SUCCESS') return { http: 200, corps: { ok: true, deja: true } } // anti-rejeu

  const st = await statutPaiement(String(transactionId))
  if (st.reference && st.reference !== paiement.reference) return { http: 401, corps: { error: 'Transaction étrangère' } }
  await appliquerStatut(paiement, st, transactionId)
  return { http: 200, corps: { ok: true } }
}

// Applique un statut CinetPay final à un paiement (les statuts en cours sont ignorés).
async function appliquerStatut(paiement, st, transactionId) {
  if (st.statut === 'SUCCESS') {
    return confirmPayment({ reference: paiement.reference, status: 'SUCCESS', transactionId, operateur: 'CINETPAY' })
  }
  if (['FAILED', 'EXPIRED', 'INSUFFICIENT_BALANCE', 'USER_IS_BLOCKED'].includes(st.statut)) {
    return confirmPayment({ reference: paiement.reference, status: 'FAILED', transactionId, operateur: 'CINETPAY' })
  }
  return null
}

/**
 * Statut d'un paiement de l'utilisateur, pour la page de retour. En mode réel,
 * un paiement encore en attente est re-vérifié auprès de CinetPay (au cas où
 * la notification ne serait pas arrivée).
 */
export async function suivrePaiement(userId, reference) {
  let paiement = await prisma.paiement.findUnique({ where: { reference } })
  if (!paiement || paiement.userId !== userId) return null
  if (paiement.statut === 'PENDING' && isCinetpayReady()) {
    try {
      const st = await statutPaiement(paiement.transactionId || paiement.reference)
      if (!st.reference || st.reference === paiement.reference) await appliquerStatut(paiement, st, st.transactionId ?? paiement.transactionId)
      paiement = await prisma.paiement.findUnique({ where: { reference } })
    } catch { /* CinetPay injoignable : on renvoie l'état connu */ }
  }
  return paiement
}

// Historique des paiements d'un utilisateur.
export async function listPayments(userId) {
  return prisma.paiement.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}
