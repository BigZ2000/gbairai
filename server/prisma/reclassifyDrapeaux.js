// ──────────────────────────────────────────────────────────────────────────────
// Reclassement : déplace toutes les questions taguées « drapeaux » vers la
// catégorie « Drapeaux » (créée si absente). Idempotent et non destructif —
// ne touche QUE le `categorieId` des questions concernées.
//
// Utile après un premier import où les drapeaux étaient rangés dans « Géographie ».
//
//   node prisma/reclassifyDrapeaux.js
//   (en prod)  docker compose -f docker-compose.prod.yml exec server node prisma/reclassifyDrapeaux.js
// ──────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) Catégorie « Drapeaux » (upsert).
  const cat = await prisma.categorie.upsert({
    where: { nom: 'Drapeaux' },
    update: { emoji: '🏳️', publique: true },
    create: { nom: 'Drapeaux', emoji: '🏳️', publique: true },
  })

  // 2) Combien sont concernées et combien sont déjà bien classées ?
  const total = await prisma.question.count({ where: { tags: { has: 'drapeaux' } } })
  const dejaOk = await prisma.question.count({ where: { tags: { has: 'drapeaux' }, categorieId: cat.id } })

  // 3) Reclasse celles qui ne sont pas déjà dans « Drapeaux ».
  const res = await prisma.question.updateMany({
    where: { tags: { has: 'drapeaux' }, NOT: { categorieId: cat.id } },
    data: { categorieId: cat.id },
  })

  console.log(`🏳️  Catégorie « Drapeaux » : ${cat.id}`)
  console.log(`   Questions taguées « drapeaux » : ${total}`)
  console.log(`   Déjà classées               : ${dejaOk}`)
  console.log(`✅ Reclassées vers « Drapeaux »  : ${res.count}`)

  if (total === 0) {
    console.log('\nℹ️  Aucune question « drapeaux » en base — importe d\'abord W2560-drapeaux.zip (Admin → Import → Pack visuel).')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
