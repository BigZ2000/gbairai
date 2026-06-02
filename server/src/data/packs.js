// ── CATALOGUE DES PACKS GBAIRAI ───────────────────────────────────────────────
// Un "pack" est un thème de jeu prêt à lancer. L'utilisateur choisit un pack et
// un mode (rapide / standard / long) : le moteur génère automatiquement les
// manches et tire les questions adaptées. Aucune configuration manuelle.
//
// Les noms de catégories ci-dessous sont résolus de façon insensible à la casse
// par le générateur (gameService). Si une catégorie manque ou ne contient pas
// assez de questions, le générateur complète avec d'autres questions publiques.

// Modes : structure générique appliquée à n'importe quel pack.
// Chaque mode définit le nombre de manches et de questions par manche.
export const MODES = {
  rapide:   { id: 'rapide',   label: 'Rapide',   emoji: '⚡', dureeMin: 10, manches: 1, parManche: 8,  tempsLimite: 25 },
  standard: { id: 'standard', label: 'Standard', emoji: '🎯', dureeMin: 20, manches: 2, parManche: 10, tempsLimite: 30 },
  long:     { id: 'long',     label: 'Long',     emoji: '🏆', dureeMin: 40, manches: 3, parManche: 12, tempsLimite: 30 },
}

// Packs thématiques. `categories: []` = toutes les catégories (mélange total).
export const PACKS = [
  {
    id: 'actu-ci',
    emoji: '🇨🇮',
    nom: 'Actu CI Express',
    description: "L'actualité, la politique et la société ivoiriennes du moment.",
    couleur: '#F77F00',
    categories: ['Actualité Ivoirienne'],
    difficulte: 'MIXTE',
  },
  {
    id: 'football',
    emoji: '⚽',
    nom: 'Spécial Football',
    description: 'Éléphants, CAN, Ligue des champions, légendes du ballon rond.',
    couleur: '#22C55E',
    categories: ['Sport'],
    difficulte: 'MIXTE',
  },
  {
    id: 'maquis',
    emoji: '🎵',
    nom: 'Ambiance Maquis',
    description: 'Coupé-décalé, zouglou, afrobeats : la musique qui fait bouger.',
    couleur: '#A855F7',
    categories: ['Musique'],
    difficulte: 'MIXTE',
  },
  {
    id: 'cinema',
    emoji: '🎬',
    nom: 'Cinéma & Séries',
    description: 'Nollywood, blockbusters et séries cultes.',
    couleur: '#EF4444',
    categories: ['Cinéma & Séries'],
    difficulte: 'MIXTE',
  },
  {
    id: 'culture-g',
    emoji: '🧠',
    nom: 'Culture Générale',
    description: 'Un peu de tout pour tester vos connaissances.',
    couleur: '#6366F1',
    categories: ['Culture générale', 'Culture Générale'],
    difficulte: 'MIXTE',
  },
  {
    id: 'gbe-quartier',
    emoji: '😂',
    nom: 'Gbê de Quartier',
    description: 'Le mélange fun et populaire de la vie ivoirienne.',
    couleur: '#F59E0B',
    categories: ['Actualité Ivoirienne', 'Musique', 'Gastronomie'],
    difficulte: 'FACILE',
  },
  {
    id: 'afrique-monde',
    emoji: '🌍',
    nom: 'Afrique & Monde',
    description: "Histoire et géographie de l'Afrique de l'Ouest et du monde.",
    couleur: '#14B8A6',
    categories: ['Géographie', 'Histoire', 'Histoire & Géographie'],
    difficulte: 'MIXTE',
  },
  {
    id: 'science-tech',
    emoji: '🔬',
    nom: 'Science & Technologie',
    description: 'Sciences, innovations et technologie expliquées simplement.',
    couleur: '#3B82F6',
    categories: ['Sciences', 'Technologie', 'Science & Technologie'],
    difficulte: 'MIXTE',
  },
  {
    id: 'gastronomie',
    emoji: '🍽️',
    nom: 'Gastronomie',
    description: 'Attiéké, garba, sauce graine… la cuisine du continent.',
    couleur: '#EC4899',
    categories: ['Gastronomie'],
    difficulte: 'MIXTE',
  },
  {
    id: 'mort-subite',
    emoji: '⚡',
    nom: 'Mort Subite',
    description: 'Questions difficiles, rythme effréné, une seule manche éclair.',
    couleur: '#DC2626',
    categories: [],
    difficulte: 'DIFFICILE',
    // Structure imposée quel que soit le mode choisi.
    fixed: { manches: 1, parManche: 12, tempsLimite: 10, pointsParQ: 200 },
  },
]

