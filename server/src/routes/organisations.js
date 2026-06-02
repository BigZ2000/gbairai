// ── ROUTES ORGANISATIONS ──────────────────────────────────────────────────────
// « Mon Organisation » : membres, sièges, invitations ultra-simples, rôles.
// Pensé pour rester invisible aux utilisateurs standards (aucune org = 404).
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import {
  newToken, activeSeats, canManage, applyPlanToUser, revertUserToFree, getUserOrganisation,
} from '../services/orgService.js'

const router = Router()
router.use(requireAuth)

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// Vérifie le droit de gestion ; répond 403 sinon.
async function ensureManager(req, res, orgId) {
  if (!(await canManage(req.userId, orgId))) {
    res.status(403).json({ error: 'Action réservée au responsable.' })
    return false
  }
  return true
}

// GET /api/organisations/mine — l'organisation de l'utilisateur (ou 404 discret).
router.get('/mine', async (req, res) => {
  const ctx = await getUserOrganisation(req.userId)
  if (!ctx) return res.status(404).json({ error: 'Aucune organisation' })
  const { organisation: org, role } = ctx
  const peutGerer = role === 'RESPONSABLE' || role === 'GESTIONNAIRE'

  const [membres, groupes, invitations, used] = await Promise.all([
    prisma.organisationMembre.findMany({
      where: { organisationId: org.id },
      include: { user: { select: { id: true, prenom: true, nom: true, email: true, username: true } }, groupe: { select: { id: true, nom: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.organisationGroupe.findMany({ where: { organisationId: org.id }, orderBy: { nom: 'asc' } }),
    peutGerer ? prisma.invitation.findMany({ where: { organisationId: org.id, statut: 'PENDING' }, orderBy: { createdAt: 'desc' } }) : [],
    activeSeats(org.id),
  ])

  res.json({
    organisation: {
      id: org.id, nom: org.nom, type: org.type, plan: org.plan,
      sieges: org.sieges, siegesUtilises: used, statut: org.statut, expireAt: org.expireAt,
      lienInvitation: `${CLIENT_URL}/invitation/${org.inviteToken}`,
    },
    role, peutGerer,
    membres: membres.map(m => ({
      id: m.id, userId: m.userId, role: m.role, statut: m.statut,
      prenom: m.user.prenom, nom: m.user.nom, email: m.user.email, username: m.user.username,
      groupe: m.groupe, joinedAt: m.joinedAt,
    })),
    groupes,
    invitations,
  })
})

// PATCH /api/organisations/:id — nom / type (responsable).
router.patch('/:id', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  const parsed = z.object({
    nom: z.string().min(1).max(120).optional(),
    type: z.enum(['ENTREPRISE', 'ECOLE', 'UNIVERSITE', 'ASSOCIATION', 'ONG', 'COLLECTIVITE']).optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })
  const org = await prisma.organisation.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(org)
})

// POST /api/organisations/:id/invitations — invite par email OU lien (role par défaut MEMBRE).
router.post('/:id/invitations', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  const parsed = z.object({
    email: z.string().email().optional(),
    role: z.enum(['MEMBRE', 'GESTIONNAIRE']).default('MEMBRE'),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })

  // Contrôle des sièges.
  const org = await prisma.organisation.findUnique({ where: { id: req.params.id } })
  if ((await activeSeats(org.id)) >= org.sieges) {
    return res.status(400).json({ error: 'Tous les sièges sont occupés.' })
  }

  const token = newToken()
  const invitation = await prisma.invitation.create({
    data: {
      organisationId: org.id, email: parsed.data.email ?? null,
      role: parsed.data.role, token, invitedById: req.userId,
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  })
  res.status(201).json({ ...invitation, lien: `${CLIENT_URL}/invitation/${token}` })
})

// DELETE /api/organisations/:id/invitations/:invId — révoquer.
router.delete('/:id/invitations/:invId', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  await prisma.invitation.updateMany({ where: { id: req.params.invId, organisationId: req.params.id }, data: { statut: 'REVOKED' } })
  res.json({ ok: true })
})

// GET /api/organisations/invitation/:token — aperçu d'une invitation (org + lien permanent).
router.get('/invitation/:token', async (req, res) => {
  const ctx = await resolveToken(req.params.token)
  if (!ctx) return res.status(404).json({ error: 'Invitation invalide ou expirée' })
  res.json({ organisationNom: ctx.org.nom, type: ctx.org.type, places: ctx.org.sieges - (await activeSeats(ctx.org.id)) })
})

// POST /api/organisations/invitation/:token/accept — rejoindre.
router.post('/invitation/:token/accept', async (req, res) => {
  const ctx = await resolveToken(req.params.token)
  if (!ctx) return res.status(404).json({ error: 'Invitation invalide ou expirée' })
  const { org, invitation } = ctx

  // Déjà membre ?
  const existing = await prisma.organisationMembre.findUnique({
    where: { organisationId_userId: { organisationId: org.id, userId: req.userId } },
  })
  if (existing) {
    if (existing.statut === 'SUSPENDU') return res.status(403).json({ error: 'Votre accès est suspendu.' })
    return res.json({ ok: true, deja: true })
  }
  // Sièges disponibles ?
  if ((await activeSeats(org.id)) >= org.sieges) return res.status(400).json({ error: 'Organisation complète (sièges occupés).' })

  await prisma.organisationMembre.create({
    data: { organisationId: org.id, userId: req.userId, role: invitation?.role ?? 'MEMBRE', statut: 'ACTIF' },
  })
  await applyPlanToUser(req.userId, org.plan, org.expireAt)
  if (invitation) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { statut: 'ACCEPTED', acceptedByUserId: req.userId } })
  }
  res.json({ ok: true, organisationNom: org.nom })
})

