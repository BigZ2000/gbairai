// ──────────────────────────────────────────────────────────────────────────────
// Envoi d'emails via SMTP (IONOS). Désactivé tant que MAIL_ENABLED !== 'true' :
// en dev on logue simplement le contenu dans la console (aucun envoi réel).
//
// Variables .env attendues :
//   MAIL_ENABLED=false
//   SMTP_HOST=smtp.ionos.fr          (ou smtp.ionos.com)
//   SMTP_PORT=587                    (587 = STARTTLS, 465 = SSL)
//   SMTP_USER=gbairai.contact@robotechci.com
//   SMTP_PASS=...                    (mot de passe de la boîte — JAMAIS commité)
//   SMTP_FROM=Gbairai <gbairai.contact@robotechci.com>
//   APP_URL=https://gbairai.robotechci.com
// ──────────────────────────────────────────────────────────────────────────────
import nodemailer from 'nodemailer'

const enabled = process.env.MAIL_ENABLED === 'true'
const FROM = process.env.SMTP_FROM || 'Gbairai <gbairai.contact@robotechci.com>'
export const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')

let _transport = null
function transport() {
  if (_transport) return _transport
  const port = Number(process.env.SMTP_PORT || 587)
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ionos.fr',
    port,
    secure: port === 465, // 465 = SSL implicite ; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return _transport
}

export function mailReady() { return enabled && !!process.env.SMTP_USER && !!process.env.SMTP_PASS }

// Envoi générique. Si le mail est désactivé → log console (dev) et succès simulé.
async function send({ to, subject, html, text }) {
  if (!mailReady()) {
    console.log(`[mail:dev] → ${to} | ${subject}\n${text ?? ''}`)
    return { simulated: true }
  }
  return transport().sendMail({ from: FROM, to, subject, html, text })
}

// ── Email de vérification (code + lien) ───────────────────────────────────────
export async function sendVerificationEmail({ to, prenom, code, token }) {
  const link = `${APP_URL}/verifier-email?token=${encodeURIComponent(token)}`
  const subject = 'Confirme ton adresse email — Gbairai'
  const text =
`Salut ${prenom || ''},

Ton code de vérification Gbairai est : ${code}
(valable 24 h)

Ou clique sur ce lien pour confirmer :
${link}

Si tu n'es pas à l'origine de cette inscription, ignore ce message.
— L'équipe Gbairai`
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:auto;color:#18181B">
    <div style="text-align:center;padding:24px 0">
      <div style="display:inline-flex;width:40px;height:40px;border-radius:10px;background:#6366F1;color:#fff;font-weight:800;font-size:20px;align-items:center;justify-content:center;line-height:40px">G</div>
      <h1 style="font-size:20px;margin:12px 0 4px">Confirme ton email</h1>
      <p style="color:#52525B;font-size:14px;margin:0">Salut ${prenom || ''} 👋</p>
    </div>
    <div style="background:#F4F4F7;border-radius:14px;padding:24px;text-align:center">
      <p style="color:#52525B;font-size:13px;margin:0 0 8px">Ton code de vérification</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:0;color:#6366F1">${code}</p>
      <p style="color:#A1A1AA;font-size:12px;margin:8px 0 0">valable 24 heures</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${link}" style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:15px">Confirmer mon email</a>
    </div>
    <p style="color:#A1A1AA;font-size:12px;text-align:center">Si tu n'es pas à l'origine de cette inscription, ignore ce message.</p>
  </div>`
  return send({ to, subject, html, text })
}
