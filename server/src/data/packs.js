// ── CATALOGUE DES PACKS GBAIRAI ───────────────────────────────────────────────
// Un "pack" est un thème de jeu prêt à lancer. L'utilisateur choisit un pack et
// un mode (rapide / standard / long) : le moteur génère automatiquement les
// manches et tire les questions adaptées. Aucune configuration manuelle.
//
// Les noms de catégories ci-dessous sont résolus de façon insensible à la casse
// par le générateur (gameService). Si une catégorie manque ou ne contient pas
// assez de questions, le générateur complète avec d'autres questions publiques.
//
// ⚙️ ALIGNEMENT GAMEPLAY (voir docs/AUDIT_PACKS.md) :
// La bibliothèque est composée à ~76 % de questions BUZZER « ouvertes » (sans
// choix). En mode AUTO + présentiel, une question ouverte n'est PAS vérifiable :
// le 1er qui buzze marque (réflexe). Pour qu'un pack soit réellement « plug &
// play » et VÉRIFIÉ sans animateur, on le restreint aux types « à choix »
// (sélection simultanée, comparaison exacte) via `typesAutorises`, OU on le passe
// en `modeDistanciel` (réponse ouverte saisie + correspondance intelligente).
//
// Règles appliquées ci-dessous :
//   • Pack thématique « grand public »  → mode auto + types à choix (CHOIX_TYPES)
//   • Pack média (musique/ciné)         → mode auto + types à choix + média (…_AV)
//   • Pack « réponse ouverte »          → mode auto + distanciel (saisie vérifiée)
//   • Pack « buzzer réflexe »           → mode animateur (un humain juge le buzz)
//   • Pack « malus » (manche à risque)  → mode animateur (le malus ne s'applique
//                                          qu'à une réponse jugée par l'animateur)

