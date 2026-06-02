// Génère le catalogue Gbairai : 500 IMAGE + 500 AUDIO + 500 VIDEO.
// ≥60% orienté Côte d'Ivoire. Chaque question est ancrée sur une entité réelle ;
// plusieurs angles distincts (identification, localisation, fait) sont produits par entité.
// Sortie : 3 fichiers CSV compatibles avec POST /api/import/questions.
//
// Usage : node catalog/generate.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  monumentsCI, monumentsMonde, personnalitesCI, artistesCI, gastronomie,
  paysAfrique, animaux, morceauxCI, morceauxAfrique, instruments,
  footballCI, dansesCI, filmsAfrique,
  marquesObjets, equipesSport, morceauxCI2, chantsCI, sonsAmbiance,
  humoristesCI, seriesCI, evenementsHistoire,
} from './data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, 'csv')
fs.mkdirSync(OUT, { recursive: true })

// RNG déterministe (mulberry32) pour un catalogue reproductible.
let _seed = 20260531
const rng = () => {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (arr, n, exclude = []) => {
  const pool = arr.filter((x) => !exclude.includes(x))
  const out = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return out
}
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50)

const POINTS = { FACILE: 100, MOYEN: 150, DIFFICILE: 200 }

// Accumulateurs.
const rows = { IMAGE: [], AUDIO: [], VIDEO: [] }
function add(type, q) {
  rows[type].push({
    enonce: q.enonce, type, reponse: q.reponse,
    explication: q.note || '', difficulte: q.diff, points: POINTS[q.diff], tempsLimite: type === 'IMAGE' ? 25 : 30,
    categorie: q.cat,
    choixA: q.choix?.[0] || '', choixB: q.choix?.[1] || '', choixC: q.choix?.[2] || '', choixD: q.choix?.[3] || '',
    mediaFile: type === 'IMAGE' ? q.file : '',
    audioFile: type === 'AUDIO' ? q.file : '',
    videoFile: type === 'VIDEO' ? q.file : '',
    videoUrl: '', videoDebut: '', videoFin: '',
    _ci: !!q.ci, // métadonnée interne (non exportée) pour le quota ivoirien
  })
}
// Construit 4 choix : bonne réponse + 3 distracteurs mélangés.
const choices = (bonne, distractPool) => {
  const d = pick(distractPool, 3, [bonne])
  const all = [bonne, ...d]
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
  return all
}

// ───────────────────────── IMAGE ─────────────────────────
const monNames = [...monumentsCI, ...monumentsMonde].map((m) => m.rep)
;[...monumentsCI.map((m) => ({ ...m, ci: true })), ...monumentsMonde.map((m) => ({ ...m, ci: false }))].forEach((m) => {
  const file = `img/${slug(m.rep)}.jpg`
  add('IMAGE', { enonce: 'Quel est ce monument / lieu ?', reponse: m.rep, diff: m.diff, cat: m.cat, note: m.note, file, ci: m.ci, choix: choices(m.rep, monNames) })
  add('IMAGE', { enonce: 'Dans quelle ville / quel pays se trouve ce lieu ?', reponse: m.ville, diff: m.diff === 'FACILE' ? 'MOYEN' : m.diff, cat: m.cat, note: m.note, file, ci: m.ci, choix: choices(m.ville, [...monumentsCI, ...monumentsMonde].map((x) => x.ville)) })
})

const persNames = [...personnalitesCI, ...artistesCI].map((p) => p.rep)
;[...personnalitesCI, ...artistesCI].forEach((p) => {
  const file = `img/${slug(p.rep)}.jpg`
  add('IMAGE', { enonce: 'Qui est cette personnalité ?', reponse: p.rep, diff: p.diff, cat: p.cat, note: p.note, file, ci: true, choix: choices(p.rep, persNames) })
  add('IMAGE', { enonce: 'Dans quel domaine cette personne s\'est-elle illustrée ?', reponse: p.cat, diff: 'FACILE', cat: p.cat, note: p.note, file, ci: true, choix: choices(p.cat, ['Sport', 'Musique', 'Histoire', 'Culture', 'Actualité', 'Nature']) })
})

const platNames = gastronomie.map((g) => g.rep)
gastronomie.forEach((g) => {
  const file = `img/${slug(g.rep)}.jpg`
  add('IMAGE', { enonce: 'Quel est ce plat / cette spécialité ?', reponse: g.rep, diff: g.diff, cat: g.cat, note: g.note, file, ci: true, choix: choices(g.rep, platNames) })
})

