// Tests d'intégration du paiement (base réelle, CinetPay simulé par un faux
// `fetch` : aucun appel réseau). Vérifie que seul le statut redemandé à
// CinetPay active une offre, et que la démonstration est fermée en production.
//   DATABASE_URL=… JWT_SECRET=test node --test --test-force-exit tests/paiement.integration.test.js
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET ||= 'test-secret'
// CinetPay configuré AVANT le chargement des modules (lu à l'import).
process.env.CINETPAY_ENABLED = 'true'
process.env.CINETPAY_API_KEY = 'sk_test_gbairai'
process.env.CINETPAY_API_PASSWORD = 'mot-de-passe-test'

const { prisma } = await import('../src/utils/prisma.js')
const { default: billingRoutes } = await import('../src/routes/billing.js')
const { setFetchPourTests } = await import('../src/services/cinetpayClient.js')
const { cinetpayConfig, simulationAutorisee, modePaiement } = await import('../src/config/cinetpay.js')

const app = express()
app.use(express.json())
app.use('/api/billing', billingRoutes)

let server, base, offre
const tag = `p${Date.now()}`
const users = {}

// ── Faux CinetPay ────────────────────────────────────────────────────────────
const cinet = { statuts: new Map(), appels: [], connexions: 0, initEchoue: false }
function fauxFetch(url, opts) {
  const u = new URL(url)
  cinet.appels.push(`${opts.method} ${u.pathname}`)
  const rep = (http, corps) => Promise.resolve({ status: http, json: async () => corps })
  if (u.pathname === '/v1/oauth/login') {
    const b = JSON.parse(opts.body)
    cinet.connexions++
    if (b.api_key !== 'sk_test_gbairai') return rep(401, { code: 1005, status: 'INVALID_CREDENTIALS' })
    return rep(200, { code: 200, status: 'OK', access_token: 'jeton-jwt', token_type: 'bearer', expires_in: 86400 })
  }
  if (opts.headers.Authorization !== 'Bearer jeton-jwt') return rep(401, { code: 1002, status: 'INVALID_TOKEN' })
  if (opts.method === 'POST' && u.pathname === '/v1/payment') {
    if (cinet.initEchoue) return rep(400, { code: 1004, status: 'INVALID_PARAMS', description: 'amount invalide' })
    const b = JSON.parse(opts.body)
    const tx = `tx-${b.merchant_transaction_id}`
    cinet.statuts.set(tx, { ref: b.merchant_transaction_id, status: 'PENDING' })
    cinet.dernierCorps = b
    return rep(200, {
      code: 200, status: 'OK', payment_token: `pt-${tx}`, notify_token: `nt-${tx}`,
      transaction_id: tx, merchant_transaction_id: b.merchant_transaction_id,
      payment_url: `https://checkout.cinetpay.net/${tx}`,
      details: { code: 2001, status: 'INITIATED', message: '', must_be_redirected: true },
    })
  }
  const m = u.pathname.match(/^\/v1\/payment\/(.+)$/)
  if (opts.method === 'GET' && m) {
    const id = decodeURIComponent(m[1])
    const t = cinet.statuts.get(id) ?? [...cinet.statuts.entries()].find(([, v]) => v.ref === id)?.[1]
    if (!t) return rep(404, { code: 404, status: 'NOT_FOUND', description: 'introuvable' })
    const codes = { SUCCESS: 100, PENDING: 2002, FAILED: 2010 }
    const corps = { code: codes[t.status], status: t.status, merchant_transaction_id: t.ref, transaction_id: id }
    if (t.status === 'FAILED') corps.description = 'Paiement refusé'
    return rep(200, corps)
  }
  return rep(404, { code: 404, status: 'NOT_FOUND' })
}

