// ── CONFIGURATION CINETPAY ────────────────────────────────────────────────────
// Préparation de l'intégration paiement. RIEN n'est activé tant que
// CINETPAY_ENABLED !== 'true'. Les identifiants sont lus depuis l'environnement.
//
// Variables .env attendues (à renseigner lors de l'activation réelle) :
//   CINETPAY_ENABLED=false
//   CINETPAY_API_KEY=...
//   CINETPAY_SITE_ID=...
//   CINETPAY_SECRET_KEY=...        (vérification HMAC du webhook)
//   CINETPAY_MODE=PRODUCTION|TEST
//   CINETPAY_NOTIFY_URL=https://api.gbairai.ci/api/billing/webhook
//   CINETPAY_RETURN_URL=https://gbairai.ci/abonnement/confirmation

export const cinetpayConfig = {
  enabled: process.env.CINETPAY_ENABLED === 'true',
  apiKey: process.env.CINETPAY_API_KEY || '',
  siteId: process.env.CINETPAY_SITE_ID || '',
  secretKey: process.env.CINETPAY_SECRET_KEY || '',
  mode: process.env.CINETPAY_MODE || 'TEST',
  // Endpoint officiel d'initiation de paiement CinetPay v2.
  apiUrl: 'https://api-checkout.cinetpay.com/v2/payment',
  notifyUrl: process.env.CINETPAY_NOTIFY_URL || 'http://localhost:4000/api/billing/webhook',
  returnUrl: process.env.CINETPAY_RETURN_URL || 'http://localhost:5173/abonnement/confirmation',
  devise: 'XOF',
  lang: 'fr',
}

export function isCinetpayReady() {
  return cinetpayConfig.enabled
    && !!cinetpayConfig.apiKey
    && !!cinetpayConfig.siteId
}
