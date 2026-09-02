// ── CONFIGURATION FIRMWARE / OTA ──────────────────────────────────────────────
// Cible de mise à jour des buzzers, pilotée par l'API admin (/api/admin/firmware).
//
// PERSISTANCE : la config est stockée en base (table AppSetting) et rechargée au
// démarrage — auparavant elle ne vivait qu'en mémoire et était donc perdue à
// chaque redéploiement, alors que l'UI laissait croire à un enregistrement durable.
// L'état reste lu de façon SYNCHRONE (cache mémoire) pour ne pas alourdir les
// chemins critiques (connexion d'un buzzer, push OTA).
//
// Amorçage possible par variables d'environnement (au tout premier démarrage) :
//   OTA_ENABLED=false
//   FIRMWARE_LATEST_VERSION=esp32-1.0
//   FIRMWARE_URL=https://api.gbairai.robotechci.com/uploads/firmware/xxx.bin
//
// L'OTA est POUSSÉ à un buzzer (sendToBuzzer) uniquement s'il est :
//   • activé (enabled), • non en jeu (pas IN_GAME), • et obsolète (version != cible).
import { prisma } from '../utils/prisma.js'

const SETTING_KEY = 'firmwareOta'

const state = {
  enabled: process.env.OTA_ENABLED === 'true',
  version: process.env.FIRMWARE_LATEST_VERSION || 'esp32-1.0',
  url: process.env.FIRMWARE_URL || '',
}

// Recharge la config depuis la base au démarrage du serveur.
export async function loadFirmwareConfig() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } })
    if (row?.value) Object.assign(state, JSON.parse(row.value))
  } catch (e) {
    console.error('[firmware] chargement config OTA impossible:', e?.message)
  }
  return getFirmwareConfig()
}

export function getFirmwareConfig() {
  return { ...state }
}

export async function setFirmwareConfig({ enabled, version, url }) {
  if (typeof enabled === 'boolean') state.enabled = enabled
  if (typeof version === 'string' && version.trim()) state.version = version.trim()
  if (typeof url === 'string') state.url = url.trim()

  const value = JSON.stringify(state)
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, value },
  })
  return getFirmwareConfig()
}

// Faut-il proposer une mise à jour à un buzzer qui rapporte `reported` ?
export function otaAvailableFor(reported) {
  return !!(state.enabled && state.url && reported !== state.version)
}
