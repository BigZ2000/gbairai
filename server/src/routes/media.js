import { Router } from 'express'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { processUpload } from '../utils/mediaProcessing.js'

const router = Router()

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const MIME_TO_TYPE = (mime) => {
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.startsWith('video/')) return 'VIDEO'
  return null
}

const ALLOWED = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 Mo (vidéos)
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
}).single('file')

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

const mediaInclude = { _count: { select: { questions: true } } }

/**
 * Intègre un fichier déjà présent sur disque à la médiathèque :
 * hash → déduplication → traitement (miniature/compression/métadonnées) → enregistrement.
 * Réutilisé par l'upload unitaire et par l'import en masse.
 * @returns {{ media, deduplicated }}
 */
export async function ingestFile(absPath, { originalName, mimeType, userId, titre = null }) {
  const type = MIME_TO_TYPE(mimeType)
  if (!type) {
    fs.promises.unlink(absPath).catch(() => {})
    throw new Error(`Type non supporté : ${mimeType}`)
  }

  const sha256 = await sha256OfFile(absPath)
  const existing = await prisma.media.findUnique({ where: { sha256 }, include: mediaInclude })
  if (existing) {
    fs.promises.unlink(absPath).catch(() => {})
    return { media: existing, deduplicated: true }
  }

  const proc = await processUpload(absPath, type) // peut recompresser → url/size mis à jour

  const media = await prisma.media.create({
    data: {
      type,
      url: proc.url,
      thumbUrl: proc.thumbUrl,
      filename: originalName,
      mimeType,
      size: proc.size ?? 0,
      sha256,
      width: proc.width,
      height: proc.height,
      duration: proc.duration,
      titre,
      createdById: userId,
    },
    include: mediaInclude,
  })
  return { media, deduplicated: false }
}

// POST /media/upload — upload + déduplication + traitement (admin)
router.post('/upload', requireAuth, requireAdmin, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant ou type non supporté' })

    const filePath = path.join(UPLOAD_DIR, req.file.filename)
    try {
      const out = await ingestFile(filePath, {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        userId: req.userId,
        titre: req.body?.titre || null,
      })
      res.status(out.deduplicated ? 200 : 201).json(out)
    } catch (e) {
      fs.promises.unlink(filePath).catch(() => {})
      res.status(500).json({ error: e.message || 'Échec de l\'enregistrement du média' })
    }
  })
})

// GET /media — médiathèque : recherche / filtre / pagination (admin)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { q, type, page = '1', limit = '40' } = req.query
  const take = Math.min(parseInt(limit) || 40, 100)
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take

  const where = {
    ...(type && ['IMAGE', 'AUDIO', 'VIDEO'].includes(type) ? { type } : {}),
    ...(q
      ? {
          OR: [
            { titre: { contains: q, mode: 'insensitive' } },
            { filename: { contains: q, mode: 'insensitive' } },
            { tags: { has: q } },
          ],
        }
      : {}),
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({ where, include: mediaInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.media.count({ where }),
  ])
  res.json({ media, total, page: parseInt(page) || 1, limit: take })
})

// PATCH /media/:id — éditer titre / tags (admin)
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const Schema = z.object({
    titre: z.string().max(200).nullable().optional(),
    tags: z.array(z.string().max(50)).optional(),
  })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const existing = await prisma.media.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Média introuvable' })

  const media = await prisma.media.update({ where: { id: req.params.id }, data: parsed.data, include: mediaInclude })
  res.json(media)
})

// DELETE /media/:id — supprimer (admin). Les questions liées voient leur mediaId mis à null.
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: req.params.id } })
  if (!media) return res.status(404).json({ error: 'Média introuvable' })

  await prisma.media.delete({ where: { id: req.params.id } })

  // Supprime le fichier + la miniature du disque (best-effort).
  for (const u of [media.url, media.thumbUrl]) {
    if (u?.startsWith('/uploads/')) {
      fs.promises.unlink(path.join(process.cwd(), u.replace(/^\//, ''))).catch(() => {})
    }
  }
  res.json({ ok: true })
})

export default router
