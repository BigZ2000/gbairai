// ── PLANS & LIMITES FREEMIUM ──────────────────────────────────────────────────
// Source unique de vérité du modèle économique. Modifier ici = changer l'offre
// partout (quotas, droits d'accès, page Abonnements). Aucune valeur codée ailleurs.

export const INF = Number.POSITIVE_INFINITY

// Définition des offres (affichées sur la page Abonnements).
export const PLANS = {
  FREE: {
    id: 'FREE',
    nom: 'Free',
    description: 'Pour découvrir Gbairai et animer de petites parties.',
    prix: 0,                 // FCFA / mois
    couleur: '#9090A0',
    public: 'Particuliers',
    limites: {
      partiesParMois: 5,
      joueursMax: 20,
      buzzersVirtuels: 1,
      packTiers: ['GRATUIT'],
      exports: false,
      statsAvancees: false,
      branding: false,
      evenementsPrives: false,
      classes: false,
    },
    avantages: [
      '5 parties par mois',
      "Jusqu'à 20 joueurs",
      '1 buzzer virtuel',
      'Packs gratuits uniquement',
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
      exports: true,
      statsAvancees: true,
      branding: false,
      evenementsPrives: false,
      classes: false,
    },
    avantages: [
      'Parties illimitées',
      "Jusqu'à 100 joueurs",
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
      exports: true,
      statsAvancees: true,
      branding: true,
      evenementsPrives: true,
      classes: false,
    },
    avantages: [
      'Joueurs illimités',
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
      exports: true,
      statsAvancees: true,
      branding: false,
      evenementsPrives: false,
      classes: true,
    },
    avantages: [
      'Classes & enseignants',
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