// Parties signature : presets officiels prêts à jouer (1 clic = on lance).
export const SIGNATURES = [
  {
    id: 'special-can',
    emoji: '🏆',
    nom: 'Spécial CAN',
    description: 'La Coupe d\'Afrique des Nations dans tous ses états.',
    couleur: '#16A34A',
    categories: ['Sport'],
    difficulte: 'MOYEN',
    mode: 'standard',
  },
  {
    id: 'abidjan',
    emoji: '🌆',
    nom: 'Connaissez-vous Abidjan ?',
    description: 'Communes, quartiers et culture de la perle des lagunes.',
    couleur: '#0EA5E9',
    categories: ['Actualité Ivoirienne', 'Géographie'],
    difficulte: 'MOYEN',
    mode: 'rapide',
  },
  {
    id: 'generation-90',
    emoji: '📼',
    nom: 'Génération 90',
    description: 'Tubes, films et souvenirs des années 90.',
    couleur: '#8B5CF6',
    categories: ['Musique', 'Cinéma & Séries'],
    difficulte: 'MOYEN',
    mode: 'standard',
  },
  {
    id: 'ci-challenge',
    emoji: '🇨🇮',
    nom: 'Côte d\'Ivoire Challenge',
    description: 'Le grand défi 100 % ivoirien.',
    couleur: '#F77F00',
    categories: ['Actualité Ivoirienne', 'Histoire & Géographie', 'Gastronomie'],
    difficulte: 'DIFFICILE',
    mode: 'long',
  },
  {
    id: 'arafat',
    emoji: '🎤',
    nom: 'Spécial DJ Arafat',
    description: 'Hommage au Daïshi : sa vie, ses sons, sa légende.',
    couleur: '#DB2777',
    categories: ['Musique'],
    difficulte: 'MOYEN',
    mode: 'rapide',
  },
  {
    id: 'coupe-decale',
    emoji: '💃',
    nom: 'Spécial Coupé-Décalé',
    description: 'Le mouvement qui a conquis l\'Afrique et le monde.',
    couleur: '#A855F7',
    categories: ['Musique'],
    difficulte: 'MOYEN',
    mode: 'standard',
  },
  {
    id: 'champion',
    emoji: '👑',
    nom: 'Qui veut devenir champion Gbairai ?',
    description: 'Le marathon culture générale pour les plus forts.',
    couleur: '#EAB308',
    categories: [],
    difficulte: 'MIXTE',
    mode: 'long',
  },
]

// Construit le plan de manches (structure) pour un pack + un mode donnés.
// Retourne un tableau de définitions de manches prêtes à être créées en base.
export function buildPlan(pack, modeId) {
  const mode = MODES[modeId] ?? MODES.standard
  const f = pack.fixed ?? {}
  const nbManches  = f.manches ?? mode.manches
  const parManche  = f.parManche ?? mode.parManche
  const temps      = f.tempsLimite ?? mode.tempsLimite
  const pointsParQ = f.pointsParQ ?? 100

  return Array.from({ length: nbManches }, (_, i) => ({
    nom: nbManches === 1 ? pack.nom : `Manche ${i + 1}`,
    categories: pack.categories ?? [],
    difficulte: pack.difficulte ?? 'MIXTE',
    nbQuestions: parManche,
    pointsParQ,
    tempsLimite: temps,
  }))
}

export function findPack(id) {
  return PACKS.find(p => p.id === id) ?? null
}

export function findSignature(id) {
  return SIGNATURES.find(s => s.id === id) ?? null
}
