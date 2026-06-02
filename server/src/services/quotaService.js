// ── SERVICE QUOTAS (FREEMIUM) ─────────────────────────────────────────────────
// Calcule l'usage courant d'un utilisateur et vérifie ses quotas avant action.
import { prisma } from '../utils/prisma.js'
import { getLimites, resolvePlan, INF } from '../config/plans.js'

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Usage du mois en cours pour un utilisateur.
export async function getUsage(userId) {
  const since = startOfMonth()
  const partiesCeMois = await prisma.partie.count({
    where: {
      createdAt: { gte: since },
      OR: [{ creatorId: userId }, { animateurId: userId }],
    },
  })
  return { partiesCeMois }
}

// Construit un état complet plan + limites + usage (pour le Dashboard).
export async function getQuotaState(user) {
  const offre = resolvePlan(user.plan)
  const limites = offre.limites
  const usage = await getUsage(user.id)
  const isAdmin = !!user.isAdmin

  return {
    plan: offre.id,
    planNom: offre.nom,
    expireAt: user.planExpireAt ?? null,
    limites: {
      partiesParMois: limites.partiesParMois === INF ? null : limites.partiesParMois,
      joueursMax: limites.joueursMax === INF ? null : limites.joueursMax,
      buzzersVirtuels: limites.buzzersVirtuels === INF ? null : limites.buzzersVirtuels,
      exports: limites.exports,
      statsAvancees: limites.statsAvancees,
      branding: limites.branding,
      packTiers: limites.packTiers,
    },
    usage: {
      partiesCeMois: usage.partiesCeMois,
      partiesRestantes: limites.partiesParMois === INF || isAdmin
        ? null
        : Math.max(0, limites.partiesParMois - usage.partiesCeMois),
    },
  }
}

// Vérifie si l'utilisateur peut lancer une nouvelle partie.
// Renvoie { allowed, reason, code, limite, usage }.
export async function canCreatePartie(user) {
  if (user.isAdmin) return { allowed: true }
  const limites = getLimites(user.plan)
  if (limites.partiesParMois === INF) return { allowed: true }

  const { partiesCeMois } = await getUsage(user.id)
  if (partiesCeMois >= limites.partiesParMois) {
    return {
      allowed: false,
      code: 'QUOTA_PARTIES',
      reason: `Vous avez atteint votre limite mensuelle (${limites.partiesParMois} parties).`,
      limite: limites.partiesParMois,
      usage: partiesCeMois,
    }
  }
  return { allowed: true, usage: partiesCeMois, limite: limites.partiesParMois }
}

// Vérifie une capacité booléenne (exports, statsAvancees, branding…).
export function hasFeature(user, feature) {
  if (user?.isAdmin) return true
  return !!getLimites(user.plan)[feature]
}

// Plafond de joueurs autorisé pour le plan de l'utilisateur (null = illimité).
export function joueursMax(user) {
  if (user?.isAdmin) return null
  const v = getLimites(user.plan).joueursMax
  return v === INF ? null : v
}
