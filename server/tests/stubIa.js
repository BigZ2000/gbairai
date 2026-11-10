// Fournisseur IA de TEST : rend un quiz fixe sans appeler le réseau. Sert aux
// tests automatiques et à la vérification de l'interface. Il n'est branché que
// par les fichiers de ce dossier — jamais par le serveur d'exploitation.
export function creerStub({ sortie, erreur } = {}) {
  const appels = []
  return {
    nom: 'stub', modele: 'stub-test', appels,
    async generer(d) {
      appels.push(d)
      if (erreur) throw erreur
      const n = Number(/produire : (\d+)/.exec(d.message)?.[1] ?? 10)
      const idsMedias = [...d.message.matchAll(/- id=(\S+) \| (IMAGE|AUDIO|VIDEO)/g)].map(m => m[1])
      return {
        sortie: sortie ?? quizExemple(n, idsMedias),
        jetonsEntree: 2400, jetonsSortie: 5200, coutEstimeUsd: 0.1136, modele: 'stub-test',
      }
    },
  }
}

export function quizExemple(n = 10, idsMedias = []) {
  const base = [
    { enonce: 'Quelle est la capitale politique de la Côte d\'Ivoire ?', mecanique: 'QCM', choix: ['Abidjan', 'Yamoussoukro', 'Bouaké', 'San-Pédro'], reponse: 'Yamoussoukro', explication: 'Yamoussoukro est la capitale politique depuis 1983 ; Abidjan reste la capitale économique.', difficulte: 'FACILE', mediaId: null, mediaSuggestion: 'photo de la basilique de Yamoussoukro', aVerifier: false },
    { enonce: 'L\'hymne national ivoirien s\'appelle « L\'Abidjanaise ».', mecanique: 'VRAI_FAUX', choix: [], reponse: 'Vrai', explication: 'Adopté à l\'indépendance en 1960.', difficulte: 'FACILE', mediaId: null, mediaSuggestion: null, aVerifier: false },
    { enonce: 'Quelle fève fait de la Côte d\'Ivoire le premier producteur mondial ?', mecanique: 'REPONSE_LIBRE', choix: [], reponse: 'Cacao', explication: 'Le pays fournit environ 40 % du cacao mondial.', difficulte: 'FACILE', mediaId: idsMedias[0] ?? null, mediaSuggestion: null, aVerifier: true },
    // Volontairement INVALIDES : doivent être écartées par le contrôle serveur.
    { enonce: 'Quel fleuve traverse Abidjan ?', mecanique: 'QCM', choix: ['Bandama', 'Comoé', 'Sassandra', 'Cavally'], reponse: 'Lagune Ébrié', explication: '', difficulte: 'MOYEN', mediaId: null, mediaSuggestion: null, aVerifier: false },
    { enonce: 'En quelle année la Côte d\'Ivoire a-t-elle accueilli la CAN remportée à domicile ?', mecanique: 'REPONSE_LIBRE', choix: [], reponse: '2024', explication: 'CAN 2023, jouée début 2024.', difficulte: 'MOYEN', mediaId: 'media-qui-n-existe-pas', mediaSuggestion: null, aVerifier: false },
  ]
  const out = [...base]
  for (let i = out.length; i < n + 1; i++) {
    out.push({ enonce: `Question d'exemple numéro ${i} sur la culture ivoirienne ?`, mecanique: 'QCM', choix: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'], reponse: 'Réponse B', explication: 'Explication d\'exemple.', difficulte: 'MOYEN', mediaId: null, mediaSuggestion: null, aVerifier: false })
  }
  return { titre: 'Côte d\'Ivoire en 10 questions', description: 'Un tour d\'horizon pour briser la glace.', emoji: '🇨🇮', questions: out }
}