async function api(nom, methode, chemin, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (nom) headers.Authorization = `Bearer ${jwt.sign({ sub: users[nom].id }, process.env.JWT_SECRET)}`
  const r = await fetch(base + chemin, { method: methode, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const notifier = (corps) => api(null, 'POST', '/api/billing/webhook', corps)

before(async () => {
  setFetchPourTests(fauxFetch)
  for (const n of ['ali', 'bintou']) {
    users[n] = await prisma.user.create({ data: { email: `${tag}-${n}@test.gbairai`, prenom: n === 'ali' ? 'Ali' : 'B', nom: 'Koné', emailVerified: true } })
  }
  offre = await prisma.offre.create({ data: { code: `${tag}-PRO`, nom: 'Premium test', plan: 'PRO', prix: 5000, dureeJours: 30, visible: true } })
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  const ids = Object.values(users).map(u => u.id)
  await prisma.subscription.deleteMany({ where: { userId: { in: ids } } })
  await prisma.paiement.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.offre.delete({ where: { id: offre.id } })
  setFetchPourTests(null)
  server.close()
  await prisma.$disconnect()
})

test('configuration : bac à sable déduit de la clé, mode réel, démonstration fermée', () => {
  assert.equal(cinetpayConfig.baseUrl, 'https://api.cinetpay.net')
  assert.equal(modePaiement(), 'reel')
  assert.equal(simulationAutorisee(), false)
})

let ref
test('souscription : page de paiement CinetPay, rien d\'activé tant que non payé', async () => {
  const r = await api('ali', 'POST', '/api/billing/subscribe', { offreId: offre.id })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  ref = r.body.reference
  assert.ok(ref.length <= 30, 'merchant_transaction_id ≤ 30 caractères')
  assert.equal(r.body.checkout.url, `https://checkout.cinetpay.net/tx-${ref}`)
  assert.equal(r.body.checkout.simulated, undefined)
  assert.deepEqual(
    [cinet.dernierCorps.amount, cinet.dernierCorps.currency, cinet.dernierCorps.client_first_name, cinet.dernierCorps.client_last_name, cinet.dernierCorps.channel],
    [5000, 'XOF', 'Ali', 'Koné', 'PUSH'],
  )
  // Prénom d'une lettre : remplacé par une valeur acceptée (2 caractères minimum).
  await api('bintou', 'POST', '/api/billing/subscribe', { offreId: offre.id })
  assert.equal(cinet.dernierCorps.client_first_name, 'Client')

  const u = await prisma.user.findUnique({ where: { id: users.ali.id } })
  assert.equal(u.plan, 'FREE')
  const suivi = await api('ali', 'GET', `/api/billing/paiements/${ref}`)
  assert.deepEqual([suivi.body.statut, suivi.body.paymentUrl], ['PENDING', `https://checkout.cinetpay.net/tx-${ref}`])
  assert.equal((await api('bintou', 'GET', `/api/billing/paiements/${ref}`)).status, 404, 'paiement d\'un autre compte')
})

test('démonstration refusée quand CinetPay est actif', async () => {
  const r = await api('ali', 'POST', '/api/billing/confirm', { reference: ref, status: 'SUCCESS' })
  assert.deepEqual([r.status, r.body.code], [403, 'SIMULATION_FERMEE'])
})

test('notification : jeton faux ou incomplet refusé', async () => {
  assert.equal((await notifier({ merchant_transaction_id: ref, transaction_id: `tx-${ref}` })).status, 400)
  assert.equal((await notifier({ merchant_transaction_id: ref, transaction_id: `tx-${ref}`, notify_token: 'nt-faux-xxxxxxxxxxxxxxxxxxxxxxx' })).status, 401)
  assert.equal((await notifier({ merchant_transaction_id: 'GBR-inconnu', transaction_id: 'tx', notify_token: 'x' })).status, 401)
})

test('notification authentique mais paiement encore en attente : rien d\'activé', async () => {
  const r = await notifier({ merchant_transaction_id: ref, transaction_id: `tx-${ref}`, notify_token: `nt-tx-${ref}` })
  assert.equal(r.status, 200)
  assert.equal((await prisma.user.findUnique({ where: { id: users.ali.id } })).plan, 'FREE')
})

test('paiement confirmé par CinetPay : offre activée pour 30 jours, rejeu sans effet', async () => {
  cinet.statuts.get(`tx-${ref}`).status = 'SUCCESS'
  const r = await notifier({ merchant_transaction_id: ref, transaction_id: `tx-${ref}`, notify_token: `nt-tx-${ref}` })
  assert.equal(r.status, 200)
  const u = await prisma.user.findUnique({ where: { id: users.ali.id } })
  assert.equal(u.plan, 'PRO')
  const jours = (new Date(u.planExpireAt) - Date.now()) / 864e5
  assert.ok(jours > 29.9 && jours <= 30)
  const rejeu = await notifier({ merchant_transaction_id: ref, transaction_id: `tx-${ref}`, notify_token: `nt-tx-${ref}` })
  assert.equal(rejeu.body.deja, true)
  const p = await prisma.paiement.findUnique({ where: { reference: ref } })
  assert.deepEqual([p.statut, p.operateur], ['SUCCESS', 'CINETPAY'])
})

test('notification sans retour : la page de suivi re-vérifie auprès de CinetPay', async () => {
  const r = await api('bintou', 'GET', '/api/billing/history')
  const refB = r.body[0].reference
  cinet.statuts.get(`tx-${refB}`).status = 'FAILED'
  const suivi = await api('bintou', 'GET', `/api/billing/paiements/${refB}`)
  assert.equal(suivi.body.statut, 'FAILED')
  assert.equal((await prisma.user.findUnique({ where: { id: users.bintou.id } })).plan, 'FREE')
})

test('CinetPay refuse l\'initialisation : erreur lisible, paiement marqué échoué', async () => {
  cinet.initEchoue = true
  const r = await api('bintou', 'POST', '/api/billing/subscribe', { offreId: offre.id })
  cinet.initEchoue = false
  assert.deepEqual([r.status, r.body.code], [502, 'PAIEMENT_INDISPONIBLE'])
  const dernier = await prisma.paiement.findFirst({ where: { userId: users.bintou.id }, orderBy: { createdAt: 'desc' } })
  assert.equal(dernier.statut, 'FAILED')
})

test('jeton d\'accès CinetPay réutilisé (une seule connexion)', () => {
  assert.equal(cinet.connexions, 1)
})
