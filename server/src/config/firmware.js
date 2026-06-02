// ── CONFIGURATION FIRMWARE / OTA ──────────────────────────────────────────────
// Cible de mise à jour des buzzers. Modifiable à chaud via l'API admin
// (/api/admin/firmware), réinitialisée depuis l'environnement au démarrage.
//
//   OTA_ENABLED=false
//   FIRMWARE_LATEST_VERSION=esp32-1.0
//   FIRMWARE_URL=https://.../gbairai_buzzer.bin
//
// L'OTA est POUSSÉ à un buzzer (sendToBuzzer) uniquement s'il est :
//   • activé (enabled), • non en jeu (pas IN_GAME), • et obsolète (version != cible).

const state = {
  enabled: process.env.OTA_ENABLED === 'true',
  version: process.env.FIRMWARE_LATEST_VERSION || 'esp32-1.0',
  url: process.env.FIRMWARE_URL || '',
}

export function getFirmwareConfig() {
  return { ...state }
}

export function setFirmwareConfig({ enabled, version, url }) {
  if (typeof enabled === 'boolean') state.enabled = enabled
  if (typeof version === 'string' && version.trim()) state.version = version.trim()
  if (typeof url === 'string') state.url = url.trim()
  return getFirmwareConfig()
}

// Faut-il proposer une mise à jour à un buzzer qui rapporte `reported` ?
export function otaAvailableFor(reported) {
  return !!(state.enabled && state.url && reported !== state.version)
}
