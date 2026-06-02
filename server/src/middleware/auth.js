import jwt from 'jsonwebtoken'
import { prisma } from '../utils/prisma.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide' })
  }
}

export async function isAnimateurDePartie(userId, partieId) {
  const partie = await prisma.partie.findUnique({ where: { id: partieId } })
  return partie?.animateurId === userId
}

// Hôte de la partie = animateur OU créateur. En modes automatique / vote
// collectif il n'y a pas d'animateur désigné : seul le créateur gère la partie.
// Repli (parties anciennes sans creatorId) : 1er participant inscrit.
export async function isHostDePartie(userId, partieId) {
  if (!userId) return false
  const partie = await prisma.partie.findUnique({
    where: { id: partieId },
    select: { animateurId: true, creatorId: true },
  })
  if (!partie) return false
  if (partie.animateurId && partie.animateurId === userId) return true
  if (partie.creatorId && partie.creatorId === userId) return true
  if (!partie.animateurId && !partie.creatorId) {
    const first = await prisma.participant.findFirst({
      where: { partieId }, orderBy: { joinedAt: 'asc' }, select: { userId: true },
    })
    return first?.userId === userId
  }
  return false
}

export async function requireAnimateurDePartie(req, res, next) {
  const { partieId } = req.params
  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur de cette partie' })
  next()
}
