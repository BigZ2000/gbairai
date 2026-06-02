// Import en masse : un CSV de questions + un lot de médias (dossier multi-fichiers ou ZIP).
// Les colonnes mediaFile / audioFile / videoFile référencent les médias par nom de fichier.
import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'
import AdmZip from 'adm-zip'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { ingestFile } from './media.js'
import { QuestionSchema } from './questions.js'

const router = Router()
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const MEDIA_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
}
const mimeFor = (name) => MEDIA_EXT[path.extname(name).toLowerCase()] || null

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`),
})
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } })
  .fields([{ name: 'csv', maxCount: 1 }, { name: 'media' }, { name: 'zip', maxCount: 1 }])

// Parseur CSV tolérant (guillemets, virgules et retours-ligne échappés).
function parseCsv(text) {
  const rows = []
  let row = [], cur = '', inQ = false
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => {
      const o = {}
      headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
      return o
    })
}

// POST /import/questions — multipart: csv + (media[] | zip)
router.post('/questions', requireAuth, requireAdmin, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    const csvFile = req.files?.csv?.[0]
    if (!csvFile) return res.status(400).json({ error: 'Fichier CSV requis (champ "csv")' })

    const summary = {
      questionsCreated: 0, mediaIngested: 0, mediaDeduplicated: 0,
      unmatchedMedia: [], errors: [],
    }

    // 1) Rassembler les fichiers médias : champ "media[]" + entrées du ZIP.
    const mediaFiles = [] // { absPath, originalName }
    for (const f of (req.files?.media ?? [])) {
      mediaFiles.push({ absPath: path.join(UPLOAD_DIR, f.filename), originalName: f.originalname })
    }
    const zipFile = req.files?.zip?.[0]
    if (zipFile) {
      try {
        const zip = new AdmZip(path.join(UPLOAD_DIR, zipFile.filename))
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue
          const name = path.basename(entry.entryName)
          if (!mimeFor(name)) continue
          const out = path.join(UPLOAD_DIR, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(name)}`)
          fs.writeFileSync(out, entry.getData())
          mediaFiles.push({ absPath: out, originalName: name })
        }
      } catch (e) {
        summary.errors.push({ scope: 'zip', error: 'ZIP illisible' })
      } finally {
        fs.promises.unlink(path.join(UPLOAD_DIR, zipFile.filename)).catch(() => {})
      }
    }

    // 2) Ingestion des médias → map { nomFichier(min) : url }
    const byName = new Map()
    for (const mf of mediaFiles) {
      const mime = mimeFor(mf.originalName)
      if (!mime) { summary.unmatchedMedia.push(mf.originalName); fs.promises.unlink(mf.absPath).catch(() => {}); continue }
      try {
        const { media, deduplicated } = await ingestFile(mf.absPath, {
          originalName: mf.originalName, mimeType: mime, userId: req.userId,
        })
        byName.set(mf.originalName.toLowerCase(), media)
        deduplicated ? summary.mediaDeduplicated++ : summary.mediaIngested++
      } catch (e) {
        summary.errors.push({ scope: 'media', file: mf.originalName, error: e.message })
      }
    }

    // 3) Cache des catégories (résolution par nom, création si absente).
    const catCache = new Map()
    async function resolveCategorie(nom) {
      if (!nom) return null
      const key = nom.toLowerCase()
      if (catCache.has(key)) return catCache.get(key)
      let cat = await prisma.categorie.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } })
      if (!cat) cat = await prisma.categorie.create({ data: { nom, publique: true } })
      catCache.set(key, cat.id)
      return cat.id
    }

    // 4) Parse CSV + création des questions.
    let rows
    try {
      rows = parseCsv(fs.readFileSync(path.join(UPLOAD_DIR, csvFile.filename), 'utf8'))
    } catch {
      rows = []
      summary.errors.push({ scope: 'csv', error: 'CSV illisible' })
    }
    fs.promises.unlink(path.join(UPLOAD_DIR, csvFile.filename)).catch(() => {})

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      try {
        const choix = [r.choixA, r.choixB, r.choixC, r.choixD].filter(Boolean)
        const ref = (r.mediaFile || r.audioFile || r.videoFile || '')
        // Correspondance sur le nom de base seul : le CSV peut préfixer un dossier
        // (img/…, audio/…, video/…) alors que les fichiers uploadés gardent leur nom simple.
        const mediaName = ref ? path.basename(ref).toLowerCase() : ''
        const matched = mediaName ? byName.get(mediaName) : null
        if (mediaName && !matched && !summary.unmatchedMedia.includes(ref)) {
          summary.unmatchedMedia.push(ref)
        }

        const type = (r.type || 'BUZZER').toUpperCase()
        const data = {
          enonce: r.enonce,
          type,
          reponse: r.reponse,
          explication: r.explication || null,
          difficulte: (r.difficulte || 'MOYEN').toUpperCase(),
          points: Number(r.points) || 100,
          tempsLimite: Number(r.tempsLimite) || 30,
          choix,
          publique: true,
          categorieId: await resolveCategorie(r.categorie),
          mediaId: matched?.id ?? null,
          mediaUrl: type === 'IMAGE' ? (matched?.url ?? r.mediaUrl ?? null) : (r.mediaUrl ?? null),
          audioUrl: type === 'AUDIO' ? (matched?.url ?? r.audioUrl ?? null) : null,
          videoUrl: type === 'VIDEO' ? (matched?.url ?? r.videoUrl ?? null) : null,
          videoDebut: r.videoDebut ? Number(r.videoDebut) : null,
          videoFin: r.videoFin ? Number(r.videoFin) : null,
        }

        const parsed = QuestionSchema.safeParse(data)
        if (!parsed.success) { summary.errors.push({ scope: 'row', index: i + 2, error: parsed.error.flatten() }); continue }

        await prisma.question.create({ data: { ...parsed.data, createdById: req.userId } })
        summary.questionsCreated++
      } catch (e) {
        summary.errors.push({ scope: 'row', index: i + 2, error: e.message })
      }
    }

    res.json(summary)
  })
})

export default router
