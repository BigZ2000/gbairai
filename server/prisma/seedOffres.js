// ── SEED DES OFFRES ───────────────────────────────────────────────────────────
// Migre le catalogue commercial vers la table Offre (pilotable par l'admin).
// Côté UX : 3 familles seulement → Gratuit / Pro / Organisation.
// L'Organisation est déclinée en paliers de sièges (50/100/250/500).
import { PrismaClient } from '@prisma/client'
import { PLANS } from '../src/config/plans.js'

const prisma = new PrismaClient()

const OFFRES = [
  {
    code: 'FREE', nom: 'Gratuit', categorie: 'PERSONNEL', plan: 'FREE',
    prix: 0, dureeJours: 0, sieges: 1, couleur: '#9090A0', ordre: 0,
    description: 'Pour découvrir Gbairai.',
    fonctionnalites: PLANS.FREE.avantages,
  },
  {
    code: 'PRO', nom: 'Pro', categorie: 'PERSONNEL', plan: 'PRO',
    prix: 5000, dureeJours: 30, sieges: 1, couleur: '#6366F1', ordre: 1, populaire: true,
    description: 'Pour les animateurs, associations, événements et créateurs.',
    fonctionnalites: PLANS.PRO.avantages,
  },
  // Organisation — un seul produit, décliné en tailles.
  {
    code: 'ORG_50', nom: 'Organisation 50', categorie: 'ORGANISATION', plan: 'ENTREPRISE',
    prix: 25000, dureeJours: 30, sieges: 50, couleur: '#0EA5E9', ordre: 2,
    description: "Jusqu'à 50 utilisateurs. Idéal petites structures et classes.",
    fonctionnalites: ['Jusqu\'à 50 utilisateurs', 'Joueurs illimités', 'Gestion centralisée', 'Statistiques avancées'],
  },
  {
    code: 'ORG_100', nom: 'Organisation 100', categorie: 'ORGANISATION', plan: 'ENTREPRISE',
    prix: 45000, dureeJours: 30, sieges: 100, couleur: '#0EA5E9', ordre: 3,
    description: "Jusqu'à 100 utilisateurs.",
    fonctionnalites: ['Jusqu\'à 100 utilisateurs', 'Joueurs illimités', 'Gestion centralisée', 'Branding personnalisé'],
  },
  {
    code: 'ORG_250', nom: 'Organisation 250', categorie: 'ORGANISATION', plan: 'ENTREPRISE',
    prix: 100000, dureeJours: 30, sieges: 250, couleur: '#0EA5E9', ordre: 4,
    description: "Jusqu'à 250 utilisateurs. Écoles et entreprises.",
    fonctionnalites: ['Jusqu\'à 250 utilisateurs', 'Joueurs illimités', 'Groupes & classes', 'Branding personnalisé'],
  },
  {
    code: 'ORG_500', nom: 'Organisation 500', categorie: 'ORGANISATION', plan: 'ENTREPRISE',
    prix: 180000, dureeJours: 30, sieges: 500, couleur: '#0EA5E9', ordre: 5,
    description: "Jusqu'à 500 utilisateurs. Grandes structures.",
    fonctionnalites: ['Jusqu\'à 500 utilisateurs', 'Joueurs illimités', 'Groupes & classes', 'Accompagnement dédié'],
  },
]

async function main() {
  for (const o of OFFRES) {
    await prisma.offre.upsert({ where: { code: o.code }, update: o, create: o })
    console.log(`  ✓ ${o.code} — ${o.nom} (${o.prix} FCFA, ${o.sieges} sièges)`)
  }
  console.log(`\n${OFFRES.length} offres en base. Total: ${await prisma.offre.count()}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
