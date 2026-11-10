// Tests d'intégration « événement » (base réelle) : jeu par équipes joué de bout
// en bout par le moteur, bilan d'événement, images personnelles, logo
// d'organisation.
//   DATABASE_URL=… JWT_SECRET=test node --test --test-force-exit tests/evenement.integration.test.js
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET ||= 'test-secret'
const { prisma } = await import('../src/utils/prisma.js')
const { default: partiesRoutes } = await import('../src/routes/parties.js')
const { default: historyRoutes } = await import('../src/routes/history.js')
const { default: quizRoutes } = await import('../src/routes/quiz.js')
const { default: orgRoutes } = await import('../src/routes/organisations.js')
const { handleGameMessage } = await import('../src/ws/gameHandler.js')
const { flattenManchesServer } = await import('../src/services/gameService.js')
const { classementEquipes, construireEquipes } = await import('../src/services/teamService.js')
const { newToken } = await import('../src/services/orgService.js')

const app = express()
app.use(express.json())
app.use('/api/parties', partiesRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/quiz', quizRoutes)
app.use('/api/organisations', orgRoutes)

let server, base
const tag = `e${Date.now()}`
const users = {}
const mediasCrees = []

async function creer(nom, data = {}) {
  users[nom] = await prisma.user.create({ data: { email: `${tag}-${nom}@test.gbairai`, prenom: nom, emailVerified: true, ...data } })
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
// PNG 1×1 valide (une couleur différente par appel pour éviter la déduplication).
function png(seed) {
  const b = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  return Buffer.concat([b, Buffer.from(String(seed))]) // octets en fin de fichier : image identique, empreinte différente
}
async function envoyer(nom, chemin, contenu, type = 'image/png') {
  const fd = new FormData()
  fd.append('file', new Blob([contenu], { type }), 'image.png')
  const r = await fetch(base + chemin, { method: 'POST', headers: { Authorization: `Bearer ${jeton(nom)}` }, body: fd })
  const body = await r.json().catch(() => null)
  if (body?.image?.id) mediasCrees.push(body.image.id)
  return { status: r.status, body }
}

before(async () => {
  for (const n of ['hote', 'ami1', 'ami2', 'ami3']) await creer(n)
  await creer('free')
  await creer('pro', { plan: 'PRO', planExpireAt: new Date(Date.now() + 30 * 864e5) })
  await creer('boss', { plan: 'ENTREPRISE' })
  // Catalogue minimal (la base de test peut être vide) : une question de chaque mécanique.
  await prisma.question.createMany({ data: [
    { enonce: 'Capitale économique de la Côte d\'Ivoire ?', type: 'QCM', choix: ['Abidjan', 'Bouaké', 'Yamoussoukro'], reponse: 'Abidjan', publique: true, createdById: users.hote.id },
    { enonce: 'Le cacao est la première exportation ivoirienne.', type: 'VRAI_FAUX', choix: [], reponse: 'Vrai', publique: true, createdById: users.hote.id },
    { enonce: 'Plat ivoirien à base de manioc fermenté ?', type: 'BUZZER', choix: [], reponse: 'Attiéké', publique: true, createdById: users.hote.id },
  ] })
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  const ids = Object.values(users).map(u => u.id)
  await prisma.partie.deleteMany({ where: { creatorId: { in: ids } } })
  await prisma.pack.deleteMany({ where: { ownerId: { in: ids } } })
  await prisma.question.deleteMany({ where: { createdById: { in: ids } } })
  await prisma.media.deleteMany({ where: { createdById: { in: ids } } })
  await prisma.organisation.deleteMany({ where: { ownerId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  server.close()
  await prisma.$disconnect()
})

// ── Équipes : logique pure ───────────────────────────────────────────────────
test('équipes : construction et classement (somme, petite équipe devant à égalité)', () => {
  assert.equal(construireEquipes(1), null)
  assert.equal(construireEquipes(0), null)
  const eq = construireEquipes(3, ['Compta', '', 'RH'])
  assert.deepEqual(eq.map(e => e.nom), ['Compta', 'Feuille', 'RH'])
  assert.equal(construireEquipes(9).length, 6)
  const c = classementEquipes(construireEquipes(2), [
    { equipe: 0, score: 100 }, { equipe: 0, score: 0 }, { equipe: 1, score: 100 },
    { equipe: null, score: 999, isAnimateur: true },
  ])
  assert.deepEqual(c.map(l => [l.nom, l.score, l.membres, l.rang]), [['Feuille', 100, 1, 1], ['Soleil', 100, 2, 2]])
})

// ── Équipes : partie complète jouée par le moteur ────────────────────────────
let partie
test('salle d\'attente : répartition équilibrée, choix d\'équipe, droits', async () => {
  const r = await api('hote', 'POST', '/api/parties', { nom: 'Afterwork', mode: 'auto', modeDistanciel: true, equipes: 2, equipesNoms: ['Compta', 'Ventes'] })
  assert.equal(r.status, 201)
  partie = r.body
  assert.deepEqual(partie.equipes.map(e => e.nom), ['Compta', 'Ventes'])

  for (const n of ['ami1', 'ami2', 'ami3']) assert.ok([200, 201].includes((await api(n, 'POST', '/api/parties/join', { code: partie.code })).status))
  const p = (await api('hote', 'GET', `/api/parties/${partie.id}`)).body
  const effectifs = [0, 0]
  for (const x of p.participants) effectifs[x.equipe]++
  assert.deepEqual(effectifs, [2, 2], 'quatre joueurs → deux équipes de deux')
  assert.equal(p.branding, null)

  const moi = (n) => p.participants.find(x => x.userId === users[n].id)
  // Un joueur choisit son équipe ; il ne peut pas déplacer les autres.
  assert.equal((await api('ami1', 'PATCH', `/api/parties/${partie.id}/participants/${moi('ami1').id}/equipe`, { equipe: 1 })).status, 200)
  assert.equal((await api('ami1', 'PATCH', `/api/parties/${partie.id}/participants/${moi('ami2').id}/equipe`, { equipe: 1 })).status, 403)
  assert.equal((await api('hote', 'PATCH', `/api/parties/${partie.id}/participants/${moi('ami2').id}/equipe`, { equipe: 7 })).status, 400)
  // L'hôte remet l'équilibre : hote+ami2 = Compta, ami1+ami3 = Ventes.
  assert.equal((await api('hote', 'PATCH', `/api/parties/${partie.id}/participants/${moi('ami3').id}/equipe`, { equipe: 1 })).status, 200)
  assert.equal((await api('hote', 'PATCH', `/api/parties/${partie.id}/participants/${moi('ami2').id}/equipe`, { equipe: 0 })).status, 200)
})

test('partie par équipes jouée de bout en bout, puis bilan d\'événement', async () => {
  assert.equal((await api('hote', 'POST', `/api/parties/${partie.id}/manches`, { nom: 'Culture', nbQuestions: 3, tempsLimite: 30 })).status, 201)
  const lance = await api('hote', 'POST', `/api/parties/${partie.id}/start`)
  assert.equal(lance.status, 200, JSON.stringify(lance.body))

  const full = await prisma.partie.findUnique({
    where: { id: partie.id },
    include: { participants: true, manches: { include: { mancheQuestions: { include: { question: true } } } } },
  })
  const questions = flattenManchesServer(full.manches)
  assert.ok(questions.length >= 2, 'le catalogue de test doit fournir des questions')
  const pid = (n) => full.participants.find(x => x.userId === users[n].id).id
  const diffusions = []
  const ctx = { broadcast: (_c, m) => diffusions.push(m), sendToUser: () => {}, sendToBuzzer: () => {} }
  const ws = (n) => ({ readyState: 1, send: () => {}, _gbairai: { userId: users[n].id } })
  const attendre = (ms) => new Promise(r => setTimeout(r, ms))

  // Bonne réponse pour une question à choix = son texte ; sinon la réponse libre.
  // Mauvaise réponse : un texte sans rapport.
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const bonne = Array.isArray(q.choices) && q.choices.length ? String(q.choices.findIndex(c => c.correct)) : q.reponse
    // Compta : hote juste, ami2 faux. Ventes : ami1 juste, ami3 faux.
    // Tricheries refusées : répondre au nom d'un autre, piloter la partie sans être l'hôte.
    await handleGameMessage(ws('ami3'), { type: 'submit_answer', partieCode: partie.code, participantId: pid('ami1'), answer: 'zzz-faux' }, ctx)
    await handleGameMessage(ws('ami2'), { type: 'next_question', partieCode: partie.code }, ctx)
    await handleGameMessage(ws('ami2'), { type: 'validate_answer', partieCode: partie.code, participantId: pid('ami2'), valide: true }, ctx)

    await handleGameMessage(ws('hote'), { type: 'submit_answer', partieCode: partie.code, participantId: pid('hote'), answer: bonne }, ctx)
    await handleGameMessage(ws('ami2'), { type: 'submit_answer', partieCode: partie.code, participantId: pid('ami2'), answer: 'zzz-faux' }, ctx)
    await handleGameMessage(ws('ami1'), { type: 'submit_answer', partieCode: partie.code, participantId: pid('ami1'), answer: bonne }, ctx)
    await handleGameMessage(ws('ami3'), { type: 'submit_answer', partieCode: partie.code, participantId: pid('ami3'), answer: 'zzz-faux' }, ctx)
    // Mode automatique : tout le monde a répondu → le serveur révèle seul.
    await attendre(250)
    // L'hôte passe à la suite sans attendre le compte à rebours.
    await handleGameMessage(ws('hote'), { type: 'next_question', partieCode: partie.code }, ctx)
  }
  await attendre(3500) // aucun enchaînement fantôme ne doit survenir après la fin

  const fin = await prisma.partie.findUnique({ where: { id: partie.id }, include: { participants: true } })
  assert.equal(fin.status, 'TERMINEE')
  const scoreDe = (n) => fin.participants.find(x => x.userId === users[n].id).score
  assert.equal(scoreDe('ami2'), 0, 'auto-validation refusée : aucun point pour un joueur toujours faux')
  assert.equal(scoreDe('ami3'), 0)
  assert.ok(scoreDe('ami1') > 0, 'la réponse usurpée n\'a pas verrouillé celle du vrai joueur')

  const h = await api('ami3', 'GET', `/api/history/${partie.id}`)
  assert.equal(h.status, 200)
  const { bilan, equipes, manches } = h.body
  assert.equal(bilan.tauxReussite, 50, 'deux bonnes réponses sur quatre à chaque question')
  assert.equal(bilan.totalReponses, questions.length * 4)
  assert.equal(equipes.length, 2)
  assert.ok(equipes.every(e => e.membres === 2))
  // Chaque équipe a un joueur juste à chaque question : les scores ne dépendent
  // que de la rapidité, et l'équipe classée première a le plus de points.
  assert.ok(equipes[0].score >= equipes[1].score && equipes[1].score > 0)
  const somme = fin.participants.filter(p => p.equipe === equipes[0].index).reduce((s, p) => s + p.score, 0)
  assert.equal(equipes[0].score, somme, 'score d\'équipe = somme des membres')
  for (const q of manches.flatMap(m => m.questions)) assert.equal(q.tauxReussite, 50)
  assert.ok(bilan.plusDeBonnes.bonnes === questions.length)
  assert.ok(diffusions.some(m => m.type === 'answers_update'))
})

test('partie solo : jamais d\'équipes', async () => {
  const r = await api('hote', 'POST', '/api/parties', { nom: 'Solo', mode: 'auto', solo: true, equipes: 3 })
  assert.equal(r.status, 201)
  assert.equal(r.body.equipes, null)
})

test('équipes modifiables avant le lancement, joueurs replacés', async () => {
  const r = await api('hote', 'POST', '/api/parties', { nom: 'Séminaire', mode: 'animateur', equipes: 3 })
  const id = r.body.id
  await api('ami1', 'POST', '/api/parties/join', { code: r.body.code })
  await api('ami2', 'POST', '/api/parties/join', { code: r.body.code })
  let p = (await api('hote', 'GET', `/api/parties/${id}`)).body
  assert.equal(p.participants.find(x => x.isAnimateur).equipe, null, 'le maître du jeu n\'a pas d\'équipe')
  await api('hote', 'PATCH', `/api/parties/${id}`, { equipes: 2 })
  p = (await api('hote', 'GET', `/api/parties/${id}`)).body
  assert.equal(p.equipes.length, 2)
  assert.ok(p.participants.filter(x => !x.isAnimateur).every(x => x.equipe === 0 || x.equipe === 1))
  await api('hote', 'PATCH', `/api/parties/${id}`, { equipes: 0 })
  p = (await api('hote', 'GET', `/api/parties/${id}`)).body
  assert.equal(p.equipes, null)
  assert.ok(p.participants.every(x => x.equipe === null))
})

// ── Images personnelles ───────────────────────────────────────────────────────
test('images : réservées à Premium, privées, supprimables si inutilisées', async () => {
  const refus = await envoyer('free', '/api/quiz/images', png(1))
  assert.deepEqual([refus.status, refus.body.code], [402, 'IMAGES_PREMIUM'])

  const pasImage = await envoyer('pro', '/api/quiz/images', Buffer.from('hello'), 'text/plain')
  assert.equal(pasImage.status, 400)

  const ok = await envoyer('pro', '/api/quiz/images', png(2))
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  const image = ok.body.image
  assert.equal((await api('pro', 'GET', '/api/quiz/images')).body.images[0].id, image.id)
  assert.equal((await api('free', 'GET', '/api/quiz/images')).body.images.length, 0)

  // Hors de la médiathèque publique.
  const recherche = await api('pro', 'GET', `/api/quiz/medias?q=${encodeURIComponent('image')}`)
  assert.ok(!recherche.body.medias.some(m => m.id === image.id))

  const question = { enonce: 'Quelle est cette couleur ?', mecanique: 'REPONSE_LIBRE', reponse: 'Rouge', media: { id: image.id } }
  // Un autre compte ne peut pas utiliser cette image : le média est ignoré.
  const autre = await api('boss', 'POST', '/api/quiz', { titre: 'Vol', questions: [question] })
  assert.equal(autre.status, 201)
  const qAutre = await prisma.question.findFirst({ where: { createdById: users.boss.id } })
  assert.equal(qAutre.mediaId, null)

  const mien = await api('pro', 'POST', '/api/quiz', { titre: 'Mes couleurs', questions: [question] })
  assert.equal(mien.status, 201)
  const qMien = await prisma.question.findFirst({ where: { createdById: users.pro.id } })
  assert.equal(qMien.mediaId, image.id)

  assert.equal((await api('pro', 'DELETE', `/api/quiz/images/${image.id}`)).status, 409, 'image encore utilisée')
  assert.equal((await api('boss', 'DELETE', `/api/quiz/images/${image.id}`)).status, 404, 'pas la sienne')
  const libre = await envoyer('pro', '/api/quiz/images', png(3))
  assert.equal((await api('pro', 'DELETE', `/api/quiz/images/${libre.body.image.id}`)).status, 200)
})

// ── Logo d'organisation ───────────────────────────────────────────────────────
test('logo : posé par le responsable, affiché sur les parties des membres', async () => {
  const org = await prisma.organisation.create({
    data: {
      nom: 'Orange Test', ownerId: users.boss.id, plan: 'ENTREPRISE', sieges: 5, inviteToken: newToken(),
      membres: { create: [{ userId: users.boss.id, role: 'RESPONSABLE', statut: 'ACTIF' }, { userId: users.ami1.id, role: 'MEMBRE', statut: 'ACTIF' }] },
    },
  })
  const refus = await envoyer('ami1', `/api/organisations/${org.id}/logo`, png(4))
  assert.equal(refus.status, 403)
  const ok = await envoyer('boss', `/api/organisations/${org.id}/logo`, png(5))
  assert.equal(ok.status, 200)
  assert.match(ok.body.logoUrl, /^\/uploads\//)

  // Une partie créée par un membre porte le logo.
  const p = await api('ami1', 'POST', '/api/parties', { nom: 'Séminaire Orange', mode: 'auto' })
  const vue = await api('ami2', 'GET', `/api/parties/by-code/${p.body.code}`)
  assert.deepEqual(vue.body.branding, { nom: 'Orange Test', logoUrl: ok.body.logoUrl })

  // Organisation suspendue : plus de logo.
  await prisma.organisation.update({ where: { id: org.id }, data: { statut: 'SUSPENDED' } })
  assert.equal((await api('ami2', 'GET', `/api/parties/by-code/${p.body.code}`)).body.branding, null)
  await prisma.organisationMembre.deleteMany({ where: { organisationId: org.id } })
})
