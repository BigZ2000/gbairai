// ──────────────────────────────────────────────────────────────────────────────
// Générateur du pack « Drapeaux du Monde » → produit un ZIP { manifest.json +
// media/ } prêt à importer (Admin → Import → Pack visuel, ou POST /import/pack).
//
// Source : dossier de drapeaux nommés par code ISO2 (ex. W2560/ci.png).
// Génère, par pays (subjectKey = ISO → anti-doublon) :
//   • Type 1 : drapeau (IMAGE) → choix TEXTE  « Quel est ce pays ? »
//   • Type 2 : « Quel est le drapeau de … ? » → choix IMAGES (drapeaux)
//
//   node scripts/flags/generateFlagsPack.js [--src=../W2560] [--out=../W2560-drapeaux.zip]
//        [--types=1,2] [--limit=N] [--choices=4]
// ──────────────────────────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import AdmZip from 'adm-zip'
import { COUNTRIES, difficulteOf, tagsOf } from './countries.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..', '..') // racine du repo (gbairai/)

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2]] : [a, true]
}))
const SRC = path.resolve(ROOT, args.src || 'W2560')
const OUT = path.resolve(ROOT, args.out || 'W2560-drapeaux.zip')
const TYPES = String(args.types || '1,2').split(',').map(s => s.trim())
const NCHOICES = Math.max(2, Math.min(6, Number(args.choices) || 4))
const LIMIT = args.limit ? Number(args.limit) : Infinity

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
const nameOf = (c) => COUNTRIES[c]?.[0]
const contOf = (c) => COUNTRIES[c]?.[1]

function main() {
  if (!fs.existsSync(SRC)) { console.error(`❌ Dossier source introuvable : ${SRC}`); process.exit(1) }

  // Codes disponibles = ceux qui ont un PNG ET une entrée dans la table.
  const files = new Set(fs.readdirSync(SRC).filter(f => f.toLowerCase().endsWith('.png')).map(f => f.replace(/\.png$/i, '').toLowerCase()))
  let codes = Object.keys(COUNTRIES).filter(c => files.has(c))
  const missingData = [...files].filter(f => !COUNTRIES[f])
  const missingImg = Object.keys(COUNTRIES).filter(c => !files.has(c))
  codes = codes.slice(0, LIMIT)

  // Distracteurs : préférer le même continent, compléter avec n'importe lequel.
  const pickDistractors = (code, n) => {
    const cont = contOf(code)
    const same = codes.filter(c => c !== code && contOf(c) === cont)
    const other = codes.filter(c => c !== code && contOf(c) !== cont)
    return [...shuffle(same), ...shuffle(other)].slice(0, n)
  }

  const questions = []
  const usedFiles = new Set()
  for (const code of codes) {
    const name = nameOf(code)
    const subjectKey = code.toUpperCase()
    const meta = { subjectKey, categorie: 'Géographie', tags: tagsOf(code) }
    const diff = difficulteOf(code)
    usedFiles.add(code)

    if (TYPES.includes('1')) {
      const distract = pickDistractors(code, NCHOICES - 1)
      const choices = shuffle([
        { text: name, correct: true },
        ...distract.map(d => ({ text: nameOf(d) })),
      ])
      questions.push({ format: 'QCM', media: { kind: 'IMAGE', file: `${code}.png` }, enonce: 'Quel est ce pays ?', choices, meta, difficulte: diff, points: 100 })
    }
    if (TYPES.includes('2')) {
      const distract = pickDistractors(code, NCHOICES - 1)
      distract.forEach(d => usedFiles.add(d))
      const choices = shuffle([
        { mediaFile: `${code}.png`, correct: true },
        ...distract.map(d => ({ mediaFile: `${d}.png` })),
      ])
      questions.push({ format: 'QCM', enonce: `Quel est le drapeau de « ${name} » ?`, choices, meta, difficulte: diff, points: 100 })
    }
  }

  const manifest = {
    pack: {
      slug: 'drapeaux-monde', nom: 'Drapeaux du Monde', emoji: '🏳️', couleur: '#6366F1',
      description: 'Reconnais les drapeaux du monde entier.',
      modeRecommande: 'auto', typesAutorises: [], filtreTags: ['drapeaux'], modeDistanciel: true,
      nbManches: 1, nbQuestions: 10, tempsParQuestion: 20, difficulte: 'MIXTE',
      categories: ['Géographie'], tier: 'GRATUIT',
    },
    questions,
  }

  // ZIP : manifest.json + media/<code>.png (tous les fichiers référencés).
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 0)))
  for (const code of usedFiles) {
    const p = path.join(SRC, `${code}.png`)
    if (fs.existsSync(p)) zip.addLocalFile(p, 'media', `${code}.png`)
  }
  zip.writeZip(OUT)

  console.log(`✅ Pack généré : ${OUT}`)
  console.log(`   Pays           : ${codes.length}`)
  console.log(`   Questions      : ${questions.length} (types ${TYPES.join('+')}, ${NCHOICES} choix)`)
  console.log(`   Images dans ZIP: ${usedFiles.size}`)
  if (missingData.length) console.log(`   ⚠️ PNG sans nom (ignorés) : ${missingData.join(', ')}`)
  if (missingImg.length) console.log(`   ⚠️ Pays sans PNG : ${missingImg.length}`)
  console.log(`\n👉 Importer : Admin → Import → « Pack visuel » → choisir ${path.basename(OUT)}`)
}

main()
