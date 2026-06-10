// ──────────────────────────────────────────────────────────────────────────────
// Banque de QCM (questions « à choix ») — densifie les packs AUTO thématiques.
//
// Contexte : la bibliothèque est composée à ~76 % de questions BUZZER « ouvertes »
// (non vérifiables en mode auto présentiel). Les packs plug & play sont restreints
// aux types « à choix » → il faut suffisamment de QCM/VF/média. Ce module ajoute
// des QCM sur des faits SÛRS et vérifiables (capitales, continents, faits de Côte
// d'Ivoire, sciences, sport, culture générale). Les distracteurs des capitales
// sont d'AUTRES vraies capitales → faux mais plausibles.
//
// Exporté comme module et inséré par prisma/seed-full.js (rebuild idempotent).
// ──────────────────────────────────────────────────────────────────────────────

const F = 'FACILE', M = 'MOYEN'

// Mélange un tableau (Fisher-Yates).
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Construit une question QCM. `distractors` = mauvaises réponses (réelles, plausibles).
function makeQ(enonce, reponse, distractors, categorieId, difficulte = F, points = 100) {
  const choix = shuffle([reponse, ...distractors.slice(0, 3)])
  return { enonce, type: 'QCM', reponse, difficulte, points, choix, tempsLimite: 25, publique: true, categorieId }
}

// Couples (pays → capitale) à confiance élevée (on évite les cas ambigus :
// Afrique du Sud, Bénin… qui ont plusieurs capitales / sièges).
const CAPITALES = [
  ['la France', 'Paris'], ['l\'Espagne', 'Madrid'], ['l\'Allemagne', 'Berlin'],
  ['l\'Italie', 'Rome'], ['le Portugal', 'Lisbonne'], ['le Royaume-Uni', 'Londres'],
  ['la Belgique', 'Bruxelles'], ['la Suisse', 'Berne'], ['la Grèce', 'Athènes'],
  ['la Russie', 'Moscou'], ['l\'Égypte', 'Le Caire'], ['le Maroc', 'Rabat'],
  ['le Sénégal', 'Dakar'], ['le Ghana', 'Accra'], ['le Nigeria', 'Abuja'],
  ['le Mali', 'Bamako'], ['le Burkina Faso', 'Ouagadougou'], ['la Guinée', 'Conakry'],
  ['le Togo', 'Lomé'], ['le Cameroun', 'Yaoundé'], ['le Kenya', 'Nairobi'],
  ['l\'Éthiopie', 'Addis-Abeba'], ['la Tunisie', 'Tunis'], ['l\'Algérie', 'Alger'],
  ['la Chine', 'Pékin'], ['le Japon', 'Tokyo'], ['l\'Inde', 'New Delhi'],
  ['les États-Unis', 'Washington'], ['le Canada', 'Ottawa'], ['le Brésil', 'Brasília'],
  ['l\'Argentine', 'Buenos Aires'], ['le Mexique', 'Mexico'], ['l\'Australie', 'Canberra'],
]

const CONTINENTS = ['Afrique', 'Europe', 'Asie', 'Amérique', 'Océanie']
const PAYS_CONTINENT = [
  ['la France', 'Europe'], ['le Japon', 'Asie'], ['le Brésil', 'Amérique'],
  ['l\'Égypte', 'Afrique'], ['l\'Australie', 'Océanie'], ['le Canada', 'Amérique'],
  ['la Côte d\'Ivoire', 'Afrique'], ['l\'Inde', 'Asie'], ['l\'Allemagne', 'Europe'],
  ['le Nigeria', 'Afrique'], ['la Chine', 'Asie'], ['l\'Argentine', 'Amérique'],
]

