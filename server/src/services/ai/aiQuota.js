// ── QUOTAS & BUDGET DE LA GÉNÉRATION IA ───────────────────────────────────────
// Trois protections, calculées sur le journal AiGeneration (ajout seul) :
//   1. quota du PLAN : N générations réussies par mois (FREE : essai à vie) ;
//   2. anti-abus : X appels par heure et par compte, échecs compris ;
//   3. budget global : plafond de dépense quotidien, tous comptes confondus.
// Réglages : IA_REQUETES_PAR_HEURE (10), IA_BUDGET_JOUR_USD (5.00).
import { prisma } from '../../utils/prisma.js'
import { getLimites, effectivePlan, resolvePlan } from '../../config/plans.js'
import { getFournisseur } from './provider.js'

const parHeure = () => Math.max(1, parseInt(process.env.IA_REQUETES_PAR_HEURE) || 10)
const budgetJour = () => {
  const v = parseFloat(process.env.IA_BUDGET_JOUR_USD)
  return Number.isFinite(v) && v >= 0 ? v : 5
}
const debutMois = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const debutJour = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** État complet pour l'interface : disponibilité, quota, taille maximale. */
export async function etatIa(user) {
  const plan = effectivePlan(user)
  const limites = getLimites(plan)
  const f = getFournisseur()
  const [ceMois, total, derniereHeure, coutJour] = await Promise.all([
    prisma.aiGeneration.count({ where: { userId: user.id, statut: 'ok', createdAt: { gte: debutMois() } } }),
    prisma.aiGeneration.count({ where: { userId: user.id, statut: 'ok' } }),
    prisma.aiGeneration.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
    prisma.aiGeneration.aggregate({ _sum: { coutEstimeUsd: true }, where: { createdAt: { gte: debutJour() } } }),
  ])

  const mensuel = user.isAdmin ? null : limites.iaGenerationsParMois
  const essai = limites.iaEssai ?? 0
  // Restant : quota mensuel du plan, sinon essai découverte (à vie).
  let restantes, mode
  if (user.isAdmin) { restantes = null; mode = 'illimite' }
  else if (mensuel > 0) { restantes = Math.max(0, mensuel - ceMois); mode = 'mensuel' }
  else { restantes = Math.max(0, essai - total); mode = 'essai' }

  return {
    disponible: !!f,
    plan,
    planNom: resolvePlan(plan).nom,
    mode,                       // 'mensuel' | 'essai' | 'illimite'
    quota: mode === 'mensuel' ? mensuel : mode === 'essai' ? essai : null,
    utilisees: mode === 'mensuel' ? ceMois : mode === 'essai' ? total : ceMois,
    restantes,                  // null = illimité
    questionsMax: limites.iaQuestionsMax,
    _derniereHeure: derniereHeure,
    _coutJour: coutJour._sum.coutEstimeUsd ?? 0,
  }
}

/** Autorise ou refuse une génération. Renvoie { allowed, status, code, reason, etat }. */
export async function peutGenerer(user) {
  const etat = await etatIa(user)
  const refus = (status, code, reason) => ({ allowed: false, status, code, reason, etat })

  if (!etat.disponible) {
    return refus(503, 'IA_NON_CONFIGUREE', 'La création par IA n\'est pas encore activée sur cette plateforme.')
  }
  if (etat.restantes !== null && etat.restantes <= 0) {
    return etat.mode === 'essai'
      ? refus(402, 'IA_PREMIUM', 'La création de quiz par IA fait partie de l\'offre Premium.')
      : refus(402, 'IA_QUOTA', `Tu as utilisé tes ${etat.quota} créations par IA de ce mois-ci.`)
  }
  if (etat._derniereHeure >= parHeure()) {
    return refus(429, 'IA_TROP_VITE', 'Beaucoup de demandes en peu de temps : réessaie dans quelques minutes.')
  }
  if (etat._coutJour >= budgetJour()) {
    return refus(429, 'IA_BUDGET', 'La création par IA a atteint son plafond du jour : réessaie demain.')
  }
  return { allowed: true, etat }
}

/** Version publique de l'état (sans les compteurs internes). */
export function etatPublic(etat) {
  const { _derniereHeure, _coutJour, ...pub } = etat
  return pub
}

/** Journalise une tentative (réussie ou non). */
export async function journaliser({ userId, fournisseur, modele, demande, statut, erreur = null, conso = null, nbQuestions = 0 }) {
  return prisma.aiGeneration.create({
    data: {
      userId, fournisseur, modele,
      demande: String(demande ?? '').slice(0, 600),
      statut, erreur: erreur ? String(erreur).slice(0, 500) : null,
      nbQuestions,
      jetonsEntree: conso?.jetonsEntree ?? 0,
      jetonsSortie: conso?.jetonsSortie ?? 0,
      coutEstimeUsd: conso?.coutEstimeUsd ?? 0,
    },
  }).catch(() => null)
}
