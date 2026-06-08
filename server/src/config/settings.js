// ──────────────────────────────────────────────────────────────────────────────
// Réglages applicatifs pilotés par l'admin (table AppSetting). Cache court (10 s)
// pour éviter de lire la base à chaque requête. Valeurs sérialisées en JSON.
// ──────────────────────────────────────────────────────────────────────────────
import { prisma } from '../utils/prisma.js'

// Réglages par défaut (utilisés si la clé n'existe pas encore en base).
export const DEFAULT_SETTINGS = {
  // Vérification email à l'inscription : envoie le mail + emailVerified=false.
  // false → les comptes sont auto-vérifiés (aucun mail).
  emailVerifyOnRegister: true,
  // Vérification téléphone (OTP SMS) à l'inscription par numéro.
  phoneVerifyOnRegister: true,
  // Bloque les actions sensibles (abonnement / achat) tant qu'aucun contact
  // (email OU téléphone) n'est vérifié.
  emailBlockUnverifiedActions: true,
  // Plans dont la connexion EXIGE un contact vérifié (email OU téléphone).
  // Tableau parmi : 'PRO','ENTREPRISE','ECOLE'. Vide = aucun.
  emailRequireVerifiedLoginPlans: [],
}

let _cache = { at: 0, data: null }
const TTL = 10_000

export async function getSettings() {
  if (_cache.data && Date.now() - _cache.at < TTL) return _cache.data
  const rows = await prisma.appSetting.findMany()
  const stored = {}
  for (const r of rows) { try { stored[r.key] = JSON.parse(r.value) } catch { stored[r.key] = r.value } }
  const data = { ...DEFAULT_SETTINGS, ...stored }
  _cache = { at: Date.now(), data }
  return data
}

export async function updateSettings(patch) {
  // Ne garde que les clés connues (évite la pollution).
  const ops = []
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue
    const v = JSON.stringify(value)
    ops.push(prisma.appSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } }))
  }
  await Promise.all(ops)
  _cache = { at: 0, data: null } // invalide le cache
  return getSettings()
}
