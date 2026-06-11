// ──────────────────────────────────────────────────────────────────────────────
// Seed CONSOLIDÉ Gbairai — source de vérité du catalogue de questions.
//
//   • Catégories canoniques (THÈME uniquement) — granulaire.
//   • Le caractère audio/vidéo/image est porté par le TYPE de la question,
//     PAS par une catégorie (on supprime « Questions Audio/Vidéo »).
//   • Réunit : actualité + audio + vidéo + la banque de ~1000 questions.
//   • Rejouable : repart d'un état propre des questions (packs DYNAMIQUE → aucun
//     lien PackQuestion à préserver) et ne réinitialise JAMAIS le mot de passe admin.
//
//   node prisma/seed-full.js
// ──────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getQuestionsActualite } from './seeds/questions_actualite.seed.js'
import { getQuestionsAudio } from './seeds/questions_audio.seed.js'
import { getQuestionsVideo } from './seeds/questions_video.seed.js'
import { getQuestionsQcm } from './seeds/questions_qcm.seed.js'
import { getQuestions1000 } from './seed1000.js'

const prisma = new PrismaClient()

// Catégories canoniques (granulaire : Histoire/Géographie et Sciences/Technologie séparés).
const CANON = [
  ['Actualité Ivoirienne', '🇨🇮'],
  ['Culture Générale',     '🧠'],
  ['Sport',                '⚽'],
  ['Musique',              '🎵'],
  ['Cinéma & Séries',      '🎬'],
  ['Histoire',             '🏛️'],
  ['Géographie',           '🌍'],
  ['Sciences',             '🔬'],
  ['Technologie',          '💻'],
  ['Gastronomie',          '🍽️'],
  ['Littérature',          '📚'],
  ['Art & Culture',        '🎨'],
  ['Nature & Animaux',     '🌿'],
  ['Drapeaux',             '🏳️'],
]

async function main() {
  console.log('🌱 Seed consolidé Gbairai…')

  // 1) Admin — mot de passe posé UNIQUEMENT à la création (jamais réinitialisé).
  const hash = await bcrypt.hash('GbairaiAdmin2024!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@gbairai.ci' },
    update: { isAdmin: true },
    create: { email: 'admin@gbairai.ci', username: 'admin', prenom: 'Admin', password: hash, isAdmin: true },
  })

  // 2) Catégories canoniques (upsert par nom).
  for (const [nom, emoji] of CANON) {
    await prisma.categorie.upsert({ where: { nom }, update: { emoji, publique: true }, create: { nom, emoji, publique: true } })
  }
  const cats = await prisma.categorie.findMany()
  const id = (nom) => {
    const c = cats.find((x) => x.nom === nom)
    if (!c) throw new Error('Catégorie canonique absente: ' + nom)
    return c.id
  }

  // 3) catMap : noms canoniques + ALIAS hérités → ids canoniques.
  //    média = type :  Questions Audio → Musique,  Questions Vidéo → Cinéma & Séries
  //    granulaire   :  Histoire & Géographie → Histoire,  Science & Technologie → Sciences
  const catMap = {
    'Actualité Ivoirienne': id('Actualité Ivoirienne'),
    'Culture Générale':     id('Culture Générale'),
    'Sport':                id('Sport'),
    'Musique':              id('Musique'),
    'Cinéma & Séries':      id('Cinéma & Séries'),
    'Histoire':             id('Histoire'),
    'Géographie':           id('Géographie'),
    'Sciences':             id('Sciences'),
    'Technologie':          id('Technologie'),
    'Gastronomie':          id('Gastronomie'),
    'Littérature':          id('Littérature'),
    'Art & Culture':        id('Art & Culture'),
    'Nature & Animaux':     id('Nature & Animaux'),
    'Histoire & Géographie': id('Histoire'),
    'Science & Technologie': id('Sciences'),
    'Questions Audio':       id('Musique'),
    'Questions Vidéo':       id('Cinéma & Séries'),
  }

  // 4) Construire toutes les questions AVANT toute suppression.
  const all = [
    ...getQuestionsActualite(catMap),
    ...getQuestionsAudio(catMap),
    ...getQuestionsVideo(catMap),
    ...getQuestionsQcm(catMap),
    ...getQuestions1000(catMap),
  ]

  // 5) Repartir d'un état propre des questions (FK : MancheQuestion d'abord).
  await prisma.mancheQuestion.deleteMany()
  await prisma.question.deleteMany()

  // 6) Supprimer les catégories obsolètes (hors canonique), désormais vides.
  const del = await prisma.categorie.deleteMany({ where: { nom: { notIn: CANON.map((c) => c[0]) } } })

  // 7) Insertion en masse.
  const res = await prisma.question.createMany({ data: all, skipDuplicates: true })

  console.log(`✅ Catégories obsolètes supprimées : ${del.count}`)
  console.log(`✅ Catégories canoniques           : ${CANON.length}`)
  console.log(`✅ Questions insérées              : ${res.count}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
