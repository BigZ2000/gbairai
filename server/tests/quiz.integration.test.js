// Tests d'intégration « Mes quiz » + création par IA (base réelle, IA simulée).
//   DATABASE_URL=… JWT_SECRET=test node --test --test-force-exit tests/quiz.integration.test.js
// Couvre : droits FREE / PRO / ENTREPRISE / plan expiré, quotas, garde-fous,
// enregistrement, confidentialité du quiz, lancement par le moteur existant.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET ||= 'test-secret'
const { prisma } = await import('../src/utils/prisma.js')
const { default: quizRoutes } = await import('../src/routes/quiz.js')
const { default: packsRoutes } = await import('../src/routes/packs.js')
const { default: partiesRoutes } = await import('../src/routes/parties.js')
const { setFournisseurPourTests, IaRefus } = await import('../src/services/ai/provider.js')
const { creerStub } = await import('./stubIa.js')

const app = express()
app.use(express.json())
app.use('/api/quiz', quizRoutes)
app.use('/api/packs', packsRoutes)
app.use('/api/parties', partiesRoutes)

let server, base
const tag = `t${Date.now()}`
const users = {}

async function creer(nom, data) {
  users[nom] = await prisma.user.create({ data: { email: `${tag}-${nom}@test.gbairai`, prenom: nom, ...data } })
}
const jeton = (nom) => jwt.sign({ sub: users[nom].id }, process.env.JWT_SECRET)
async function api(nom, methode, chemin, body) {
  const r = await fetch(base + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton(nom)}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const demande = { demande: 'Un quiz sur la Côte d\'Ivoire pour briser la glace', nbQuestions: 10 }

before(async () => {
  await creer('free', {})
  await creer('pro', { plan: 'PRO', planExpireAt: new Date(Date.now() + 30 * 864e5) })
  await creer('expire', { plan: 'PRO', planExpireAt: new Date(Date.now() - 864e5) })
  await creer('entreprise', { plan: 'ENTREPRISE' })
  await creer('invite', { isGuest: true })
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  const ids = Object.values(users).map(u => u.id)
  await prisma.partie.deleteMany({ where: { creatorId: { in: ids } } })
  await prisma.pack.deleteMany({ where: { ownerId: { in: ids } } })
  await prisma.question.deleteMany({ where: { createdById: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  server.close()
  await prisma.$disconnect()
})

test('sans clé d\'API : état « indisponible » et 503 honnête', async () => {
  setFournisseurPourTests(null)
  assert.equal((await api('pro', 'GET', '/api/quiz/ia/etat')).body.disponible, false)
  const r = await api('pro', 'POST', '/api/quiz/ia/generer', demande)
  assert.deepEqual([r.status, r.body.code], [503, 'IA_NON_CONFIGUREE'])
})

test('invité : pas de création de quiz', async () => {
  assert.equal((await api('invite', 'GET', '/api/quiz')).status, 403)
})

test('FREE : 1 essai découverte (10 questions max), puis Premium requis', async () => {
  const stub = creerStub(); setFournisseurPourTests(stub)
  const etat = (await api('free', 'GET', '/api/quiz/ia/etat')).body
  assert.deepEqual([etat.mode, etat.restantes, etat.questionsMax], ['essai', 1, 10])
  const r = await api('free', 'POST', '/api/quiz/ia/generer', { ...demande, nbQuestions: 30 })
  assert.equal(r.status, 200)
  assert.equal(r.body.demandees, 10)
  assert.ok(r.body.brouillon.questions.length <= 10)
  assert.equal(r.body.etat.restantes, 0)
  const r2 = await api('free', 'POST', '/api/quiz/ia/generer', demande)
  assert.deepEqual([r2.status, r2.body.code], [402, 'IA_PREMIUM'])
  assert.equal(stub.appels.length, 1, 'aucun appel au modèle quand le quota est épuisé')
})

test('plan PRO expiré : traité comme FREE', async () => {
  const etat = (await api('expire', 'GET', '/api/quiz/ia/etat')).body
  assert.deepEqual([etat.plan, etat.mode], ['FREE', 'essai'])
})

test('ENTREPRISE : quota supérieur à PRO', async () => {
  const [p, e] = await Promise.all([api('pro', 'GET', '/api/quiz/ia/etat'), api('entreprise', 'GET', '/api/quiz/ia/etat')])
  assert.deepEqual([p.body.mode, p.body.quota, e.body.quota, e.body.questionsMax], ['mensuel', 30, 100, 40])
})

let brouillon, quizId
test('PRO : génération validée — invalides écartées, média inventé retiré, contexte transmis', async () => {
  const stub = creerStub(); setFournisseurPourTests(stub)
  const r = await api('pro', 'POST', '/api/quiz/ia/generer', { ...demande, contexte: 'Notre entreprise fête ses 10 ans.' })
  assert.equal(r.status, 200)
  brouillon = r.body.brouillon
  assert.equal(brouillon.questions.length, 10)
  assert.equal(r.body.ecartees, 1)
  assert.ok(!brouillon.questions.some(q => /fleuve traverse Abidjan/.test(q.enonce)), 'QCM sans bonne réponse écarté')
  assert.ok(brouillon.questions.every(q => q.media === null || q.media.url), 'aucune référence de média inventée')
  assert.ok(brouillon.questions.some(q => q.aVerifier))
  assert.match(stub.appels[0].message, /<contexte>\nNotre entreprise fête ses 10 ans\./)
  assert.equal(await prisma.pack.count({ where: { ownerId: users.pro.id } }), 0, 'rien n\'est enregistré avant validation')
})

test('demande trop courte → 400 ; refus du modèle → 422 ; sortie inexploitable → 502 non décomptée', async () => {
  assert.equal((await api('pro', 'POST', '/api/quiz/ia/generer', { demande: 'quiz' })).status, 400)
  const avant = (await api('pro', 'GET', '/api/quiz/ia/etat')).body.utilisees
  setFournisseurPourTests(creerStub({ erreur: new IaRefus('décliné') }))
  assert.equal((await api('pro', 'POST', '/api/quiz/ia/generer', demande)).body.code, 'IA_REFUS')
  setFournisseurPourTests(creerStub({ sortie: { titre: 'x', description: '', emoji: '', questions: [{ enonce: 'bof' }] } }))
  const r = await api('pro', 'POST', '/api/quiz/ia/generer', demande)
  assert.deepEqual([r.status, r.body.code], [502, 'IA_INVALIDE'])
  assert.equal((await api('pro', 'GET', '/api/quiz/ia/etat')).body.utilisees, avant)
})

test('anti-abus : plafond d\'appels par heure (échecs compris)', async () => {
  process.env.IA_REQUETES_PAR_HEURE = '3' // le compte PRO en a déjà fait 3
  setFournisseurPourTests(creerStub())
  const r = await api('pro', 'POST', '/api/quiz/ia/generer', demande)
  assert.deepEqual([r.status, r.body.code], [429, 'IA_TROP_VITE'])
  delete process.env.IA_REQUETES_PAR_HEURE
})

test('budget quotidien global atteint → 429', async () => {
  process.env.IA_BUDGET_JOUR_USD = '0.01'
  const r = await api('entreprise', 'POST', '/api/quiz/ia/generer', demande)
  assert.deepEqual([r.status, r.body.code], [429, 'IA_BUDGET'])
  delete process.env.IA_BUDGET_JOUR_USD
})

test('enregistrement : le serveur rejoue le contrôle sur ce que l\'utilisateur a modifié', async () => {
  const casse = structuredClone(brouillon)
  casse.questions[0].reponse = 'Une réponse absente des choix'
  const ko = await api('pro', 'POST', '/api/quiz', casse)
  assert.deepEqual([ko.status, ko.body.index], [400, 0])

  const media = await prisma.media.findFirst({ where: { type: 'AUDIO', prive: false } })
  const img = await prisma.media.findFirst({ where: { type: 'IMAGE', prive: false } })
  const ok = structuredClone(brouillon)
  if (media) ok.questions[1].media = { id: media.id }      // Vrai/Faux + audio
  if (img) ok.questions[0].media = { id: img.id }          // QCM + image
  ok.questions[2].media = { id: 'identifiant-invente' }    // ignoré
  const r = await api('pro', 'POST', '/api/quiz', ok)
  assert.equal(r.status, 201)
  quizId = r.body.id
  assert.deepEqual([r.body.nbQuestions, r.body.origine], [10, 'IA'])

  const relu = (await api('pro', 'GET', `/api/quiz/${quizId}`)).body
  assert.deepEqual(relu.questions.map(q => q.mecanique), brouillon.questions.map(q => q.mecanique))
  assert.equal(relu.questions[2].media, null)
  if (media) assert.deepEqual([relu.questions[1].mecanique, relu.questions[1].media.type], ['VRAI_FAUX', 'AUDIO'])
  if (img) assert.deepEqual([relu.questions[0].mecanique, relu.questions[0].media.type], ['QCM', 'IMAGE'])
  const privees = await prisma.question.count({ where: { createdById: users.pro.id, publique: true } })
  assert.equal(privees, 0, 'les questions d\'un quiz personnel ne sont jamais publiques')
})

test('quiz privé : absent du catalogue, illisible et injouable pour un autre compte', async () => {
  const cat = (await api('entreprise', 'GET', '/api/packs')).body
  assert.ok(![...cat.packs, ...cat.signatures].some(p => p.id === quizId))
  assert.ok((await api('pro', 'GET', '/api/quiz')).body.quiz.some(q => q.id === quizId))
  assert.equal((await api('entreprise', 'GET', `/api/quiz/${quizId}`)).status, 403)
  assert.equal((await api('entreprise', 'PUT', `/api/quiz/${quizId}`, brouillon)).status, 403)
  assert.equal((await api('entreprise', 'DELETE', `/api/quiz/${quizId}`)).status, 403)
  const r = await api('entreprise', 'POST', `/api/packs/${quizId}/start`, { gameMode: 'auto', solo: true })
  assert.deepEqual([r.status, r.body.code], [403, 'PACK_PRIVE'])
})

test('lancement par le moteur existant : la partie reçoit exactement les questions du quiz', async () => {
  const r = await api('pro', 'POST', `/api/packs/${quizId}/start`, { gameMode: 'auto', solo: true, modeDistanciel: true })
  assert.equal(r.status, 201)
  const manches = await prisma.manche.findMany({ where: { partieId: r.body.id }, include: { mancheQuestions: { orderBy: { ordre: 'asc' }, include: { question: true } } } })
  assert.equal(manches.length, 1)
  assert.deepEqual(manches[0].mancheQuestions.map(mq => mq.question.enonce), brouillon.questions.map(q => q.enonce))
  // L'API de partie ne laisse jamais fuiter la réponse avant la fin.
  const vue = (await api('pro', 'GET', `/api/parties/${r.body.id}`)).body
  assert.ok(vue.manches[0].mancheQuestions.every(mq => mq.question.reponse === undefined))
})

test('modification puis suppression : les questions déjà jouées sont conservées pour l\'historique', async () => {
  const maj = structuredClone(brouillon)
  maj.titre = 'Titre corrigé'
  maj.questions = maj.questions.slice(0, 4).reverse()
  const r = await api('pro', 'PUT', `/api/quiz/${quizId}`, maj)
  assert.deepEqual([r.status, r.body.nom, r.body.nbQuestions], [200, 'Titre corrigé', 4])
  const relu = (await api('pro', 'GET', `/api/quiz/${quizId}`)).body
  assert.deepEqual(relu.questions.map(q => q.enonce), maj.questions.map(q => q.enonce))
  assert.equal((await api('pro', 'DELETE', `/api/quiz/${quizId}`)).status, 200)
  assert.equal((await api('pro', 'GET', `/api/quiz/${quizId}`)).status, 404)
  const restantes = await prisma.question.count({ where: { createdById: users.pro.id } })
  assert.equal(restantes, 10, 'seules les 10 questions de la partie jouée subsistent')
})

test('FREE : 3 quiz enregistrés au plus (création manuelle comprise)', async () => {
  const manuel = { titre: 'Quiz maison', questions: [{ enonce: 'Combien font deux plus deux ?', mecanique: 'REPONSE_LIBRE', reponse: 'Quatre' }] }
  for (let i = 0; i < 3; i++) assert.equal((await api('free', 'POST', '/api/quiz', manuel)).status, 201)
  const r = await api('free', 'POST', '/api/quiz', manuel)
  assert.deepEqual([r.status, r.body.code], [402, 'QUIZ_LIMITE'])
  assert.equal((await api('free', 'GET', '/api/quiz')).body.limite, 3)
})
