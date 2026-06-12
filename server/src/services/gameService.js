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
          // Paramètres gameplay avancés (malus, multiplicateur, élimination).
          malusEnabled:          m.malusEnabled ?? false,
          malusPenalite:         m.malusPenalite ?? 50,
          multiplicateurPoints:  m.multiplicateurPoints ?? 1.0,
          eliminationActive:     m.eliminationActive ?? false,
        }))
    )
}

// Tirage des questions d'une PARTIE PERSONNALISÉE. Utilise le même moteur que
// les packs (pickQuestionsForPack) → mêmes garanties : filtre par thème
// (catégorie), difficulté ET types de questions, complément si vivier
// insuffisant, et UNICITÉ sur toute la partie (id + subjectKey partagés entre
// manches — une question/un sujet ne sort jamais deux fois).
export async function drawAndStoreQuestions(partieId) {
  const partie = await prisma.partie.findUnique({
    where: { id: partieId },
    include: { manches: { orderBy: { ordre: 'asc' } } },
  })
  if (!partie) return

  const used = new Set()
  const usedSubjects = new Set()

  for (const manche of partie.manches) {
    // Ne pas écraser des questions déjà générées (ex: manches d'un pack) —
    // mais les compter dans l'exclusion pour ne pas les re-tirer ailleurs.
    const existing = await prisma.mancheQuestion.findMany({
      where: { mancheId: manche.id },
      select: { questionId: true, question: { select: { subjectKey: true } } },
    })
    if (existing.length > 0) {
      existing.forEach(e => { used.add(e.questionId); if (e.question?.subjectKey) usedSubjects.add(e.question.subjectKey) })
      continue
    }

    const questionIds = await pickQuestionsForPack({
      categories: manche.theme && manche.theme !== 'MELANGE' ? [manche.theme] : [],
      difficulte: manche.difficulte,
      count: manche.nbQuestions,
      exclude: used,
      excludeSubjects: usedSubjects,
      types: manche.typesAutorises ?? [],
    })
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
// - filtre par catégories (si fournies), difficulté (si != MIXTE) et `tags` (si fournis)
// - varie l'ordre à chaque partie (shuffle)
// - évite les répétitions : `exclude` (ids déjà tirés) ET `excludeSubjects`
//   (clés métier `subjectKey` déjà vues → anti-doublon « même pays sous 2 formes »)
// - complète avec d'autres questions publiques si le vivier est insuffisant
// Les Set `exclude` / `excludeSubjects` sont MUTÉS (partagés entre les manches d'une
// même partie par l'appelant) pour garantir l'unicité sur toute la partie.
export async function pickQuestionsForPack({
  categories = [], difficulte = 'MIXTE', count = 10,
  exclude = new Set(), excludeSubjects = new Set(), types = [], tags = [],
}) {
  const categorieIds = await resolveCategorieIds(categories)
  const typeFilter = Array.isArray(types) && types.length ? { type: { in: types } } : {}
  // Filtre par tags transverses (CEDEAO, drapeaux…) : la question doit porter
  // AU MOINS un des tags demandés.
  const tagFilter = Array.isArray(tags) && tags.length ? { tags: { hasSome: tags } } : {}

  const out = []
  // Sélectionne dans `rows` en respectant l'unicité id ET subjectKey.
  const take = (rows) => {
    for (const row of shuffle(rows)) {
      if (out.length >= count) break
      if (exclude.has(row.id)) continue
      if (row.subjectKey && excludeSubjects.has(row.subjectKey)) continue
      out.push(row.id)
      exclude.add(row.id)
      if (row.subjectKey) excludeSubjects.add(row.subjectKey)
    }
  }
  const fetchRows = (where) => prisma.question.findMany({ where, select: { id: true, subjectKey: true } })

  // 1. Vivier principal (catégorie + difficulté + tags)
  const baseWhere = { publique: true, id: { notIn: [...exclude] }, ...typeFilter, ...tagFilter }
  if (categorieIds.length) baseWhere.categorieId = { in: categorieIds }
  if (difficulte && difficulte !== 'MIXTE') baseWhere.difficulte = difficulte
  take(await fetchRows(baseWhere))

  // 2. Complément : même catégorie + tags, toutes difficultés
  if (out.length < count && difficulte && difficulte !== 'MIXTE') {
    const relax = { publique: true, id: { notIn: [...exclude] }, ...typeFilter, ...tagFilter }
    if (categorieIds.length) relax.categorieId = { in: categorieIds }
    take(await fetchRows(relax))
  }

  // 3. Complément ultime : toute question publique (types + tags respectés)
  if (out.length < count) {
    take(await fetchRows({ publique: true, id: { notIn: [...exclude] }, ...typeFilter, ...tagFilter }))
  }

  return out
}
