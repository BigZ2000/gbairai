// ──────────────────────────────────────────────────────────────────────────────
// Envoi de SMS (Twilio). Désactivé tant que SMS_ENABLED !== 'true' : en dev/test
// le code OTP est simplement logué dans la console (aucun envoi réel, aucun coût).
//
// Variables .env attendues :
//   SMS_ENABLED=false
//   TWILIO_ACCOUNT_SID=ACxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxx
//   TWILIO_FROM=+1xxxxxxxxxx          (numéro Twilio ; OU…)
//   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx   (service de messagerie Twilio)
// ──────────────────────────────────────────────────────────────────────────────

const enabled = () => process.env.SMS_ENABLED === 'true'

export function smsReady() {
  return enabled() && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN
    && (!!process.env.TWILIO_FROM || !!process.env.TWILIO_MESSAGING_SERVICE_SID)
}

// Normalise un numéro ivoirien vers le format E.164 (+225XXXXXXXXXX).
// Accepte "0701020304", "+2250701020304", "225 07 01 02 03 04"… → "+2250701020304".
export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (!d.startsWith('225')) d = '225' + d        // indicatif CI par défaut
  if (d.length < 11 || d.length > 15) return null // garde-fou
  return '+' + d
}

// Envoi générique. Simulé si SMS désactivé/incomplet → log console + succès simulé.
export async function sendSms(to, body) {
  if (!smsReady()) {
    console.log(`[sms:dev] → ${to} | ${body}`)
    return { simulated: true }
  }
  const sid = process.env.TWILIO_ACCOUNT_SID
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const params = new URLSearchParams({ To: to, Body: body })
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID)
  else params.set('From', process.env.TWILIO_FROM)

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Twilio ${r.status}: ${txt.slice(0, 200)}`)
  }
  const data = await r.json().catch(() => ({}))
  return { simulated: false, sid: data.sid }
}

// SMS de vérification (OTP).
export async function sendVerificationSms({ to, code }) {
  return sendSms(to, `Gbairai : ton code de verification est ${code} (valable 15 min).`)
}
