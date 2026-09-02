// ── GÉOLOCALISATION IP (best-effort) ──────────────────────────────────────────
// Résout ville/pays à partir d'une IP publique, pour enrichir le journal des
// buzzers (Admin uniquement). Aucune clé requise (ip-api.com, gratuit, limité à
// 45 req/min — largement suffisant pour des évènements de connexion buzzer).
// Ignore les IP privées/locales (LAN, dev) et échoue silencieusement (le journal
// reste utile sans localité — elle n'est qu'un bonus).
const cache = new Map() // ip -> { ville, pays } | null (résolution vaine, mise en cache aussi)
const CACHE_MAX = 500

function isPrivateOrLocalIp(ip) {
  if (!ip) return true
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) return true
  if (/^10\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^169\.254\./.test(ip)) return true
  return false
}

export async function lookupGeo(ip) {
  if (isPrivateOrLocalIp(ip)) return null
  if (cache.has(ip)) return cache.get(ip)

  let result = null
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`, {
      signal: AbortSignal.timeout(2000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'success') result = { ville: data.city || null, pays: data.country || null }
    }
  } catch {
    // Réseau indisponible / timeout / service hors service → pas grave, on continue sans.
  }

  if (cache.size >= CACHE_MAX) cache.clear() // purge simple, évite une croissance illimitée
  cache.set(ip, result)
  return result
}
