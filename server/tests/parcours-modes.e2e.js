// Parcours de bout en bout sur un serveur EN MARCHE, par de vraies connexions
// WebSocket : mode animateur (avec un buzzer matériel simulé et une équipe),
// mode vote de la salle, contrôle d'accès des commandes.
//   BASE=http://localhost:4100 DATABASE_URL=… JWT_SECRET=<celui du serveur> node tests/parcours-modes.e2e.js
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'

const BASE = process.env.BASE ?? 'http://localhost:4100'
const WS_URL = BASE.replace(/^http/, 'ws')
const { prisma } = await import('../src/utils/prisma.js')
const tag = `e2e${Date.now()}`
const users = {}
const attendre = (ms) => new Promise(r => setTimeout(r, ms))

async function creer(nom, data = {}) {
  users[nom] = await prisma.user.create({ data: { email: `${tag}-${nom}@test.gbairai`, prenom: nom, emailVerified: true, ...data } })
}
const jeton = (nom) => jwt.sign({ sub: users[nom].id }, process.env.JWT_SECRET, { expiresIn: '1h' })
async function api(nom, methode, chemin, body) {
  const r = await fetch(`${BASE}/api${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton(nom)}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const b = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${methode} ${chemin} → ${r.status} ${JSON.stringify(b)}`)
  return b
}

// Client WebSocket qui mémorise les messages reçus et sait en attendre un.
function client({ nom = null, mac = null, code }) {
  const ws = new WebSocket(WS_URL)
  const recus = []
  const attentes = []
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    recus.push(m)
    for (const a of [...attentes]) if (a.filtre(m)) { attentes.splice(attentes.indexOf(a), 1); a.resolve(m) }
  })
  const pret = new Promise((res) => ws.on('open', async () => {
    if (nom) { ws.send(JSON.stringify({ type: 'auth', token: jeton(nom) })); await attendre(80) }
    if (mac) { ws.send(JSON.stringify({ type: 'buzzer_hello', mac, firmware: 'esp32-test' })); await attendre(150) }
    if (code) { ws.send(JSON.stringify({ type: 'join_room', partieCode: code })); await attendre(100) }
    res()
  }))
  return {
    pret, recus, ws,
    envoyer: (m) => ws.send(JSON.stringify(m)),
    attendre: (type, cond = () => true, ms = 6000) => new Promise((resolve, reject) => {
      const deja = recus.find(m => m.type === type && cond(m) && !m._lu)
      if (deja) { deja._lu = true; return resolve(deja) }
      const t = setTimeout(() => reject(new Error(`« ${type} » non reçu`)), ms)
      attentes.push({ filtre: (m) => m.type === type && cond(m), resolve: (m) => { clearTimeout(t); m._lu = true; resolve(m) } })
    }),
    vider: () => recus.forEach(m => { m._lu = true }),
    fermer: () => ws.close(),
  }
}

const mac = `AA:BB:CC:${String(Date.now() % 100).padStart(2, '0')}:E2:01`
let ok = 0
const etape = (t) => { ok++; console.log(`  ✓ ${t}`) }