// Types de questions « à choix » : sélection simultanée, vérifiée automatiquement
// par le moteur (comparaison exacte). IMAGE est inclus (pas d'autoplay, fiable).
export const CHOIX_TYPES = ['QCM', 'VRAI_FAUX', 'IMAGE']
// Variante média riche (musique / cinéma) : ajoute AUDIO et VIDEO (qui possèdent
// aussi 4 choix dans la bibliothèque → vérifiables en auto).
export const CHOIX_TYPES_AV = ['QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO']

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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'football',
    emoji: '⚽',
    nom: 'Spécial Football',
    description: 'Éléphants, CAN, Ligue des champions, légendes du ballon rond.',
    couleur: '#22C55E',
    categories: ['Sport'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'maquis',
    emoji: '🎵',
    nom: 'Ambiance Maquis',
    description: 'Coupé-décalé, zouglou, afrobeats : la musique qui fait bouger.',
    couleur: '#A855F7',
    categories: ['Musique'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES_AV,
  },
  {
    id: 'cinema',
    emoji: '🎬',
    nom: 'Cinéma & Séries',
    description: 'Nollywood, blockbusters et séries cultes.',
    couleur: '#EF4444',
    categories: ['Cinéma & Séries'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES_AV,
  },
  {
    id: 'culture-g',
    emoji: '🧠',
    nom: 'Culture Générale',
    description: 'Un peu de tout pour tester vos connaissances.',
    couleur: '#6366F1',
    categories: ['Culture Générale'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'gbe-quartier',
    emoji: '😂',
    nom: 'Gbê de Quartier',
    description: 'Le mélange fun et populaire de la vie ivoirienne.',
    couleur: '#F59E0B',
    categories: ['Actualité Ivoirienne', 'Musique', 'Gastronomie'],
    difficulte: 'FACILE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'afrique-monde',
    emoji: '🌍',
    nom: 'Afrique & Monde',
    description: "Histoire et géographie de l'Afrique de l'Ouest et du monde.",
    couleur: '#14B8A6',
    categories: ['Géographie', 'Histoire'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'science-tech',
    emoji: '🔬',
    nom: 'Science & Technologie',
    description: 'Sciences, innovations et technologie expliquées simplement.',
    couleur: '#3B82F6',
    categories: ['Sciences', 'Technologie'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },
  {
    id: 'gastronomie',
    emoji: '🍽️',
    nom: 'Gastronomie',
    description: 'Attiéké, garba, sauce graine… la cuisine du continent.',
    couleur: '#EC4899',
    categories: ['Gastronomie'],
    difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
  },

  // ── 10 packs « jeux TV » intégrant les nouvelles mécaniques ─────────────────
  {
    id: 'blitz-express', emoji: '⚡', nom: 'Blitz Express',
    description: 'Tout le monde répond en même temps, 12 s par question. Rythme éclair.',
    couleur: '#EAB308', categories: [], difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: ['QCM', 'VRAI_FAUX'],
    nbManches: 1, nbQuestions: 15, tempsParQuestion: 12,
  },
  {
    // Malus : ne s'applique qu'à une réponse JUGÉE par l'animateur → mode animateur
    // + questions ouvertes (BUZZER) pour que chaque réponse passe par la validation.
    id: 'sans-faute', emoji: '🎯', nom: 'Sans Faute',
    description: 'Manche à risque : une mauvaise réponse te coûte des points. Réfléchis bien !',
    couleur: '#EF4444', categories: [], difficulte: 'MOYEN',
    modeRecommande: 'animateur', typesAutorises: ['BUZZER'], malusEnabled: true, malusPenalite: 50,
  },
  {
    // Multiplicateur de dernière manche : fonctionne en AUTO (barème). → plug & play.
    id: 'double-ou-rien', emoji: '🏆', nom: 'Double ou Rien',
    description: 'La manche finale vaut le DOUBLE. Tout peut basculer à la fin.',
    couleur: '#F59E0B', categories: [], difficulte: 'MIXTE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES, nbManches: 3, multiplicateurFinale: 2.0,
  },
  {
    // Élimination progressive : gérée par le moteur dans TOUS les modes → AUTO ok.
    id: 'survivor', emoji: '🔥', nom: 'Survivor',
    description: 'Élimination progressive : le dernier de chaque manche devient spectateur.',
    couleur: '#DC2626', categories: [], difficulte: 'MOYEN',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES, nbManches: 3, eliminationActive: true,
  },
  {
    // Réponses OUVERTES vérifiées par saisie (distanciel) → tous types autorisés.
    id: 'quiz-distance', emoji: '🌐', nom: 'Quiz à Distance',
    description: 'Conçu pour jouer en ligne : médias et saisie directement sur le téléphone.',
    couleur: '#0EA5E9', categories: [], difficulte: 'MIXTE',
    modeRecommande: 'auto', modeDistanciel: true,
  },
  {
    // Buzzer RÉFLEXE : la réponse orale n'est pas vérifiable par la machine →
    // un animateur juge le buzz (présentiel). C'est le format « buzzer » assumé.
    id: 'cine-buzz', emoji: '🎬', nom: 'Ciné Buzz',
    description: 'Questions cinéma au buzzer : le plus rapide répond, l\'animateur valide.',
    couleur: '#A855F7', categories: ['Cinéma & Séries'], difficulte: 'MIXTE',
    modeRecommande: 'animateur', typesAutorises: ['BUZZER'],
  },
  {
    // Malus → animateur + questions ouvertes ; finale ×2 (PREMIUM).
    id: 'grand-defi', emoji: '🧠', nom: 'Le Grand Défi',
    description: '3 manches montantes : à risque, puis finale qui compte double.',
    couleur: '#6366F1', categories: [], difficulte: 'DIFFICILE',
    modeRecommande: 'animateur', typesAutorises: ['BUZZER'], nbManches: 3, malusEnabled: true, malusPenalite: 30,
    multiplicateurFinale: 2.0, tier: 'PREMIUM',
  },
  {
    // Élimination + finale ×2 : toutes deux compatibles AUTO → plug & play (PREMIUM).
    id: 'choc-champions', emoji: '⚔️', nom: 'Choc des Champions',
    description: 'Élimination à chaque manche + finale qui compte double. Pour les plus forts.',
    couleur: '#B91C1C', categories: [], difficulte: 'DIFFICILE',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES, nbManches: 3, eliminationActive: true,
    multiplicateurFinale: 2.0, tier: 'PREMIUM',
  },
  {
    id: 'marathon-culture', emoji: '📚', nom: 'Marathon Culture',
    description: '4 manches thématiques pour les longues soirées quiz.',
    couleur: '#0D9488', categories: ['Culture Générale', 'Histoire', 'Sciences', 'Géographie'],
    difficulte: 'MIXTE', modeRecommande: 'auto', typesAutorises: CHOIX_TYPES, nbManches: 4, nbQuestions: 8,
  },
  {
    // Quiz musical rapide (catégorie Musique) en distanciel. typesAutorises =
    // CHOIX_TYPES_AV : aujourd'hui les questions AUDIO « vraies » (avec fichier) ne
    // sont pas encore semées en base → on s'appuie sur les QCM/VF Musique (et l'AUDIO
    // sera utilisé automatiquement le jour où le catalogue média sera importé).
    id: 'blind-test-express', emoji: '🎵', nom: 'Blind Test Express',
    description: 'Spécial musique : réponds le plus vite, sur ton téléphone.',
    couleur: '#EC4899', categories: ['Musique'], difficulte: 'MIXTE',
    modeRecommande: 'auto', modeDistanciel: true, typesAutorises: CHOIX_TYPES_AV,
    nbManches: 1, nbQuestions: 12, tempsParQuestion: 20,
  },
]

// Parties signature : presets officiels prêts à jouer (1 clic = on lance).
// Toutes en mode auto + types à choix → vérifiées, plug & play (présentiel,
// distanciel, téléphone seul, solo).
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES_AV,
  },
  {
    id: 'ci-challenge',
    emoji: '🇨🇮',
    nom: 'Côte d\'Ivoire Challenge',
    description: 'Le grand défi 100 % ivoirien.',
    couleur: '#F77F00',
    categories: ['Actualité Ivoirienne', 'Histoire', 'Géographie', 'Gastronomie'],
    difficulte: 'DIFFICILE',
    mode: 'long',
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES_AV,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES_AV,
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
    modeRecommande: 'auto', typesAutorises: CHOIX_TYPES,
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
