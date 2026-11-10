// ── PLANS & LIMITES FREEMIUM ──────────────────────────────────────────────────
// Source unique de vérité du modèle économique. Modifier ici = changer l'offre
// partout (quotas, droits d'accès, page Abonnements). Aucune valeur codée ailleurs.

export const INF = Number.POSITIVE_INFINITY

// Définition des offres (affichées sur la page Abonnements).
export const PLANS = {
  FREE: {
    id: 'FREE',
    nom: 'Free',
    description: 'Solo illimité et gratuit. 10 parties à plusieurs par mois.',
    prix: 0,                 // FCFA
    couleur: '#9090A0',
    public: 'Particuliers',
    limites: {
      // Plafond des parties MULTIJOUEURS / mois. Les parties solo ne sont pas
      // décomptées (toujours gratuites et illimitées). Au-delà : crédits ou pack.
      partiesParMois: 10,
      joueursMax: 20,
      buzzersVirtuels: 1,
      packTiers: ['GRATUIT'],
      // Création de quiz : nb de quiz personnels enregistrables (INF = illimité).
      quizPersoMax: 3,
      // Génération par IA : quota mensuel + taille maximale d'un quiz généré.
      // FREE = 0 / mois, mais `iaEssai` générations de découverte (à vie).
      iaGenerationsParMois: 0,
      iaEssai: 1,
      iaQuestionsMax: 10,
      exports: false,
      statsAvancees: false,
      branding: false,
      evenementsPrives: false,
      classes: false,
    },
    avantages: [
      'Parties solo illimitées',
      '10 parties à plusieurs / mois',
      "Jusqu'à 20 joueurs",
      'Packs gratuits',
    ],
  },
  PRO: {
    id: 'PRO',
    nom: 'Pro',
    description: 'Pour les animateurs réguliers et les créateurs de contenu.',
    prix: 5000,
    couleur: '#6366F1',
    public: 'Animateurs / créateurs',
    populaire: true,
    limites: {
      partiesParMois: INF,
      joueursMax: 100,
      buzzersVirtuels: INF,
      packTiers: ['GRATUIT', 'PREMIUM', 'EVENEMENT'],
      quizPersoMax: INF,
      iaGenerationsParMois: 30,
      iaEssai: 0,
      iaQuestionsMax: 30,
      exports: true,
      statsAvancees: true,
      branding: false,
      evenementsPrives: false,
      classes: false,
    },
    avantages: [
      'Parties illimitées',
      "Jusqu'à 100 joueurs",
      'Création de quiz par IA (30 / mois)',
      'Accès aux packs Premium',
      'Exports & statistiques avancées',
    ],
  },
  ENTREPRISE: {
    id: 'ENTREPRISE',
    nom: 'Entreprise',
    description: 'Pour les sociétés, séminaires et événements privés.',
    prix: 25000,
    couleur: '#0EA5E9',
    public: 'Entreprises',
    limites: {
      partiesParMois: INF,
      joueursMax: INF,
      buzzersVirtuels: INF,
      packTiers: ['GRATUIT', 'PREMIUM', 'ENTREPRISE', 'EVENEMENT'],
      quizPersoMax: INF,
      iaGenerationsParMois: 100,
      iaEssai: 0,
      iaQuestionsMax: 40,
      exports: true,
      statsAvancees: true,
      branding: true,
      evenementsPrives: true,
      classes: false,
    },
    avantages: [
      'Joueurs illimités',
      'Création de quiz par IA (100 / mois)',
      'Branding personnalisé',
      'Événements privés',
      'Packs entreprise dédiés',
    ],
  },
  ECOLE: {
    id: 'ECOLE',
    nom: 'École',
    description: 'Pour les établissements scolaires et les enseignants.',
    prix: 15000,
    couleur: '#22C55E',
    public: 'Établissements scolaires',
    limites: {
      partiesParMois: INF,
      joueursMax: INF,
      buzzersVirtuels: INF,
      packTiers: ['GRATUIT', 'PREMIUM', 'ECOLE'],
      quizPersoMax: INF,
      iaGenerationsParMois: 60,
      iaEssai: 0,
      iaQuestionsMax: 40,
      exports: true,
      statsAvancees: true,
      branding: false,
      evenementsPrives: false,
      classes: true,
    },
    avantages: [
      'Classes & enseignants',
      'Création de quiz par IA (60 / mois)',
      'Statistiques pédagogiques',
      'Packs éducatifs',
      'Joueurs illimités',
    ],
  },
}

// PREMIUM (héritage) est traité comme PRO pour la rétrocompatibilité.
export const PLAN_ALIASES = { PREMIUM: 'PRO' }

// Normalise un plan vers une offre connue.
export function resolvePlan(plan) {
  const key = PLAN_ALIASES[plan] ?? plan
  return PLANS[key] ?? PLANS.FREE
}

export function getLimites(plan) {
  return resolvePlan(plan).limites
}

// Plan EFFECTIF d'un utilisateur : un plan payant dont l'échéance est dépassée
// retombe sur FREE (un pass prépayé n'est pas reconduit automatiquement).
// `planExpireAt` null = pas d'échéance (plan attribué par l'admin, organisation…).
export function effectivePlan(user, now = new Date()) {
  const plan = user?.plan ?? 'FREE'
  if (plan === 'FREE') return 'FREE'
  if (user?.planExpireAt && new Date(user.planExpireAt) < now) return 'FREE'
  return plan
}

// Quel plan minimal débloque un niveau de pack donné.
export const TIER_REQUIRED_PLAN = {
  GRATUIT: 'FREE',
  PREMIUM: 'PRO',
  EVENEMENT: 'PRO',
  ENTREPRISE: 'ENTREPRISE',
  ECOLE: 'ECOLE',
}

// Sérialisation JSON-safe (Infinity -> null) pour l'envoi au client.
export function publicLimites(limites) {
  const out = {}
  for (const [k, v] of Object.entries(limites)) {
    out[k] = v === INF ? null : v // null = illimité côté client
  }
  return out
}
