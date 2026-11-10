// Comptes de DÉMONSTRATION LOCALE (base de test uniquement — jamais en production).
//   DATABASE_URL=… node tests/seed-demo.js
// Crée un compte Gratuit et un compte Premium pour dérouler les écrans.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

if (process.env.NODE_ENV === 'production') throw new Error('Comptes de démonstration : interdit en production.')

export const DEMO = {
  motDePasse: 'Demo-refonte-2026',
  comptes: [
    { email: 'demo-free@test.gbairai', prenom: 'Awa', plan: 'FREE' },
    { email: 'demo-pro@test.gbairai', prenom: 'Koffi', plan: 'PRO' },
  ],
}

const prisma = new PrismaClient()
const password = await bcrypt.hash(DEMO.motDePasse, 10)
for (const c of DEMO.comptes) {
  const planExpireAt = c.plan === 'FREE' ? null : new Date(Date.now() + 30 * 864e5)
  await prisma.user.upsert({
    where: { email: c.email },
    update: { plan: c.plan, planExpireAt },
    create: { ...c, password, emailVerified: true, planExpireAt },
  })
  console.log(`  ✓ ${c.email} (${c.plan})`)
}
await prisma.$disconnect()
