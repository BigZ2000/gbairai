// ── SERVICE NOTATION DES PACKS ────────────────────────────────────────────────
import { prisma } from '../utils/prisma.js'

// Recalcule et persiste la moyenne + le nombre d'avis d'un pack.
export async function recomputePackRating(packId) {
  const agg = await prisma.packRating.aggregate({
    where: { packId },
    _avg: { note: true },
    _count: { _all: true },
  })
  const nbAvis = agg._count._all
  const noteMoyenne = nbAvis ? Math.round((agg._avg.note ?? 0) * 10) / 10 : null
  await prisma.pack.update({ where: { id: packId }, data: { noteMoyenne, nbAvis } })
  return { noteMoyenne, nbAvis }
}
