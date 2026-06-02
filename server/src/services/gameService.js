import { prisma } from '../utils/prisma.js'

export function flattenManchesServer(manches) {
  return [...manches]
    .sort((a, b) => a.ordre - b.ordre)
    .flatMap(m =>
      [...(m.mancheQuestions ?? [])]
        .sort((a, b) => a.ordre - b.ordre)
        .map(mq => ({
          ...mq.question,
          mancheId: m.id,
          mancheNom: m.nom,
          mancheOrdre: m.ordre,
          // Paramètres de manche nécessaires au moteur (timer auto, scoring) et
          // à l'écran public (chronomètre, points par question).
          tempsLimite: m.tempsLimite,
          pointsParQ: m.pointsParQ,
        }))
    )
}

async function piocherQuestionsParManche(manche) {
  const { theme, difficulte: diff, nbQuestions } = manche

  const where = { publique: true }
  if (theme && theme !== 'MELANGE') where.categorie = { nom: theme }
  if (diff && diff !== 'MIXTE') where.difficulte = diff

  const ids = await prisma.question.findMany({ where, select: { id: true } })
  if (ids.length === 0) return []

  // Shuffle using Fisher-Yates
  const arr = ids.map(r => r.id)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, nbQuestions)
}

export async function drawAndStoreQuestions(partieId) {
  const partie = await prisma.partie.findUnique({
    where: { id: partieId },
    include: { manches: true },
  })
  if (!partie) return

  for (const manche of partie.manches) {
    // Ne pas écraser des questions déjà générées (ex: manches d'un pack).
    const existing = await prisma.mancheQuestion.count({ where: { mancheId: manche.id } })
    if (existing > 0) continue

    const questionIds = await piocherQuestionsParManche(manche)
    if (questionIds.length > 0) {
      await prisma.mancheQuestion.createMany({
        data: questionIds.map((qId, i) => ({ mancheId: manche.id, questionId: qId, ordre: i + 1 })),
      })
    }
  }
}

// ── Génération automatique pour les PACKS ─────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Résout des noms de catégories (insensible à la casse) en identifiants.
async function resolveCategorieIds(noms = []) {
  if (!noms.length) return []
  const cats = await prisma.categorie.findMany({ select: { id: true, nom: true } })
  const wanted = noms.map(n => n.trim().toLowerCase())
  return cats.filter(c => wanted.includes(c.nom.trim().toLowerCase())).map(c => c.id)
}

// Tire `count` questions pour une manche d'un pack.
// - filtre par catégories (si fournies) et difficulté (si != MIXTE)
// - varie l'ordre à chaque partie (shuffle)
// - évite les répétitions grâce à `exclude` (questions déjà tirées dans la partie)
// - complète avec d'autres questions publiques si le vivier est insuffisant
export async function pickQuestionsForPack({ categories = [], difficulte = 'MIXTE', count = 10, exclude = new Set(), types = [] }) {
  const categorieIds = await resolveCategorieIds(categories)
  // Contrainte STRICTE de types de questions (ex : pack "AUDIO uniquement").
  // Appliquée à tous les viviers, y compris les compléments de secours.
  const typeFilter = Array.isArray(types) && types.length ? { type: { in: types } } : {}

  const baseWhere = { publique: true, id: { notIn: [...exclude] }, ...typeFilter }
  if (categorieIds.length) baseWhere.categorieId = { in: categorieIds }
  if (difficulte && difficulte !== 'MIXTE') baseWhere.difficulte = difficulte

  // 1. Vivier principal (catégorie + difficulté)
  let pool = await prisma.question.findMany({ where: baseWhere, select: { id: true } })
  let ids = shuffle(pool.map(r => r.id)).slice(0, count)

  // 2. Complément : même catégorie, toutes difficultés
  if (ids.length < count && difficulte && difficulte !== 'MIXTE') {
    const picked = new Set([...exclude, ...ids])
    const relax = { publique: true, id: { notIn: [...picked] }, ...typeFilter }
    if (categorieIds.length) relax.categorieId = { in: categorieIds }
    const extra = await prisma.question.findMany({ where: relax, select: { id: true } })
    ids = ids.concat(shuffle(extra.map(r => r.id)).slice(0, count - ids.length))
  }

  // 3. Complément ultime : n'importe quelle question publique (types respectés)
  if (ids.length < count) {
    const picked = new Set([...exclude, ...ids])
    const extra = await prisma.question.findMany({
      where: { publique: true, id: { notIn: [...picked] }, ...typeFilter },
      select: { id: true },
    })
    ids = ids.concat(shuffle(extra.map(r => r.id)).slice(0, count - ids.length))
  }

  return ids
}
