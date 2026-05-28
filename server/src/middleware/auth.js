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

export async function requireAnimateurDePartie(req, res, next) {
  const { partieId } = req.params
  const ok = await isAnimateurDePartie(req.userId, partieId)
  if (!ok) return res.status(403).json({ error: 'Réservé à l\'animateur de cette partie' })
  next()
}
