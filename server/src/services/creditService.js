// ── SERVICE CRÉDITS DE JEU ────────────────────────────────────────────────────
// Crédits = parties MULTIJOUEURS prépayées, consommées au-delà des 10 gratuites/mois.
// Le solde est dénormalisé sur User.credits ; chaque mouvement est journalisé.
// DORMANT au lancement (Temps 1) : aucun achat actif, solde = 0 partout. Le débit
// n'est déclenché que lorsque le quota mensuel est dépassé ET qu'un solde existe.
import { prisma } from '../utils/prisma.js'

// Solde courant.
export async function getBalance(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } })
  return u?.credits ?? 0
}

// Crédite le compte (achat, bonus, remboursement). Atomique.
export async function credit(userId, montant, raison = 'ACHAT', paiementId = null) {
  if (montant <= 0) return getBalance(userId)
  const [, u] = await prisma.$transaction([
    prisma.creditTransaction.create({ data: { userId, delta: montant, raison, paiementId } }),
    prisma.user.update({ where: { id: userId }, data: { credits: { increment: montant } } }),
  ])
  return u.credits
}

// Débite 1 crédit pour une partie multijoueur. Garde-fou : jamais sous zéro.
export async function debitOne(userId, raison = 'PARTIE') {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } })
  if (!u || u.credits <= 0) return { ok: false, credits: u?.credits ?? 0 }
  const [, updated] = await prisma.$transaction([
    prisma.creditTransaction.create({ data: { userId, delta: -1, raison } }),
    prisma.user.update({ where: { id: userId }, data: { credits: { decrement: 1 } } }),
  ])
  return { ok: true, credits: updated.credits }
}