export function getQuestionsQcm(catMap) {
  const geo    = catMap['Géographie']
  const ci     = catMap['Actualité Ivoirienne']
  const sci    = catMap['Sciences']
  const sport  = catMap['Sport']
  const cult   = catMap['Culture Générale']

  const out = []

  // 1) Capitales (distracteurs = autres vraies capitales).
  const toutesCapitales = CAPITALES.map(([, c]) => c)
  for (const [pays, cap] of CAPITALES) {
    const distract = shuffle(toutesCapitales.filter(c => c !== cap)).slice(0, 3)
    out.push(makeQ(`Quelle est la capitale de ${pays} ?`, cap, distract, geo, F, 100))
  }

  // 2) Continents.
  for (const [pays, cont] of PAYS_CONTINENT) {
    const distract = CONTINENTS.filter(c => c !== cont)
    out.push(makeQ(`Sur quel continent se trouve ${pays} ?`, cont, distract, geo, F, 100))
  }

  // 3) Côte d'Ivoire (faits sûrs).
  out.push(
    makeQ('Quelle est la capitale politique de la Côte d\'Ivoire ?', 'Yamoussoukro', ['Abidjan', 'Bouaké', 'San-Pédro'], ci, M, 100),
    makeQ('Quelle est la capitale économique de la Côte d\'Ivoire ?', 'Abidjan', ['Yamoussoukro', 'Korhogo', 'Daloa'], ci, F, 100),
    makeQ('Quelle monnaie utilise-t-on en Côte d\'Ivoire ?', 'Le Franc CFA', ['L\'Euro', 'Le Cédi', 'Le Naira'], ci, F, 100),
    makeQ('En quelle année la Côte d\'Ivoire a-t-elle accédé à l\'indépendance ?', '1960', ['1958', '1962', '1965'], ci, M, 100),
    makeQ('Qui fut le premier président de la Côte d\'Ivoire ?', 'Félix Houphouët-Boigny', ['Henri Konan Bédié', 'Laurent Gbagbo', 'Alassane Ouattara'], ci, M, 100),
    makeQ('Quel océan borde la Côte d\'Ivoire ?', 'L\'océan Atlantique', ['L\'océan Indien', 'L\'océan Pacifique', 'La mer Méditerranée'], ci, F, 100),
    makeQ('Quelle est la langue officielle de la Côte d\'Ivoire ?', 'Le français', ['L\'anglais', 'Le portugais', 'L\'arabe'], ci, F, 100),
    makeQ('Comment surnomme-t-on l\'équipe nationale de football de Côte d\'Ivoire ?', 'Les Éléphants', ['Les Lions', 'Les Étalons', 'Les Aigles'], ci, F, 100),
  )

  // 4) Sciences (faits sûrs).
  out.push(
    makeQ('Quel est le symbole chimique de l\'eau ?', 'H₂O', ['CO₂', 'O₂', 'NaCl'], sci, F, 100),
    makeQ('Quelle est la planète la plus proche du Soleil ?', 'Mercure', ['Vénus', 'la Terre', 'Mars'], sci, F, 100),
    makeQ('Combien de planètes compte le système solaire ?', '8', ['7', '9', '10'], sci, M, 100),
    makeQ('Quel organe pompe le sang dans le corps humain ?', 'Le cœur', ['Le foie', 'Les poumons', 'Le cerveau'], sci, F, 100),
    makeQ('Quel gaz les humains respirent-ils pour vivre ?', 'L\'oxygène', ['Le dioxyde de carbone', 'L\'azote', 'L\'hydrogène'], sci, F, 100),
    makeQ('Combien de pattes possède une araignée ?', '8', ['6', '4', '10'], sci, F, 100),
    makeQ('Quel astre est au centre du système solaire ?', 'Le Soleil', ['la Terre', 'la Lune', 'Mars'], sci, F, 100),
    makeQ('Quel est l\'état de l\'eau à 0 °C ?', 'Solide (glace)', ['Liquide', 'Gazeux', 'Plasma'], sci, F, 100),
  )

  // 5) Sport.
  out.push(
    makeQ('Combien de joueurs composent une équipe de football sur le terrain ?', '11', ['10', '12', '9'], sport, F, 100),
    makeQ('Tous les combien d\'années se dispute la Coupe du monde de football ?', 'Tous les 4 ans', ['Tous les 2 ans', 'Tous les 3 ans', 'Tous les 5 ans'], sport, F, 100),
    makeQ('Combien d\'anneaux compte le symbole olympique ?', '5', ['4', '6', '3'], sport, F, 100),
    makeQ('Avec quel ballon joue-t-on au rugby ?', 'Un ballon ovale', ['Un ballon rond', 'Un ballon carré', 'Un ballon plat'], sport, F, 100),
    makeQ('Dans quel sport marque-t-on un « panier » ?', 'Le basket-ball', ['Le handball', 'Le volley-ball', 'Le tennis'], sport, F, 100),
  )

  // 6) Culture générale (faits sûrs).
  out.push(
    makeQ('Combien de jours compte une année non bissextile ?', '365', ['364', '366', '360'], cult, F, 100),
    makeQ('Combien de couleurs compte un arc-en-ciel ?', '7', ['5', '6', '8'], cult, F, 100),
    makeQ('Combien de minutes y a-t-il dans une heure ?', '60', ['100', '30', '90'], cult, F, 100),
    makeQ('Combien de côtés possède un triangle ?', '3', ['4', '5', '2'], cult, F, 100),
    makeQ('Combien de côtés possède un hexagone ?', '6', ['5', '7', '8'], cult, F, 100),
    makeQ('Combien de continents compte la Terre ?', '5', ['4', '6', '3'], cult, M, 100),
    makeQ('Quelle est la plus grande planète du système solaire ?', 'Jupiter', ['Saturne', 'la Terre', 'Neptune'], cult, M, 100),
  )

  return out
}