try {
  for (const n of ['hote', 'awa', 'yao', 'koffi']) await creer(n)
  const buzzer = await prisma.buzzer.create({ data: { mac, nom: 'Buzzer rouge', couleur: '#E53935', ownerId: users.hote.id, claimedAt: new Date() } })

  // ── 1. MODE ANIMATEUR, équipes, buzzer matériel ──────────────────────────
  console.log('Mode animateur (maquis, grand écran, buzzer) :')
  const p = await api('hote', 'POST', '/parties', { nom: 'Soirée maquis', mode: 'animateur', modeDistanciel: false, equipes: 2 })
  await api('awa', 'POST', '/parties/join', { code: p.code })
  await api('yao', 'POST', '/parties/join', { code: p.code })
  const kofi = await api('hote', 'POST', `/parties/${p.id}/participants/invite`, { prenom: 'Kofi' })
  const boitier = client({ mac })
  await boitier.pret
  assert.equal((await prisma.buzzer.findUnique({ where: { mac } })).status, 'ONLINE')
  await api('hote', 'POST', `/parties/${p.id}/participants/${kofi.id}/assign-buzzer`, { buzzerId: buzzer.id })
  await api('hote', 'POST', `/parties/${p.id}/manches`, { nom: 'Culture', nbQuestions: 3, tempsLimite: 30, typesAutorises: ['BUZZER'] })
  etape('salle prête : 3 joueurs, 1 buzzer matériel attribué à un invité sans téléphone')

  const regie = client({ nom: 'hote', code: p.code })
  const ecran = client({ nom: 'hote', code: p.code })
  const awa = client({ nom: 'awa', code: p.code })
  const yao = client({ nom: 'yao', code: p.code })
  await Promise.all([regie.pret, ecran.pret, awa.pret, yao.pret])
  const vue = await api('hote', 'GET', `/parties/${p.id}`)
  const pid = (n) => vue.participants.find(x => x.userId === users[n].id).id

  await api('hote', 'POST', `/parties/${p.id}/start`)
  const q1 = await ecran.attendre('question_display')
  assert.equal(q1.index, 0)
  assert.equal(q1.question.reponse, undefined, 'la réponse ne part jamais vers l\'écran avant la révélation')
  await boitier.attendre('led', m => m.state === 'armed')
  etape('lancement : 1re question sur l\'écran, LED du buzzer « prêt »')

  // Q1 — le buzzer matériel de Kofi buzze, l'animateur valide.
  boitier.envoyer({ type: 'buzz', source: 'device', mac })
  const w1 = await ecran.attendre('buzzer_winner')
  assert.equal(w1.prenom, 'Kofi')
  await boitier.attendre('led', m => m.state === 'winner')
  // Un joueur tente de valider et de passer à la suite : ignoré.
  awa.envoyer({ type: 'validate_answer', partieCode: p.code, participantId: pid('awa'), valide: true })
  awa.envoyer({ type: 'next_question', partieCode: p.code })
  await attendre(300)
  assert.ok(!ecran.recus.some(m => m.type === 'answer_validated'), 'validation par un joueur refusée')
  assert.ok(!ecran.recus.some(m => m.type === 'question_display' && m.index === 1), 'avancement par un joueur refusé')
  regie.envoyer({ type: 'validate_answer', partieCode: p.code, participantId: kofi.id, valide: true })
  const v1 = await ecran.attendre('answer_validated')
  assert.ok(v1.valide && v1.points > 0)
  const r1 = await ecran.attendre('question_reveal')
  assert.ok(r1.reponse)
  const maj = await ecran.attendre('participant_update', m => m.participants.find(x => x.id === kofi.id)?.score > 0)
  assert.equal(maj.equipes.length, 2, 'classement des équipes diffusé')
  assert.ok(!maj.participants.some(x => x.userId === users.hote.id), 'l\'animateur reste hors classement')
  etape('buzz matériel → gagnant Kofi, triche refusée, validation par l\'animateur, équipes à jour')

  // Q2 — Awa buzze du téléphone, se trompe ; le buzz rouvre ; Yao vole la question.
  regie.envoyer({ type: 'next_question', partieCode: p.code })
  await ecran.attendre('question_display', m => m.index === 1)
  // Usurpation : Yao tente de buzzer au nom d'Awa → ignoré.
  yao.envoyer({ type: 'buzz', source: 'web', partieCode: p.code, participantId: pid('awa') })
  await attendre(250)
  assert.ok(!ecran.recus.some(m => m.type === 'buzzer_winner' && !m._lu), 'buzz usurpé ignoré')
  awa.envoyer({ type: 'buzz', source: 'web', partieCode: p.code, participantId: pid('awa') })
  assert.equal((await ecran.attendre('buzzer_winner')).prenom, 'awa')
  regie.envoyer({ type: 'validate_answer', partieCode: p.code, participantId: pid('awa'), valide: false })
  await ecran.attendre('buzz_reopened')
  yao.envoyer({ type: 'buzz', source: 'web', partieCode: p.code, participantId: pid('yao') })
  assert.equal((await ecran.attendre('buzzer_winner')).prenom, 'yao')
  regie.envoyer({ type: 'validate_answer', partieCode: p.code, participantId: pid('yao'), valide: true })
  await ecran.attendre('question_reveal', m => m.index === 1)
  etape('buzz téléphone, mauvaise réponse, buzz rouvert, « vol » validé ; buzz usurpé ignoré')

  // Q3 — révélation sans gagnant, puis fin de partie.
  regie.envoyer({ type: 'next_question', partieCode: p.code })
  await ecran.attendre('question_display', m => m.index === 2)
  regie.envoyer({ type: 'reveal_question', partieCode: p.code })
  await ecran.attendre('question_reveal', m => m.index === 2)
  regie.envoyer({ type: 'next_question', partieCode: p.code })
  const fin = await ecran.attendre('game_ended')
  assert.equal(fin.classement.length, 3)
  assert.equal(fin.equipes.length, 2)
  assert.ok(fin.classement.every(c => c.equipe === 0 || c.equipe === 1))
  await boitier.attendre('led', m => m.state === 'idle')
  const bil = await api('awa', 'GET', `/history/${p.id}`)
  assert.equal(bil.bilan.totalReponses, 3, 'trois réponses jugées (une fausse, deux justes)')
  assert.equal(bil.bilan.tauxReussite, 67)
  etape('révélation manuelle, fin : podium, équipes, LED éteinte, bilan (67 % de réussite)')
  for (const c of [regie, ecran, awa, yao, boitier]) c.fermer()

  // ── 2. MODE VOTE DE LA SALLE ─────────────────────────────────────────────
  console.log('Mode vote de la salle :')
  const pv = await api('hote', 'POST', '/parties', { nom: 'Vote', mode: 'vote', modeDistanciel: false })
  await api('awa', 'POST', '/parties/join', { code: pv.code })
  await api('hote', 'POST', `/parties/${pv.id}/manches`, { nom: 'M1', nbQuestions: 1, tempsLimite: 30, typesAutorises: ['BUZZER'] })
  await assert.rejects(api('hote', 'POST', `/parties/${pv.id}/start`), /VOTE_MIN_JOUEURS/)
  await api('yao', 'POST', '/parties/join', { code: pv.code })
  const vh = client({ nom: 'hote', code: pv.code }), va = client({ nom: 'awa', code: pv.code }), vy = client({ nom: 'yao', code: pv.code })
  await Promise.all([vh.pret, va.pret, vy.pret])
  const vv = await api('hote', 'GET', `/parties/${pv.id}`)
  const vpid = (n) => vv.participants.find(x => x.userId === users[n].id).id
  await api('hote', 'POST', `/parties/${pv.id}/start`)
  await vh.attendre('question_display')
  etape('moins de 3 joueurs refusé, lancement à 3')

  va.envoyer({ type: 'buzz', source: 'web', partieCode: pv.code, participantId: vpid('awa') })
  await vh.attendre('buzzer_winner')
  // Awa ne peut pas voter pour elle-même ; Yao ne peut pas voter au nom de l'hôte.
  va.envoyer({ type: 'submit_vote', partieCode: pv.code, questionIndex: 0, participantId: vpid('awa'), valide: true })
  vy.envoyer({ type: 'submit_vote', partieCode: pv.code, questionIndex: 0, participantId: vpid('hote'), valide: true })
  await attendre(300)
  assert.ok(!vh.recus.some(m => m.type === 'vote_update'), 'auto-vote et vote usurpé ignorés')
  vh.envoyer({ type: 'submit_vote', partieCode: pv.code, questionIndex: 0, participantId: vpid('hote'), valide: true })
  vy.envoyer({ type: 'submit_vote', partieCode: pv.code, questionIndex: 0, participantId: vpid('yao'), valide: false })
  const res = await vh.attendre('vote_result')
  assert.deepEqual([res.pour, res.contre, res.valide], [1, 1, false], 'égalité : réponse non validée')
  const finV = await vh.attendre('game_ended', () => true, 8000)
  assert.equal(finV.classement.find(c => c.id === vpid('awa')).score, 0)
  etape('vote : auto-vote et usurpation ignorés, égalité = non validée, enchaînement automatique jusqu\'à la fin')
  for (const c of [vh, va, vy]) c.fermer()

  console.log(`\n${ok} étapes vérifiées.`)
} finally {
  const ids = Object.values(users).map(u => u.id)
  await prisma.partie.deleteMany({ where: { creatorId: { in: ids } } })
  await prisma.buzzerEvent.deleteMany({ where: { mac } }).catch(() => {})
  await prisma.buzzer.deleteMany({ where: { mac } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
}
process.exit(0)
