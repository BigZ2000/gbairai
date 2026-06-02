// Valide les CSV du catalogue contre QuestionSchema, en répliquant le mapping
// de POST /api/import/questions — SANS écrire en base. Usage : node catalog/validate.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { QuestionSchema } from '../src/routes/questions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, 'csv')

// Même parseur que le serveur (guillemets / virgules / retours-ligne échappés + BOM).
function parseCsv(text) {
  const rows = []; let row = [], cur = '', inQ = false
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
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== '')).map((r) => {
    const o = {}; headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim() }); return o
  })
}

let totalOk = 0, totalErr = 0
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.csv'))) {
  const rows = parseCsv(fs.readFileSync(path.join(DIR, f), 'utf8'))
  let ok = 0; const errs = []
  rows.forEach((r, i) => {
    const choix = [r.choixA, r.choixB, r.choixC, r.choixD].filter(Boolean)
    const type = (r.type || 'BUZZER').toUpperCase()
    const data = {
      enonce: r.enonce, type, reponse: r.reponse,
      explication: r.explication || null,
      difficulte: (r.difficulte || 'MOYEN').toUpperCase(),
      points: Number(r.points) || 100, tempsLimite: Number(r.tempsLimite) || 30,
      choix, publique: true, categorieId: null, mediaId: null,
      mediaUrl: null, audioUrl: null, videoUrl: r.videoUrl || null,
      videoDebut: r.videoDebut ? Number(r.videoDebut) : null,
      videoFin: r.videoFin ? Number(r.videoFin) : null,
    }
    const p = QuestionSchema.safeParse(data)
    if (p.success) ok++; else errs.push({ row: i + 2, enonce: r.enonce?.slice(0, 40), err: p.error.flatten().fieldErrors })
  })
  totalOk += ok; totalErr += errs.length
  console.log(`${f}: ${ok}/${rows.length} valides` + (errs.length ? `  ✗ ${errs.length} erreurs` : '  ✓'))
  if (errs.length) console.log(JSON.stringify(errs.slice(0, 5), null, 2))
}
console.log(`\nTOTAL : ${totalOk} valides, ${totalErr} erreurs`)
