// ──────────────────────────────────────────────────────────────────────────────
// Seed MÉDIA de démonstration — débloque les questions IMAGE / AUDIO / VIDEO.
//
// L'importateur média existe déjà (Admin → Import CSV, route /api/import/questions)
// mais aucune question média n'est en base tant qu'on n'a pas importé de fichiers.
// Ce seed charge le petit jeu de démo (`catalog/demo-media/`) via le MÊME pipeline
// d'ingestion (`ingestFile`) pour que les types média existent réellement et que
// les packs « blind test » / « quiz image » affichent du vrai média.
//
// • Idempotent : médias dédupliqués par sha256 ; questions ignorées si déjà créées.
// • Catégories utiles : audio → Musique (blind-test), images → Gastronomie/Actu/Géo,
//   vidéo → Cinéma & Séries (pour que les packs thématiques les piochent).
// • Pour du VRAI contenu média (musiques, photos…), passer par Admin → Import CSV.
//
//   node prisma/seedMediaDemo.js
// ──────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { ingestFile } from '../src/routes/media.js'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEMO_DIR = path.join(__dirname, '..', 'catalog', 'demo-media')
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
}

// Catégorie « métier » par fichier (au lieu de la catégorie « Démo » du CSV) →
// pour que les packs réels (Musique, Gastronomie…) piochent ces questions.
const CAT_BY_FILE = {
  'audio-tone-a.mp3': 'Musique',
  'audio-tone-b.mp3': 'Musique',
  'img-attieke.jpg': 'Gastronomie',
  'img-pyramide.jpg': 'Actualité Ivoirienne',
  'img-drapeau.jpg': 'Géographie',
  'video-mire-1.mp4': 'Cinéma & Séries',
  'video-mire-2.mp4': 'Cinéma & Séries',
}

// Parseur CSV minimal (guillemets + virgules échappées).
function parseCsv(text) {
  const rows = []
  let row = [], cur = '', inQ = false
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += c }
    else if (c === '"') inQ = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1).filter(r => r.some(v => v.trim() !== '')).map(r => {
    const o = {}; headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim() }); return o
  })
}

async function main() {
  const csvPath = path.join(DEMO_DIR, 'demo.csv')
  if (!fs.existsSync(csvPath)) {
    console.log(`⚠️  Pas de démo média à ${csvPath} — rien à faire.`)
    return
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  const admin = await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } })
  if (!admin) { console.log('⚠️  Aucun admin en base (lance seed-full d\'abord). Abandon.'); return }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const catCache = new Map()
  const resolveCat = async (nom) => {
    if (catCache.has(nom)) return catCache.get(nom)
    let c = await prisma.categorie.findFirst({ where: { nom: { equals: nom, mode: 'insensitive' } } })
    if (!c) c = await prisma.categorie.create({ data: { nom, publique: true } })
    catCache.set(nom, c.id); return c.id
  }

  let created = 0, skipped = 0, missing = 0
  for (const r of rows) {
    const ref = r.mediaFile || r.audioFile || r.videoFile || ''
    const file = path.basename(ref)
    const src = path.join(DEMO_DIR, file)
    if (!file || !fs.existsSync(src)) { console.log(`  ⏭️  fichier manquant: ${file || '(aucun)'}`); missing++; continue }

    // Déjà créée ? (idempotence par énoncé)
    if (await prisma.question.findFirst({ where: { enonce: r.enonce } })) { skipped++; continue }

    // Copie dans uploads/ (processUpload sert /uploads/<basename>).
    const ext = path.extname(file).toLowerCase()
    const dest = path.join(UPLOAD_DIR, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`)
    fs.copyFileSync(src, dest)

    let media
    try {
      ({ media } = await ingestFile(dest, { originalName: file, mimeType: MIME[ext] || 'application/octet-stream', userId: admin.id }))
    } catch (e) { console.log(`  ⚠️  ingestion échouée (${file}): ${e.message}`); continue }

    const type = (r.type || 'IMAGE').toUpperCase()
    const choix = [r.choixA, r.choixB, r.choixC, r.choixD].filter(Boolean)
    await prisma.question.create({
      data: {
        enonce: r.enonce,
        type,
        reponse: r.reponse,
        explication: r.explication || null,
        difficulte: (r.difficulte || 'FACILE').toUpperCase(),
        points: Number(r.points) || 100,
        tempsLimite: Number(r.tempsLimite) || 30,
        choix,
        publique: true,
        categorieId: await resolveCat(CAT_BY_FILE[file] || r.categorie || 'Culture Générale'),
        mediaId: media?.id ?? null,
        mediaUrl: type === 'IMAGE' ? (media?.url ?? null) : null,
        audioUrl: type === 'AUDIO' ? (media?.url ?? null) : null,
        videoUrl: type === 'VIDEO' ? (media?.url ?? null) : null,
        createdById: admin.id,
      },
    })
    created++
  }
  console.log(`\n✅ Démo média : ${created} question(s) créée(s), ${skipped} déjà présente(s), ${missing} fichier(s) manquant(s).`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
