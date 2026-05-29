import { prisma } from '../utils/prisma.js'

export function flattenManchesServer(manches) {
  return [...manches]
    .sort((a, b) => a.ordre - b.ordre)
    .flatMap(m =>
      [...(m.mancheQuestions ?? [])]
        .sort((a, b) => a.ordre - b.ordre)
        .map(mq => ({ ...mq.question, mancheNom: m.nom, mancheOrdre: m.ordre }))
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
    await prisma.mancheQuestion.deleteMany({ where: { mancheId: manche.id } })
    const questionIds = await piocherQuestionsParManche(manche)
    if (questionIds.length > 0) {
      await prisma.mancheQuestion.createMany({
        data: questionIds.map((qId, i) => ({ mancheId: manche.id, questionId: qId, ordre: i + 1 })),
      })
    }
  }
}
