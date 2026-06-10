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

// ──────────────────────────────────────────────────────────────────────────────
// POST /import/pack — multipart: zip (manifest.json + media/…)
// Import RICHE : questions à choix-images, métadonnées (subjectKey, tags) et,
// optionnellement, (ré)création du pack. Idéal pour les packs visuels (drapeaux,
// logos, monuments…). Voir docs/AUDIT_DRAPEAUX.md §7 pour le format du manifest.
// ──────────────────────────────────────────────────────────────────────────────
const FORMAT_TO_TYPE = { OUVERT: 'BUZZER', BUZZER: 'BUZZER', QCM: 'QCM', VRAI_FAUX: 'VRAI_FAUX' }

router.post('/pack', requireAuth, requireAdmin, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    const zipFile = req.files?.zip?.[0]
    if (!zipFile) return res.status(400).json({ error: 'Fichier ZIP requis (champ "zip") contenant manifest.json + media/' })

    const summary = { pack: null, questionsCreated: 0, questionsSkipped: 0, mediaIngested: 0, mediaDeduplicated: 0, errors: [] }
    const zipPath = path.join(UPLOAD_DIR, zipFile.filename)

    let manifest = null
    const byName = new Map() // basename(min) → media

    try {
      const zip = new AdmZip(zipPath)
      // 1) manifest.json
      const manEntry = zip.getEntries().find(e => !e.isDirectory && path.basename(e.entryName).toLowerCase() === 'manifest.json')
      if (!manEntry) { fs.promises.unlink(zipPath).catch(() => {}); return res.status(400).json({ error: 'manifest.json introuvable dans le ZIP' }) }
      manifest = JSON.parse(manEntry.getData().toString('utf8'))

      // 2) Ingestion des médias du ZIP
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue
        const name = path.basename(entry.entryName)
        const mime = mimeFor(name)
        if (!mime) continue // ignore manifest.json & co.
        const out = path.join(UPLOAD_DIR, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(name)}`)
        fs.writeFileSync(out, entry.getData())
        try {
          const { media, deduplicated } = await ingestFile(out, { originalName: name, mimeType: mime, userId: req.userId })
          byName.set(name.toLowerCase(), media)
          deduplicated ? summary.mediaDeduplicated++ : summary.mediaIngested++
        } catch (e) { summary.errors.push({ scope: 'media', file: name, error: e.message }) }
      }
    } catch (e) {
      fs.promises.unlink(zipPath).catch(() => {})
      return res.status(400).json({ error: 'ZIP/manifest illisible : ' + e.message })
    }
    fs.promises.unlink(zipPath).catch(() => {})

    const urlOf = (file) => file ? (byName.get(path.basename(file).toLowerCase())?.url ?? null) : null

    // Résolution de catégories (création si absente).
    const catCache = new Map()
    const resolveCategorie = async (nom) => {
      if (!nom) return null
      const key = nom.toLowerCase()
      if (catCache.has(key)) return catCache.get(key)
      let c = await prisma.categorie.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } })
      if (!c) c = await prisma.categorie.create({ data: { nom, publique: true } })
      catCache.set(key, c.id); return c.id
    }

    // 3) Pack (optionnel) — upsert par slug.
    if (manifest.pack?.slug) {
      const p = manifest.pack
      try {
        const data = {
          slug: p.slug, nom: p.nom ?? p.slug, description: p.description ?? '',
          emoji: p.emoji ?? null, couleur: p.couleur ?? '#6366F1',
          categorie: p.categorie ?? (p.categories?.[0] ?? null), categories: p.categories ?? [],
          tags: p.tags ?? [], filtreTags: p.filtreTags ?? [],
          difficulte: p.difficulte ?? 'MIXTE', typesAutorises: p.typesAutorises ?? [],
          modeRecommande: p.modeRecommande ?? 'auto', contentMode: 'DYNAMIQUE',
          modeDistanciel: !!p.modeDistanciel,
          nbManches: p.nbManches ?? 1, nbQuestions: p.nbQuestions ?? 10,
          tempsParQuestion: p.tempsParQuestion ?? 25, pointsParQuestion: p.pointsParQuestion ?? 100,
          tier: p.tier ?? 'GRATUIT', statut: 'ACTIF',
        }
        await prisma.pack.upsert({ where: { slug: p.slug }, update: data, create: data })
        summary.pack = p.slug
      } catch (e) { summary.errors.push({ scope: 'pack', error: e.message }) }
    }

    // 4) Questions
    for (let i = 0; i < (manifest.questions ?? []).length; i++) {
      const q = manifest.questions[i]
      try {
        const type = FORMAT_TO_TYPE[(q.format ?? '').toUpperCase()] ?? (Array.isArray(q.choices) && q.choices.length ? 'QCM' : 'BUZZER')
        // Choix riches : résout les fichiers image en URLs ingérées.
        const choices = Array.isArray(q.choices) && q.choices.length
          ? q.choices.map(c => ({ text: c.text ?? null, mediaUrl: c.mediaFile ? urlOf(c.mediaFile) : (c.mediaUrl ?? null), correct: !!c.correct }))
          : null
        const kind = (q.media?.kind ?? '').toUpperCase()
        const mUrl = q.media?.file ? urlOf(q.media.file) : null
        const reponse = q.reponse ?? choices?.find(c => c.correct)?.text ?? ''
        const subjectKey = q.meta?.subjectKey ?? null
        const enonce = q.enonce ?? ''

        // Idempotence : même sujet + même énoncé déjà présent → on saute.
        if (enonce && await prisma.question.findFirst({ where: { enonce, subjectKey } })) { summary.questionsSkipped++; continue }

        await prisma.question.create({
          data: {
            enonce, type, reponse,
            choices: choices ?? undefined,
            choix: [],
            explication: q.explication ?? null,
            difficulte: (q.difficulte ?? 'MOYEN').toUpperCase(),
            points: Number(q.points) || 100, tempsLimite: Number(q.tempsLimite) || 25,
            publique: true,
            categorieId: await resolveCategorie(q.meta?.categorie ?? manifest.pack?.categorie ?? manifest.pack?.categories?.[0]),
            subjectKey,
            tags: Array.isArray(q.meta?.tags) ? q.meta.tags : [],
            mediaUrl: kind === 'IMAGE' ? mUrl : null,
            audioUrl: kind === 'AUDIO' ? mUrl : null,
            videoUrl: kind === 'VIDEO' ? mUrl : null,
            createdById: req.userId,
          },
        })
        summary.questionsCreated++
      } catch (e) { summary.errors.push({ scope: 'question', index: i, error: e.message }) }
    }

    res.json(summary)
  })
})

export default router
