// ── SERVICE QUOTAS (FREEMIUM) ─────────────────────────────────────────────────
// Calcule l'usage courant d'un utilisateur et vérifie ses quotas avant action.
import { prisma } from '../utils/prisma.js'
import { getLimites, resolvePlan, INF } from '../config/plans.js'

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Usage du mois en cours pour un utilisateur. SEULES les parties MULTIJOUEURS
// (solo=false) sont décomptées ; les parties solo sont gratuites et illimitées.
export async function getUsage(userId) {
  const since = startOfMonth()
  const partiesCeMois = await prisma.partie.count({
    where: {
      createdAt: { gte: since },
      solo: false,
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
    // Crédits de jeu (multijoueur). Dormant au lancement (0 partout).
    credits: user.credits ?? 0,
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
      // « parties à plusieurs » consommées ce mois (le solo n'est jamais compté).
      partiesCeMois: usage.partiesCeMois,
      partiesRestantes: limites.partiesParMois === INF || isAdmin
        ? null
        : Math.max(0, limites.partiesParMois - usage.partiesCeMois),
    },
  }
}

// Un pack acheté (UserPack) ou financé par une marque (sponsorId) est jouable de
// façon ILLIMITÉE → exempté du quota mensuel. Dormant au lancement (aucun UserPack).
async function packEstIllimite(userId, pack) {
  if (!pack) return false
  if (pack.sponsorId) return true
  const owned = await prisma.userPack.findUnique({
    where: { userId_packId: { userId, packId: pack.id } },
    select: { id: true },
  }).catch(() => null)
  return !!owned
}

// Vérifie si l'utilisateur peut lancer une partie.
// options : { solo: bool, pack: Pack|null }
// Renvoie { allowed, reason, code, limite, usage, useCredit? }.
//  - solo                → toujours autorisé (gratuit, illimité, non décompté)
//  - pack illimité        → autorisé (acheté ou sponsorisé)
//  - sous le plafond      → autorisé (sera décompté)
//  - au-dessus + crédits  → autorisé via crédit (useCredit=true → débit après création)
//  - au-dessus sans crédit→ bloqué (QUOTA_PARTIES)
export async function canCreatePartie(user, { solo = false, pack = null } = {}) {
  if (user.isAdmin) return { allowed: true }
  if (solo) return { allowed: true, solo: true }

  if (await packEstIllimite(user.id, pack)) return { allowed: true, illimite: true }

  const limites = getLimites(user.plan)
  if (limites.partiesParMois === INF) return { allowed: true }

  const { partiesCeMois } = await getUsage(user.id)
  if (partiesCeMois < limites.partiesParMois) {
    return { allowed: true, usage: partiesCeMois, limite: limites.partiesParMois }
  }

  // Plafond atteint : on bascule sur les crédits de jeu si disponibles.
  if ((user.credits ?? 0) > 0) {
    return { allowed: true, useCredit: true, usage: partiesCeMois, limite: limites.partiesParMois }
  }

  return {
    allowed: false,
    code: 'QUOTA_PARTIES',
    reason: `Tu as utilisé tes ${limites.partiesParMois} parties à plusieurs ce mois-ci. Le solo reste illimité.`,
    limite: limites.partiesParMois,
    usage: partiesCeMois,
  }
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
