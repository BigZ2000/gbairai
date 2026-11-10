// Serveur de VÉRIFICATION D'INTERFACE : le vrai serveur Gbairai, avec l'IA
// remplacée par le fournisseur de test (aucun appel réseau, aucun coût).
// Ne sert qu'à dérouler les écrans en local ; ne jamais déployer.
//   DATABASE_URL=… JWT_SECRET=… PORT=4100 node tests/serveur-demo-ia.js
import { setFournisseurPourTests } from '../src/services/ai/provider.js'
import { creerStub } from './stubIa.js'

const stub = creerStub()
const generer = stub.generer.bind(stub)
// Petit délai pour voir l'écran d'attente comme en conditions réelles.
stub.generer = async (d) => { await new Promise(r => setTimeout(r, 2500)); return generer(d) }
setFournisseurPourTests(stub)
console.log('[démo] IA simulée (fournisseur de test) — aucune génération réelle.')
await import('../src/server.js')