const paysNames = paysAfrique.map((p) => p.pays)
const capNames = paysAfrique.map((p) => p.capitale)
paysAfrique.forEach((p) => {
  const ci = ['Côte d\'Ivoire', 'Sénégal', 'Mali', 'Ghana', 'Burkina Faso', 'Guinée', 'Liberia', 'Bénin', 'Togo', 'Niger', 'Nigeria'].includes(p.pays)
  const file = `img/drapeau-${slug(p.pays)}.png`
  add('IMAGE', { enonce: 'À quel pays appartient ce drapeau ?', reponse: p.pays, diff: p.diff, cat: 'Géographie', note: `Drapeau du/de la ${p.pays}.`, file, ci, choix: choices(p.pays, paysNames) })
  add('IMAGE', { enonce: 'Quelle est la capitale du pays de ce drapeau ?', reponse: p.capitale, diff: p.diff === 'FACILE' ? 'MOYEN' : 'DIFFICILE', cat: 'Géographie', note: `${p.capitale} est la capitale du/de la ${p.pays}.`, file, ci, choix: choices(p.capitale, capNames) })
})

const aniNames = animaux.map((a) => a.rep)
animaux.forEach((a) => {
  const file = `img/${slug(a.rep)}.jpg`
  add('IMAGE', { enonce: 'Quel est cet animal ?', reponse: a.rep, diff: a.diff, cat: a.cat, note: a.note, file, ci: false, choix: choices(a.rep, aniNames) })
})

const objNames = marquesObjets.map((o) => o.rep)
marquesObjets.forEach((o) => {
  const file = `img/${slug(o.rep)}.jpg`
  add('IMAGE', { enonce: 'Que représente cette image ?', reponse: o.rep, diff: o.diff, cat: o.cat, note: o.note, file, ci: true, choix: choices(o.rep, objNames) })
})

const eqNames = equipesSport.map((e) => e.rep)
equipesSport.forEach((e) => {
  const file = `img/${slug(e.rep)}.png`
  add('IMAGE', { enonce: 'Quelle équipe / quel club est-ce ?', reponse: e.rep, diff: e.diff, cat: 'Sport', note: e.note, file, ci: e.ci, choix: choices(e.rep, eqNames) })
})

// ───────────────────────── AUDIO ─────────────────────────
const songsCI = [...morceauxCI, ...morceauxCI2, ...chantsCI].map((m) => ({ ...m, ci: true }))
const songsAll = [...songsCI, ...morceauxAfrique.map((m) => ({ ...m, ci: false }))]
const allTitres = songsAll.map((m) => m.titre)
const allArtistes = [...new Set(songsAll.map((m) => m.artiste))]
songsAll.forEach((m) => {
  const file = `audio/${slug(m.artiste)}-${slug(m.titre)}.mp3`
  add('AUDIO', { enonce: 'Quel est le titre de ce morceau ?', reponse: m.titre, diff: m.diff, cat: 'Musique', note: `« ${m.titre} » de ${m.artiste}. ${m.note}`, file, ci: m.ci, choix: choices(m.titre, allTitres) })
  add('AUDIO', { enonce: 'Quel artiste interprète ce morceau ?', reponse: m.artiste, diff: m.diff, cat: 'Musique', note: `« ${m.titre} » de ${m.artiste}. ${m.note}`, file, ci: m.ci, choix: choices(m.artiste, allArtistes) })
})

const instrNames = instruments.map((i) => i.rep)
instruments.forEach((i) => {
  const file = `audio/instrument-${slug(i.rep)}.mp3`
  add('AUDIO', { enonce: 'Quel instrument entend-on ?', reponse: i.rep, diff: i.diff, cat: 'Musique', note: i.note, file, ci: true, choix: choices(i.rep, instrNames) })
})

const sonNames = sonsAmbiance.map((s) => s.rep)
sonsAmbiance.forEach((s) => {
  const file = `audio/son-${slug(s.rep)}.mp3`
  add('AUDIO', { enonce: 'Quel son / quelle ambiance entend-on ?', reponse: s.rep, diff: s.diff, cat: s.cat, note: s.note, file, ci: false, choix: choices(s.rep, sonNames) })
})

// ───────────────────────── VIDEO ─────────────────────────
const footNames = footballCI.map((f) => f.rep)
footballCI.forEach((f) => {
  const file = `video/${slug(f.rep)}.mp4`
  add('VIDEO', { enonce: 'Quel moment de football est montré ?', reponse: f.rep, diff: f.diff, cat: 'Sport', note: f.note, file, ci: true, choix: choices(f.rep, footNames) })
})
const danseNames = dansesCI.map((d) => d.rep)
dansesCI.forEach((d) => {
  const file = `video/${slug(d.rep)}.mp4`
  add('VIDEO', { enonce: 'Quelle danse / quel phénomène culturel est montré ?', reponse: d.rep, diff: d.diff, cat: 'Culture', note: d.note, file, ci: true, choix: choices(d.rep, danseNames) })
})
const filmNames = filmsAfrique.map((f) => f.rep)
filmsAfrique.forEach((f) => {
  const file = `video/${slug(f.rep)}.mp4`
  add('VIDEO', { enonce: 'Quel film est extrait de cette séquence ?', reponse: f.rep, diff: f.diff, cat: 'Culture', note: f.note, file, ci: f.note.includes('ivoirien'), choix: choices(f.rep, filmNames) })
})

