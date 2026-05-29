import { prisma } from '../utils/prisma.js'

export async function requireAdmin(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Non authentifié' })
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  next()
}
