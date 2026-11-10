// ── CLIENT CINETPAY (API v1) ──────────────────────────────────────────────────
// Reproduit, sans dépendance, les trois appels du SDK officiel cinetpay-js :
//   POST /v1/oauth/login        → jeton Bearer (valable 24 h, mis en cache 23 h)
//   POST /v1/payment            → initialisation, URL de paiement, notify_token
//   GET  /v1/payment/:id        → statut faisant foi (SUCCESS, FAILED, PENDING…)
// `fetch` est injectable pour les tests (aucun appel réseau en test).
import { cinetpayConfig } from '../config/cinetpay.js'

export class CinetpayErreur extends Error {
  constructor(message, { code = null, statut = null, http = null } = {}) {
    super(message)
    this.code = code; this.statut = statut; this.http = http
  }
}

// Codes considérés comme « réponse normale » par le SDK officiel.
const CODES_OK = new Set([200, 100, 2001, 2002])
const JETON_EXPIRE = 1003

let _fetch = (...a) => globalThis.fetch(...a)
let _jeton = null // { valeur, expireA }

/** Tests : remplace fetch (et vide le cache du jeton). */
export function setFetchPourTests(f) { _fetch = f ?? ((...a) => globalThis.fetch(...a)); _jeton = null }

async function appel(methode, chemin, corps, jeton) {
  const controle = new AbortController()
  const minuteur = setTimeout(() => controle.abort(), 30_000)
  let rep, data
  try {
    rep = await _fetch(`${cinetpayConfig.baseUrl}${chemin}`, {
      method: methode,
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: controle.signal,
    })
    data = await rep.json().catch(() => ({}))
  } catch (e) {
    throw new CinetpayErreur(e?.name === 'AbortError' ? 'CinetPay ne répond pas' : 'CinetPay injoignable')
  } finally {
    clearTimeout(minuteur)
  }
  const code = typeof data.code === 'number' ? data.code : null
  if (rep.status >= 400 || (code != null && !CODES_OK.has(code))) {
    throw new CinetpayErreur(data.description || data.message || `Erreur CinetPay (${code ?? rep.status})`, {
      code, statut: data.status ?? null, http: rep.status,
    })
  }
  return data
}

async function jeton({ forcer = false } = {}) {
  if (!forcer && _jeton && _jeton.expireA > Date.now()) return _jeton.valeur
  let data
  try {
    data = await appel('POST', '/v1/oauth/login', {
      api_key: cinetpayConfig.apiKey, api_password: cinetpayConfig.apiPassword,
    })
  } catch {
    // Message neutre : ne jamais laisser filer d'identifiants dans une trace.
    throw new CinetpayErreur('Authentification CinetPay refusée')
  }
  if (!data.access_token) throw new CinetpayErreur('Authentification CinetPay refusée')
  _jeton = { valeur: data.access_token, expireA: Date.now() + 23 * 3600 * 1000 }
  return _jeton.valeur
}

// Rejoue une fois avec un jeton neuf si l'API répond « jeton expiré ».
async function appelAuthentifie(methode, chemin, corps) {
  try {
    return await appel(methode, chemin, corps, await jeton())
  } catch (e) {
    if (e instanceof CinetpayErreur && (e.code === JETON_EXPIRE || e.statut === 'EXPIRED_TOKEN')) {
      return appel(methode, chemin, corps, await jeton({ forcer: true }))
    }
    throw e
  }
}

// Nom au format attendu (2 à 255 caractères).
const nomValide = (s, defaut) => {
  const t = String(s ?? '').trim()
  return t.length >= 2 ? t.slice(0, 255) : defaut
}

/**
 * Initialise un paiement web.
 * @returns {{ paymentUrl, paymentToken, notifyToken, transactionId }}
 */
export async function initialiserPaiement({ reference, montant, designation, client }) {
  const data = await appelAuthentifie('POST', '/v1/payment', {
    currency: cinetpayConfig.devise,
    merchant_transaction_id: reference,           // 30 caractères au plus
    amount: montant,
    lang: cinetpayConfig.lang,
    designation: String(designation).slice(0, 255),
    client_email: client.email,
    client_first_name: nomValide(client.prenom, 'Client'),
    client_last_name: nomValide(client.nom, 'Gbairai'),
    success_url: `${cinetpayConfig.returnUrl}?ref=${encodeURIComponent(reference)}`,
    failed_url: `${cinetpayConfig.returnUrl}?ref=${encodeURIComponent(reference)}`,
    notify_url: cinetpayConfig.notifyUrl,
    channel: 'PUSH',
  })
  if (!data.payment_url) throw new CinetpayErreur('CinetPay n\'a pas renvoyé de page de paiement')
  return {
    paymentUrl: data.payment_url,
    paymentToken: data.payment_token ?? null,
    notifyToken: data.notify_token ?? null,
    transactionId: data.transaction_id ?? null,
  }
}

/**
 * Statut d'une transaction (par transaction_id, payment_token ou
 * merchant_transaction_id) — c'est lui qui fait foi, jamais la notification.
 * @returns {{ statut, reference, transactionId }}
 */
export async function statutPaiement(identifiant) {
  let data
  try {
    data = await appelAuthentifie('GET', `/v1/payment/${encodeURIComponent(identifiant)}`)
  } catch (e) {
    // L'API répond un code d'erreur pour une transaction échouée ou expirée :
    // c'est un statut, pas une panne.
    if (e instanceof CinetpayErreur && ['FAILED', 'EXPIRED', 'INSUFFICIENT_BALANCE', 'USER_IS_BLOCKED'].includes(e.statut)) {
      return { statut: e.statut, reference: null, transactionId: null }
    }
    throw e
  }
  return {
    statut: data.status ?? null,
    reference: data.merchant_transaction_id ?? null,
    transactionId: data.transaction_id ?? null,
  }
}
