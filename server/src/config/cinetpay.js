// ── CONFIGURATION CINETPAY ────────────────────────────────────────────────────
// API CinetPay v1 (authentification par jeton, une paire de clés par pays),
// telle que décrite par le SDK officiel github.com/cinetpay/cinetpay-js.
//
//   CINETPAY_ENABLED=true
//   CINETPAY_API_KEY=sk_test_…        (sk_live_… en production)
//   CINETPAY_API_PASSWORD=…
//   CINETPAY_PAYS=CI                  (pays du compte marchand)
//   CINETPAY_NOTIFY_URL=https://api.gbairai.ci/api/billing/webhook
//   CINETPAY_RETURN_URL=https://gbairai.ci/abonnement/confirmation
//   CINETPAY_BASE_URL=…               (facultatif ; déduit du préfixe de la clé)
//
// Sans configuration complète, AUCUN paiement réel n'est possible. Le
// règlement simulé (bouton de démonstration) n'existe alors qu'en
// développement, ou si PAIEMENT_SIMULATION=true est posé explicitement :
// jamais par défaut en production, où il offrirait Premium à n'importe qui.

const apiKey = process.env.CINETPAY_API_KEY || ''

// Le préfixe de la clé désigne l'environnement (règle du SDK officiel).
function baseUrlPour(cle) {
  if (process.env.CINETPAY_BASE_URL) return process.env.CINETPAY_BASE_URL.replace(/\/$/, '')
  return cle.startsWith('sk_live_') ? 'https://api.cinetpay.co' : 'https://api.cinetpay.net'
}

export const cinetpayConfig = {
  enabled: process.env.CINETPAY_ENABLED === 'true',
  apiKey,
  apiPassword: process.env.CINETPAY_API_PASSWORD || '',
  pays: (process.env.CINETPAY_PAYS || 'CI').toUpperCase(),
  baseUrl: baseUrlPour(apiKey),
  mode: apiKey.startsWith('sk_live_') ? 'PRODUCTION' : 'TEST',
  notifyUrl: process.env.CINETPAY_NOTIFY_URL || 'http://localhost:4000/api/billing/webhook',
  returnUrl: process.env.CINETPAY_RETURN_URL || 'http://localhost:5173/abonnement/confirmation',
  devise: 'XOF',
  lang: 'fr',
  // Bornes de montant de l'API (paiement web).
  montantMin: 100,
  montantMax: 2_500_000,
}

/** Paiement réel possible : activé ET identifiants présents. */
export function isCinetpayReady() {
  return cinetpayConfig.enabled && !!cinetpayConfig.apiKey && !!cinetpayConfig.apiPassword
}

/** Règlement simulé autorisé (démonstration) : jamais quand CinetPay est actif. */
export function simulationAutorisee() {
  if (isCinetpayReady()) return false
  if (process.env.PAIEMENT_SIMULATION === 'true') return true
  if (process.env.PAIEMENT_SIMULATION === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

/** Mode de paiement exposé au client : 'reel' | 'simulation' | 'ferme'. */
export function modePaiement() {
  if (isCinetpayReady()) return 'reel'
  return simulationAutorisee() ? 'simulation' : 'ferme'
}