// PATCH /api/organisations/:id/membres/:membreId — rôle / suspension.
router.patch('/:id/membres/:membreId', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  const parsed = z.object({
    role: z.enum(['MEMBRE', 'GESTIONNAIRE']).optional(),
    statut: z.enum(['ACTIF', 'SUSPENDU']).optional(),
    groupeId: z.string().nullable().optional(),
  }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' })

  const membre = await prisma.organisationMembre.findFirst({ where: { id: req.params.membreId, organisationId: req.params.id } })
  if (!membre) return res.status(404).json({ error: 'Membre introuvable' })
  if (membre.role === 'RESPONSABLE') return res.status(400).json({ error: 'Le responsable ne peut pas être modifié.' })

  const org = await prisma.organisation.findUnique({ where: { id: req.params.id }, select: { plan: true, expireAt: true } })
  const updated = await prisma.organisationMembre.update({ where: { id: membre.id }, data: parsed.data })

  // Synchronise le plan effectif du membre selon son statut.
  if (parsed.data.statut === 'SUSPENDU') await revertUserToFree(membre.userId)
  else if (parsed.data.statut === 'ACTIF') await applyPlanToUser(membre.userId, org.plan, org.expireAt)
  res.json(updated)
})

// DELETE /api/organisations/:id/membres/:membreId — retirer un membre.
router.delete('/:id/membres/:membreId', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  const membre = await prisma.organisationMembre.findFirst({ where: { id: req.params.membreId, organisationId: req.params.id } })
  if (!membre) return res.status(404).json({ error: 'Membre introuvable' })
  if (membre.role === 'RESPONSABLE') return res.status(400).json({ error: 'Le responsable ne peut pas être retiré.' })
  await prisma.organisationMembre.delete({ where: { id: membre.id } })
  await revertUserToFree(membre.userId)
  res.json({ ok: true })
})

// ── Groupes (structure légère, optionnelle) ───────────────
router.post('/:id/groupes', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  const parsed = z.object({ nom: z.string().min(1).max(80) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Nom requis' })
  const g = await prisma.organisationGroupe.create({ data: { organisationId: req.params.id, nom: parsed.data.nom } })
  res.status(201).json(g)
})
router.delete('/:id/groupes/:groupeId', async (req, res) => {
  if (!(await ensureManager(req, res, req.params.id))) return
  await prisma.organisationGroupe.deleteMany({ where: { id: req.params.groupeId, organisationId: req.params.id } })
  res.json({ ok: true })
})

// Résout un token : invitation nominative OU lien permanent d'organisation.
async function resolveToken(token) {
  const invitation = await prisma.invitation.findUnique({ where: { token }, include: { organisation: true } })
  if (invitation && invitation.statut === 'PENDING' && (!invitation.expiresAt || invitation.expiresAt > new Date())) {
    return { org: invitation.organisation, invitation }
  }
  const org = await prisma.organisation.findUnique({ where: { inviteToken: token } })
  if (org && org.statut === 'ACTIVE') return { org, invitation: null }
  return null
}

export default router
