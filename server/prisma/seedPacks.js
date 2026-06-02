// ── MIGRATION : CATALOGUE CODÉ EN DUR → TABLE PACK ────────────────────────────
// Importe les anciens PACKS / SIGNATURES (server/src/data/packs.js) dans la
// nouvelle table Pack pilotable depuis l'administration. Idempotent (upsert par
// slug) : peut être relancé sans créer de doublons.
//
//   node prisma/seedPacks.js
import { PrismaClient } from '@prisma/client'
import { PACKS, SIGNATURES, MODES } from '../src/data/packs.js'

const prisma = new PrismaClient()

// Mappe la structure d'un mode (rapide/standard/long) vers des paramètres de jeu.
function modeParams(modeId, fixed = {}) {
  const m = MODES[modeId] ?? MODES.standard
  return {
    nbManches: fixed.manches ?? m.manches,
    nbQuestions: fixed.parManche ?? m.parManche,
    tempsParQuestion: fixed.tempsLimite ?? m.tempsLimite,
    pointsParQuestion: fixed.pointsParQ ?? 100,
    duree: m.manches >= 3 ? 'LONGUE' : m.manches <= 1 ? 'RAPIDE' : 'STANDARD',
  }
}

// Construit une liste de tags de recherche à partir du nom + catégories.
function buildTags(nom, categories = []) {
  const fromCats = categories.map(c => c.toLowerCase())
  const fromNom = nom.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç0-9]+/i).filter(w => w.length > 2)
  return [...new Set([...fromCats, ...fromNom])]
}

// Tags additionnels pour coller aux exemples métier (recherche "football").
const EXTRA_TAGS = {
  football: ['football', 'foot', 'can', 'éléphants', 'ligue des champions', 'ballon'],
  'special-can': ['football', 'can', 'éléphants', 'coupe d\'afrique'],
}

async function upsertPack(p, idx, { signature }) {
  const params = signature ? modeParams(p.mode) : modeParams('standard', p.fixed)
  // mort-subite a une structure imposée → RAPIDE.
  if (!signature && p.fixed) params.duree = p.fixed.manches <= 1 ? 'RAPIDE' : params.duree

  const slug = signature ? `sig-${p.id}` : p.id
  const tags = [...new Set([...buildTags(p.nom, p.categories), ...(EXTRA_TAGS[p.id] ?? [])])]
  const data = {
    slug,
    nom: p.nom,
    description: p.description ?? '',
    emoji: p.emoji ?? null,
    couleur: p.couleur ?? '#6366F1',
    categorie: (p.categories && p.categories[0]) || null,
    categories: p.categories ?? [],
    tags,
    difficulte: p.difficulte ?? 'MIXTE',
    typesAutorises: [],
    modeRecommande: 'animateur',
    contentMode: 'DYNAMIQUE',
    ...params,
    signature: !!signature,
    // Priorité décroissante selon l'ordre d'origine (les premiers = plus visibles).
    priorite: Math.max(10, 100 - idx * 5),
    // Quelques têtes d'affiche mises en avant.
    vedette: signature ? idx === 0 : idx < 3,
    statut: 'ACTIF',
  }

  await prisma.pack.upsert({
    where: { slug },
    update: data,
    create: data,
  })
  return slug
}

async function main() {
  let n = 0
  for (let i = 0; i < PACKS.length; i++) {
    const slug = await upsertPack(PACKS[i], i, { signature: false })
    console.log(`  ✓ pack    ${slug}`)
    n++
  }
  for (let i = 0; i < SIGNATURES.length; i++) {
    const slug = await upsertPack(SIGNATURES[i], i, { signature: true })
    console.log(`  ✓ signature ${slug}`)
    n++
  }
  const total = await prisma.pack.count()
  console.log(`\n${n} packs importés. Table Pack: ${total} entrées.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
