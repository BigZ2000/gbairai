// ── SERVICE DROITS D'ACCÈS AUX PACKS ──────────────────────────────────────────
// Détermine si un utilisateur peut lancer un pack selon son plan, ses achats
// unitaires et le niveau (tier) du pack.
import { prisma } from '../utils/prisma.js'
import { getLimites, TIER_REQUIRED_PLAN, resolvePlan } from '../config/plans.js'

// canAccessPack(user, pack) -> { allowed, reason, code, requiredTier, requiredPlan }
export async function canAccessPack(user, pack) {
  // Admin : accès total.
  if (user?.isAdmin) return { allowed: true }

  const tier = pack.tier ?? 'GRATUIT'

  // Packs gratuits : accessibles à tous.
  if (tier === 'GRATUIT') return { allowed: true }

  // Le plan de l'utilisateur débloque-t-il ce niveau ?
  const limites = getLimites(user.plan)
  if (limites.packTiers.includes(tier)) return { allowed: true }

  // Achat unitaire réussi de ce pack précis ?
  if (pack.prix > 0) {
    const achat = await prisma.paiement.findFirst({
      where: { userId: user.id, packId: pack.id, statut: 'SUCCESS' },
      select: { id: true },
    })
    if (achat) return { allowed: true }
  }

  const requiredPlan = TIER_REQUIRED_PLAN[tier] ?? 'PRO'
  return {
    allowed: false,
    code: 'PACK_LOCKED',
    requiredTier: tier,
    requiredPlan,
    reason: `Ce pack nécessite un abonnement ${resolvePlan(requiredPlan).nom}.`,
  }
}

// Indique, sans requête, si un pack est verrouillé pour un plan donné (affichage
// catalogue). N'effectue pas le contrôle d'achat unitaire (rapide & synchrone).
export function isLockedForPlan(plan, isAdmin, tier) {
  if (isAdmin) return false
  if (!tier || tier === 'GRATUIT') return false
  return !getLimites(plan).packTiers.includes(tier)
}
