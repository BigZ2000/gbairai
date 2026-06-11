// ──────────────────────────────────────────────────────────────────────────────
// Suppression des questions DRAPEAUX (et CAPITALES issues du même import) avant
// un réimport propre de W2560-drapeaux.zip.
//
// Cible UNIQUEMENT les questions taguées « drapeaux » ou « capitales » :
//   1. supprime leurs liens MancheQuestion / PackQuestion (contraintes FK),
//   2. supprime les questions,
//   3. supprime les médias devenus orphelins (images de drapeaux plus utilisées).
// Ne touche ni aux parties, ni aux scores, ni au reste de la bibliothèque.
//
//   node prisma/deleteDrapeaux.js
//   (prod)  docker compose -f docker-compose.prod.yml exec server node prisma/deleteDrapeaux.js
// ──────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) Questions concernées (drapeaux + capitales générées par le pack).
  const questions = await prisma.question.findMany({
    where: { OR: [{ tags: { has: 'drapeaux' } }, { tags: { has: 'capitales' } }] },
    select: { id: true, mediaId: true },
  })
  const ids = questions.map(q => q.id)
  console.log(`Questions drapeaux/capitales trouvées : ${ids.length}`)
  if (ids.length === 0) { console.log('Rien à supprimer.'); return }

  // 2) Liens FK d'abord (manches de parties + sélections manuelles de packs).
  const mq = await prisma.mancheQuestion.deleteMany({ where: { questionId: { in: ids } } })
  const pq = await prisma.packQuestion.deleteMany({ where: { questionId: { in: ids } } })

  // 3) Les questions elles-mêmes.
  const dq = await prisma.question.deleteMany({ where: { id: { in: ids } } })

  // 4) Médias orphelins (images de drapeaux qui ne servent plus à aucune question).
  const medias = await prisma.media.findMany({
    select: { id: true, _count: { select: { questions: true } } },
  })
  const orphans = medias.filter(m => m._count.questions === 0).map(m => m.id)
  const dm = await prisma.media.deleteMany({ where: { id: { in: orphans } } })

  console.log(`✅ Liens manche supprimés  : ${mq.count}`)
  console.log(`✅ Liens pack supprimés    : ${pq.count}`)
  console.log(`✅ Questions supprimées    : ${dq.count}`)
  console.log(`✅ Médias orphelins purgés : ${dm.count}`)
  console.log('\n👉 Tu peux maintenant réimporter W2560-drapeaux.zip (Admin → Import → Pack visuel).')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
