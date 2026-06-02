import { Router } from 'express'
import { z } from 'zod'
import path from 'path'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = Router()

// Accepte une URL http(s) absolue OU un chemin relatif servi par l'API (/uploads/…).
const mediaUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith('/'),
    { message: 'URL invalide (http(s):// ou chemin /uploads/…)' },
  )
  .optional()
  .nullable()

export const QuestionSchema = z.object({
  enonce: z.string().min(1).max(2000),
  type: z.enum(['BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO']).default('BUZZER'),
  reponse: z.string().min(1).max(500),
  indice: z.string().max(500).optional().nullable(),
  choix: z.array(z.string().max(200)).max(6).default([]),
  points: z.number().int().min(1).max(10000).default(100),
  tempsLimite: z.number().int().min(5).max(300).default(30),
  mediaUrl,
  videoUrl: mediaUrl,
  videoDebut: z.number().int().min(0).optional().nullable(),
  videoFin: z.number().int().min(0).optional().nullable(),
  audioUrl: mediaUrl,
  mediaId: z.string().optional().nullable(),
  explication: z.string().max(1000).optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  difficulte: z.enum(['FACILE', 'MOYEN', 'DIFFICILE']).default('MOYEN'),
  publique: z.boolean().default(false),
  categorieId: z.string().optional().nullable(),
  rubriqueId: z.string().optional().nullable(),
})

const qInclude = {
  categorie: { select: { id: true, nom: true, emoji: true } },
  rubrique: { select: { id: true, nom: true } },
  media: { select: { id: true, url: true, thumbUrl: true, type: true, mimeType: true, titre: true } },
  createdBy: { select: { prenom: true, username: true } },
}

// GET /questions — list with filters (any authenticated user)
router.get('/', requireAuth, async (req, res) => {
  const { q, type, difficulte, categorieId, rubriqueId, page = '1', limit = '30' } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } })
  const where = {
    ...(user?.isAdmin ? {} : { OR: [{ publique: true }, { createdById: req.userId }] }),
    ...(type && { type }),
    ...(difficulte && { difficulte }),
    ...(categorieId && { categorieId }),
    ...(rubriqueId && { rubriqueId }),
    ...(q && { enonce: { contains: q, mode: 'insensitive' } }),
  }

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: qInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.question.count({ where }),
  ])

  res.json({ questions, total, page: parseInt(page), limit: parseInt(limit) })
})

// POST /questions — admin only
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = QuestionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const question = await prisma.question.create({
    data: { ...parsed.data, createdById: req.userId, publique: true },
    include: qInclude,
  })
  res.status(201).json(question)
})

// GET /questions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const question = await prisma.question.findUnique({ where: { id: req.params.id }, include: qInclude })
  if (!question) return res.status(404).json({ error: 'Question introuvable' })
  if (!question.publique && question.createdById !== req.userId) {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } })
    if (!user?.isAdmin) return res.status(403).json({ error: 'Accès refusé' })
  }
  res.json(question)
})

// PATCH /questions/:id — admin only
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const question = await prisma.question.findUnique({ where: { id: req.params.id } })
  if (!question) return res.status(404).json({ error: 'Question introuvable' })

  const parsed = QuestionSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const updated = await prisma.question.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: qInclude,
  })
  res.json(updated)
})

// DELETE /questions/:id — admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const question = await prisma.question.findUnique({ where: { id: req.params.id } })
  if (!question) return res.status(404).json({ error: 'Question introuvable' })

  await prisma.question.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// POST /questions/upload — admin only
router.post('/upload', requireAuth, requireAdmin, async (req, res) => {
  try {
    const multer = (await import('multer')).default
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
      },
    })
    const upload = multer({
      storage,
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4']
        cb(null, allowed.includes(file.mimetype))
      },
    }).single('file')

    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message })
      if (!req.file) return res.status(400).json({ error: 'Fichier manquant ou type non supporté' })
      res.json({ url: `/uploads/${req.file.filename}` })
    })
  } catch {
    res.status(501).json({ error: 'Upload non configuré' })
  }
})

// POST /questions/import-csv — admin only (bulk import)
router.post('/import-csv', requireAuth, requireAdmin, async (req, res) => {
  const { questions } = req.body
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Tableau de questions requis' })
  }

  const results = { created: 0, errors: [] }

  for (let i = 0; i < questions.length; i++) {
    const parsed = QuestionSchema.safeParse(questions[i])
    if (!parsed.success) {
      results.errors.push({ index: i, error: parsed.error.flatten() })
      continue
    }
    await prisma.question.create({
      data: { ...parsed.data, createdById: req.userId, publique: true },
    })
    results.created++
  }

  res.json(results)
})

export default router