const humNames = humoristesCI.map((h) => h.rep)
humoristesCI.forEach((h) => {
  const file = `video/humoriste-${slug(h.rep)}.mp4`
  add('VIDEO', { enonce: 'Quel humoriste / acteur apparaît dans cette vidéo ?', reponse: h.rep, diff: h.diff, cat: h.cat, note: h.note, file, ci: true, choix: choices(h.rep, humNames) })
})

const serNames = seriesCI.map((s) => s.rep)
seriesCI.forEach((s) => {
  const file = `video/serie-${slug(s.rep)}.mp4`
  add('VIDEO', { enonce: 'De quelle série / émission provient cet extrait ?', reponse: s.rep, diff: s.diff, cat: s.cat, note: s.note, file, ci: true, choix: choices(s.rep, serNames) })
})

const evNames = evenementsHistoire.map((e) => e.rep)
evenementsHistoire.forEach((e) => {
  const file = `video/event-${slug(e.rep)}.mp4`
  add('VIDEO', { enonce: 'Quel évènement historique est filmé ?', reponse: e.rep, diff: e.diff, cat: e.cat, note: e.note, file, ci: true, choix: choices(e.rep, evNames) })
})
// Lieux touristiques en vidéo (réutilise monuments CI/monde).
;[...monumentsCI.map((m) => ({ ...m, ci: true })), ...monumentsMonde.map((m) => ({ ...m, ci: false }))].forEach((m) => {
  const file = `video/lieu-${slug(m.rep)}.mp4`
  add('VIDEO', { enonce: 'Quel lieu est filmé dans cette séquence ?', reponse: m.rep, diff: m.diff, cat: 'Tourisme', note: m.note, file, ci: m.ci, choix: choices(m.rep, monNames) })
})
// Personnalités en vidéo (discours, interview, action).
;[...personnalitesCI, ...artistesCI].forEach((p) => {
  const file = `video/itw-${slug(p.rep)}.mp4`
  add('VIDEO', { enonce: 'Quelle personnalité apparaît dans cette vidéo ?', reponse: p.rep, diff: p.diff, cat: p.cat, note: p.note, file, ci: true, choix: choices(p.rep, persNames) })
})

// ───────────────────────── Équilibrage : uniquement des questions UNIQUES ─────────────────────────
// Pas de recyclage/doublon (exigence « non répétitif »). On plafonne à `target` et on
// garantit ≥60% de contenu ivoirien en retirant du non-CI si nécessaire.
function balance(list, target) {
  // Dédoublonnage strict sur (enonce + reponse + media).
  const seen = new Set()
  const uniq = list.filter((r) => {
    const k = `${r.enonce}|${r.reponse}|${r.mediaFile}${r.audioFile}${r.videoFile}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
  const ci = uniq.filter((r) => r._ci)
  const non = uniq.filter((r) => !r._ci)
  // Quota : au moins 60% CI dans le résultat final.
  const maxNonForRatio = Math.floor((ci.length / 0.6) * 0.4) // si tout le CI est gardé
  const keepNon = Math.min(non.length, maxNonForRatio, Math.max(0, target - ci.length))
  const out = [...ci.slice(0, target), ...non.slice(0, keepNon)]
  return out.slice(0, target)
}

function toCsv(list) {
  const headers = ['enonce', 'type', 'reponse', 'explication', 'difficulte', 'points', 'tempsLimite', 'categorie', 'choixA', 'choixB', 'choixC', 'choixD', 'mediaFile', 'audioFile', 'videoFile', 'videoUrl', 'videoDebut', 'videoFin']
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const r of list) lines.push(headers.map((h) => esc(r[h])).join(','))
  return '﻿' + lines.join('\n') + '\n'
}

const summary = {}
for (const type of ['IMAGE', 'AUDIO', 'VIDEO']) {
  const base = rows[type]
  const balanced = balance(base, 500)
  const ciCount = balanced.filter((r) => r._ci).length
  fs.writeFileSync(path.join(OUT, `catalogue_${type.toLowerCase()}.csv`), toCsv(balanced))
  summary[type] = { base: base.length, total: balanced.length, ci: ciCount, pctCI: Math.round((ciCount / balanced.length) * 100) }
}

console.log('Catalogue généré dans', OUT)
console.table(summary)
