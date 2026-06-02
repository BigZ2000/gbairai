// ── SERVICE ORGANISATIONS ─────────────────────────────────────────────────────
// Une seule abstraction (école / entreprise / association…) gérée par sièges.
import crypto from 'crypto'
import { prisma } from '../utils/prisma.js'

export function newToken(n = 16) {
  return crypto.randomBytes(n).toString('hex')
}

// Nombre de membres actifs (= sièges consommés).
export async function activeSeats(organisationId) {
  return prisma.organisationMembre.count({ where: { organisationId, statut: 'ACTIF' } })
}

// Applique (ou retire) le plan d'une organisation à un utilisateur.
export async function applyPlanToUser(userId, plan, expireAt) {
  await prisma.user.update({
    where: { id: userId },
    data: { plan, planStartedAt: new Date(), planExpireAt: expireAt ?? null },
  })
}
export async function revertUserToFree(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { plan: 'FREE', planExpireAt: null },
  })
}

// Crée une organisation à partir d'une offre achetée (le payeur devient responsable).
export async function createOrganisationFromOffre({ user, offre, expireAt }) {
  // Évite les doublons : si l'utilisateur possède déjà une org, on la met à niveau.
  const existing = await prisma.organisation.findFirst({ where: { ownerId: user.id } })
  if (existing) {
    return prisma.organisation.update({
      where: { id: existing.id },
      data: { offreId: offre.id, plan: offre.plan, sieges: offre.sieges, statut: 'ACTIVE', expireAt },
    })
  }
  const org = await prisma.organisation.create({
    data: {
      nom: user.prenom ? `Organisation de ${user.prenom}` : 'Mon organisation',
      type: 'ENTREPRISE',
      ownerId: user.id,
      offreId: offre.id,
      plan: offre.plan,
      sieges: offre.sieges,
      expireAt,
      inviteToken: newToken(),
      membres: {
        create: { userId: user.id, role: 'RESPONSABLE', statut: 'ACTIF' },
      },
    },
  })
  return org
}

// Organisation de l'utilisateur courant (en tant que membre), avec son rôle.
export async function getUserOrganisation(userId) {
  const membre = await prisma.organisationMembre.findFirst({
    where: { userId, statut: { in: ['ACTIF', 'SUSPENDU'] } },
    include: { organisation: true },
    orderBy: { joinedAt: 'asc' },
  })
  if (!membre) return null
  return { organisation: membre.organisation, role: membre.role, statut: membre.statut }
}

// Vérifie qu'un utilisateur peut gérer une organisation (responsable/gestionnaire).
export async function canManage(userId, organisationId) {
  const m = await prisma.organisationMembre.findUnique({
    where: { organisationId_userId: { organisationId, userId } },
    select: { role: true, statut: true },
  })
  return !!m && m.statut === 'ACTIF' && (m.role === 'RESPONSABLE' || m.role === 'GESTIONNAIRE')
}
