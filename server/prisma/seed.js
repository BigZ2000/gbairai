import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { categories } from './seeds/categories.seed.js'
import { getQuestionsActualite } from './seeds/questions_actualite.seed.js'
import { getQuestionsAudio } from './seeds/questions_audio.seed.js'
import { getQuestionsVideo } from './seeds/questions_video.seed.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Démarrage du seeding Gbairai...')

  // 1. Admin user
  const hash = await bcrypt.hash('GbairaiAdmin2024!', 12)
  await prisma.user.upsert({
    where: { email: 'admin@gbairai.ci' },
    update: { isAdmin: true },
    create: {
      email: 'admin@gbairai.ci',
      username: 'admin',
      prenom: 'Admin',
      passwordHash: hash,
      isAdmin: true,
    },
  })
  console.log('✅ Admin créé : admin@gbairai.ci')

  // 2. Upsert categories
  const catMap = {}
  for (const cat of categories) {
    const created = await prisma.categorie.upsert({
      where: { nom: cat.nom },
      update: { emoji: cat.emoji, description: cat.description, publique: cat.publique },
      create: cat,
    })
    catMap[cat.nom] = created.id
  }
  console.log(`✅ ${categories.length} catégories upsertées`)

  // 3. Questions Actualité (≈500)
  const questionsActualite = getQuestionsActualite(catMap)
  const resActu = await prisma.question.createMany({
    data: questionsActualite,
    skipDuplicates: true,
  })
  console.log(`✅ ${resActu.count} questions Actualité insérées`)

  // 4. Questions Audio (50)
  const questionsAudio = getQuestionsAudio(catMap)
  const resAudio = await prisma.question.createMany({
    data: questionsAudio,
    skipDuplicates: true,
  })
  console.log(`✅ ${resAudio.count} questions Audio insérées`)

  // 5. Questions Vidéo (50)
  const questionsVideo = getQuestionsVideo(catMap)
  const resVideo = await prisma.question.createMany({
    data: questionsVideo,
    skipDuplicates: true,
  })
  console.log(`✅ ${resVideo.count} questions Vidéo insérées`)

  const total = resActu.count + resAudio.count + resVideo.count
  console.log(`\n🎉 Seeding terminé ! ${total} questions créées au total.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
