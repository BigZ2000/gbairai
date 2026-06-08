// ──────────────────────────────────────────────────────────────────────────────
// Purge des comptes INVITÉS non convertis (isGuest=true) inactifs depuis > N jours.
// Nettoie les dépendances (votes → participants → refreshTokens → paiements) avant
// de supprimer les utilisateurs. Réutilisé par le cron et la route admin.
//   node scripts/cleanupGuests.js [jours]   (défaut 7)
// ──────────────────────────────────────────────────────────────────────────────
import { prisma } from '../src/utils/prisma.js'

export async function cleanupGuests(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  // Inactif = dernière activité (lastSeenAt) OU création antérieure au seuil.
  const guests = await prisma.user.findMany({
    where: {
      isGuest: true,
      OR: [
        { lastSeenAt: { lt: cutoff } },
        { AND: [{ lastSeenAt: null }, { createdAt: { lt: cutoff } }] },
      ],
    },
    select: { id: true },
  })
  const ids = guests.map(g => g.id)
  if (ids.length === 0) return { deleted: 0 }

  const parts = await prisma.participant.findMany({ where: { userId: { in: ids } }, select: { id: true } })
  const partIds = parts.map(p => p.id)

  if (partIds.length) await prisma.vote.deleteMany({ where: { participantId: { in: partIds } } })
  if (partIds.length) await prisma.participant.deleteMany({ where: { id: { in: partIds } } })
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } })
  await prisma.paiement.deleteMany({ where: { userId: { in: ids } } })
  const del = await prisma.user.deleteMany({ where: { id: { in: ids } } })
  return { deleted: del.count }
}

// Exécution directe (cron / one-shot).
if (import.meta.url === `file://${process.argv[1]}`) {
  const days = Number(process.argv[2]) || 7
  cleanupGuests(days)
    .then(r => { console.log(`[cleanup-guests] ${r.deleted} invité(s) > ${days}j supprimé(s)`); process.exit(0) })
    .catch(e => { console.error('[cleanup-guests] échec:', e?.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
