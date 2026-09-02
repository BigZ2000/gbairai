import { prisma } from '../utils/prisma.js'
import { sendToBuzzer, sendToUser as notifyUser, broadcast } from '../ws/wsServer.js'
import { getFirmwareConfig, otaAvailableFor } from '../config/firmware.js'
import { lookupGeo } from './geoService.js'

const LOW_BATTERY = 15 // seuil d'alerte batterie faible (%)

// ── JOURNAL (ADMIN uniquement) ────────────────────────────────────────────────
// `mac` n'est jamais une FK : le journal doit survivre à la suppression du
// buzzer, à un reset d'usine (admin ou physique) et à un re-appairage.
// La géolocalisation est résolue en tâche de fond (non-bloquant) : l'évènement
// est écrit immédiatement, puis mis à jour si l'IP se résout à une localité.
export async function logBuzzerEvent(mac, type, { ip = null, firmware = null, meta = null } = {}) {
  // ANTI-REBOND : un buzzer au Wi-Fi instable peut se reconnecter toutes les 3 s,
  // ce qui écrirait ~57 000 lignes/jour pour un seul appareil. On ignore donc un
  // CONNECT/DISCONNECT identique survenu il y a moins de 60 s. Les évènements
  // rares et importants (resets, appairage, OTA…) ne sont jamais filtrés.
  if (type === 'CONNECT' || type === 'DISCONNECT') {
    const recent = await prisma.buzzerEvent.findFirst({
      where: { mac, type, createdAt: { gte: new Date(Date.now() - 60_000) } },
      select: { id: true },
    })
    if (recent) return null
  }

  const event = await prisma.buzzerEvent.create({ data: { mac, type, ip, firmware, meta } })
  if (ip) {
    lookupGeo(ip)
      .then(geo => { if (geo) return prisma.buzzerEvent.update({ where: { id: event.id }, data: geo }) })
      .catch(() => {})
  }
  return event
}

// RÉTENTION : le journal est un outil d'exploitation, pas une archive légale.
// On purge au-delà de 90 jours (au démarrage puis une fois par jour) pour éviter
// une croissance illimitée de la table.
const JOURNAL_RETENTION_DAYS = Number(process.env.JOURNAL_RETENTION_DAYS || 90)

export async function purgeOldJournal() {
  const avant = new Date(Date.now() - JOURNAL_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count } = await prisma.buzzerEvent.deleteMany({ where: { createdAt: { lt: avant } } })
  if (count > 0) console.log(`[journal] ${count} évènement(s) de plus de ${JOURNAL_RETENTION_DAYS} j purgés`)
  return count
}

export function startJournalPurge() {
  purgeOldJournal().catch(() => {})
  const timer = setInterval(() => purgeOldJournal().catch(() => {}), 24 * 60 * 60 * 1000)
  timer.unref?.() // n'empêche pas le process de s'arrêter
  return timer
}

// Résultat d'une mise à jour OTA remonté par le buzzer (firmware ≥ esp32-1.2).
// Sans ça, l'admin ne savait jamais si une MAJ avait réussi ou échoué.
export async function onOtaResult(mac, { ok, version, error } = {}) {
  logBuzzerEvent(mac, ok ? 'OTA_SUCCESS' : 'OTA_FAILED', {
    firmware: version ?? null,
    meta: error ? { error } : null,
  }).catch(() => {})
  // En cas de succès le buzzer redémarre et réannoncera sa version au hello ;
  // on l'enregistre tout de suite pour que l'admin voie l'état à jour sans délai.
  if (ok && version) {
    await prisma.buzzer.update({ where: { mac }, data: { firmware: version } }).catch(() => {})
  }
}

// Propose une mise à jour OTA à un buzzer s'il est appairé, au repos et obsolète.
function maybeOfferOta(buzzer, reportedFirmware) {
  // Un buzzer NON appairé est éligible : sinon un appareil neuf resterait bloqué
  // sur son firmware d'usine tant que personne ne l'a réclamé.
  if (!buzzer || buzzer.status === 'IN_GAME') return
  if (!otaAvailableFor(reportedFirmware)) return
  const fw = getFirmwareConfig()
  sendToBuzzer(buzzer.mac, { type: 'ota', url: fw.url, version: fw.version })
}

// Télémétrie remontée par le buzzer (batterie, signal Wi-Fi).
export async function onTelemetry(mac, { battery, rssi } = {}) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return
  const data = { lastTelemetryAt: new Date() }
  if (typeof battery === 'number') data.battery = Math.max(0, Math.min(100, Math.round(battery)))
  if (typeof rssi === 'number') data.rssi = Math.round(rssi)
  const updated = await prisma.buzzer.update({ where: { mac }, data })

  if (updated.ownerId) {
    notifyUser(updated.ownerId, { type: 'buzzer_telemetry', mac, battery: updated.battery, rssi: updated.rssi })
    if (updated.battery != null && updated.battery <= LOW_BATTERY) {
      notifyUser(updated.ownerId, { type: 'buzzer_low_battery', mac, nom: updated.nom, battery: updated.battery })
    }
  }
  return updated
}

// Pousse une offre OTA à tous les buzzers en ligne et au repos (déclenchement admin).
// AWAITING_CLAIM inclus : un buzzer neuf, encore non appairé, doit pouvoir être
// mis à jour (auparavant il en était exclu et restait bloqué sur son firmware d'usine).
export async function offerOtaToAllIdle() {
  const buzzers = await prisma.buzzer.findMany({ where: { status: { in: ['ONLINE', 'AWAITING_CLAIM'] } } })
  const fw = getFirmwareConfig()
  let count = 0
  for (const b of buzzers) {
    if (otaAvailableFor(b.firmware)) { sendToBuzzer(b.mac, { type: 'ota', url: fw.url, version: fw.version }); count++ }
  }
  return count
}

// Combien de buzzers recevraient l'OTA si on le poussait maintenant ?
// Permet à l'admin de savoir AVANT de cliquer (« 3 buzzers obsolètes »).
export async function countOtaEligible() {
  const buzzers = await prisma.buzzer.findMany({
    where: { status: { in: ['ONLINE', 'AWAITING_CLAIM'] } },
    select: { firmware: true },
  })
  return buzzers.filter(b => otaAvailableFor(b.firmware)).length
}

// Diffuse le statut d'un buzzer en temps réel :
//  - au propriétaire (rafraîchit ses listes : dashboard, salle d'attente)
//  - aux salles des parties actives où ce buzzer est assigné (présence en jeu)
async function emitBuzzerStatus(buzzer, status) {
  if (!buzzer) return
  if (buzzer.ownerId) {
    notifyUser(buzzer.ownerId, { type: 'buzzer_status_update', mac: buzzer.mac, status })
  }
  const parts = await prisma.participant.findMany({
    where: { buzzerId: buzzer.id, partie: { status: { in: ['EN_ATTENTE', 'EN_COURS'] } } },
    select: { partie: { select: { code: true } } },
  })
  const codes = [...new Set(parts.map(p => p.partie.code))]
  for (const code of codes) {
    broadcast(code, { type: 'buzzer_status_update', mac: buzzer.mac, status })
  }
}

// Projection publique d'un buzzer (pour les broadcasts d'attribution).
function pubBuzzer(b) {
  return { id: b.id, mac: b.mac, couleur: b.couleur, nom: b.nom, status: b.status, battery: b.battery }
}

// AUTO-ASSOCIATION (philosophie « le joueur ne doit jamais être bloqué par le
// matériel ») : quand un buzzer appairé devient disponible et que son
// propriétaire est DÉJÀ dans une partie active SANS buzzer choisi, on l'associe
// automatiquement. On ne touche jamais à un joueur ayant déjà choisi une source.
// Renvoie true si au moins une association a eu lieu sur une partie EN_COURS.
async function autoAssignToOwner(buzzer) {
  if (!buzzer?.ownerId) return false
  // On exclut l'animateur : s'il possède un kit de buzzers, ils restent libres
  // pour être attribués aux JOUEURS (manuellement / auto-attribution en salle).
  const parts = await prisma.participant.findMany({
    where: { userId: buzzer.ownerId, buzzerId: null, isAnimateur: false, partie: { status: { in: ['EN_ATTENTE', 'EN_COURS'] } } },
    include: { partie: { select: { code: true, status: true } } },
  })
  let enCours = false
  for (const p of parts) {
    await prisma.participant.update({ where: { id: p.id }, data: { buzzerId: buzzer.id } })
    broadcast(p.partie.code, { type: 'buzzer_assigned', buzzerId: buzzer.id, participantId: p.id, buzzer: pubBuzzer(buzzer) })
    notifyUser(buzzer.ownerId, { type: 'buzzer_auto_assigned', mac: buzzer.mac, nom: buzzer.nom, partieCode: p.partie.code })
    if (p.partie.status === 'EN_COURS') enCours = true
  }
  return enCours
}

export async function onBuzzerConnect(mac, firmware, { ip = null, resetReason = null } = {}) {
  // Journal : CONNECT normal, ou FACTORY_RESET_DEVICE si l'appareil signale qu'il
  // vient de subir un reset d'usine (annoncé une seule fois, au 1er hello après reboot).
  logBuzzerEvent(mac, resetReason === 'factory' ? 'FACTORY_RESET_DEVICE' : 'CONNECT', { ip, firmware }).catch(() => {})

  let buzzer = await prisma.buzzer.findUnique({ where: { mac } })

  if (!buzzer) {
    buzzer = await prisma.buzzer.create({
      data: { mac, firmware, status: 'AWAITING_CLAIM', ownerId: null, claimedAt: null },
    })
    sendToBuzzer(mac, { type: 'awaiting_claim' })
  } else {
    // Statut provisoire ONLINE + horodatage.
    buzzer = await prisma.buzzer.update({
      where: { mac },
      data: { status: 'ONLINE', lastSeenAt: new Date(), firmware: firmware ?? buzzer.firmware },
    })
    if (buzzer.ownerId) {
      // 1) Auto-association aux participations actives sans buzzer (Part 6).
      await autoAssignToOwner(buzzer)
      // 2) Statut IN_GAME si désormais assigné à une partie EN_COURS
      //    (couvre la 1re association ET la reconnexion après coupure Wi-Fi).
      const enJeu = await prisma.participant.findFirst({
        where: { buzzerId: buzzer.id, partie: { status: 'EN_COURS' } },
        select: { id: true },
      })
      if (enJeu) buzzer = await prisma.buzzer.update({ where: { mac }, data: { status: 'IN_GAME' } })
      notifyUser(buzzer.ownerId, { type: 'buzzer_online', mac, nom: buzzer.nom })
    } else {
      sendToBuzzer(mac, { type: 'awaiting_claim' })
    }
  }

  await emitBuzzerStatus(buzzer, buzzer.status)
  // Mise à jour OTA proposée si le buzzer est obsolète et au repos.
  maybeOfferOta(buzzer, firmware)
  return buzzer
}

// Passe en IN_GAME tous les buzzers assignés d'une partie (au lancement).
// Un buzzer hors ligne reste hors ligne.
export async function markBuzzersInGame(partieId) {
  const parts = await prisma.participant.findMany({
    where: { partieId, buzzerId: { not: null } },
    select: { buzzer: true },
  })
  for (const { buzzer } of parts) {
    // Seul un buzzer connecté et appairé (ONLINE) passe EN JEU. Un buzzer hors
    // ligne reste OFFLINE (il reprendra IN_GAME à sa reconnexion).
    if (!buzzer || buzzer.status !== 'ONLINE') continue
    const updated = await prisma.buzzer.update({ where: { id: buzzer.id }, data: { status: 'IN_GAME' } })
    await emitBuzzerStatus(updated, 'IN_GAME')
  }
}

// Relâche (IN_GAME → ONLINE) les buzzers d'une partie qui se termine.
export async function releaseBuzzersFromGame(partieId) {
  const parts = await prisma.participant.findMany({
    where: { partieId, buzzerId: { not: null } },
    select: { buzzer: true },
  })
  for (const { buzzer } of parts) {
    if (!buzzer || buzzer.status !== 'IN_GAME') continue
    const updated = await prisma.buzzer.update({ where: { id: buzzer.id }, data: { status: 'ONLINE' } })
    await emitBuzzerStatus(updated, 'ONLINE')
  }
}

// Détache un buzzer précis (désassignation / suppression de joueur) : repasse
// IN_GAME → ONLINE et éteint sa LED (idle).
export async function releaseBuzzerToOnline(buzzerId) {
  if (!buzzerId) return
  const b = await prisma.buzzer.findUnique({ where: { id: buzzerId } })
  if (!b) return
  if (b.status === 'IN_GAME') {
    const updated = await prisma.buzzer.update({ where: { id: buzzerId }, data: { status: 'ONLINE' } })
    await emitBuzzerStatus(updated, 'ONLINE')
  }
  sendToBuzzer(b.mac, { type: 'led', state: 'idle' })
}

export async function onBuzzerDisconnect(mac) {
  logBuzzerEvent(mac, 'DISCONNECT').catch(() => {})

  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return

  await prisma.buzzer.update({
    where: { mac },
    data: { status: 'OFFLINE', lastSeenAt: new Date() },
  })

  if (buzzer.ownerId) {
    notifyUser(buzzer.ownerId, { type: 'buzzer_offline', mac, nom: buzzer.nom })
  }
  await emitBuzzerStatus(buzzer, 'OFFLINE')
}

export async function claimBuzzer(mac, userId) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return { success: false, error: 'Buzzer introuvable', code: 'NOT_FOUND' }

  if (buzzer.ownerId && buzzer.ownerId !== userId) {
    // Notifier le propriétaire actuel de la tentative
    notifyUser(buzzer.ownerId, {
      type: 'claim_attempt',
      mac,
      nom: buzzer.nom,
      message: '⚠️ Quelqu\'un a tenté de réclamer votre buzzer. Si ce n\'est pas vous, votre buzzer est en sécurité.',
    })
    return {
      success: false,
      error: 'Ce buzzer est déjà enregistré sur un autre compte Gbairai. Seul son propriétaire peut le libérer depuis son profil.',
      code: 'BUZZER_ALREADY_CLAIMED',
    }
  }

  const updated = await prisma.buzzer.update({
    where: { mac },
    data: { ownerId: userId, claimedAt: new Date(), status: 'ONLINE' },
  })

  sendToBuzzer(mac, { type: 'pairing_success' })
  logBuzzerEvent(mac, 'CLAIM', { meta: { userId } }).catch(() => {})
  // Si le propriétaire est déjà dans une partie sans buzzer, on l'associe.
  await autoAssignToOwner(updated)
  return { success: true, buzzer: updated }
}

// ── ACTIONS ADMIN (parc de buzzers) ───────────────────────────────────────────

// Reset d'usine À DISTANCE : le buzzer efface son Wi-Fi/config et redémarre
// (rouvre le portail). Nécessite le firmware ≥ esp32-1.1. Ne modifie pas la DB :
// à sa reconnexion, le buzzer réapparaîtra (appairé s'il a encore un owner).
export async function adminFactoryReset(mac) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return { success: false, error: 'Buzzer introuvable' }
  if (buzzer.status !== 'ONLINE' && buzzer.status !== 'IN_GAME') {
    return { success: false, error: 'Le buzzer doit être en ligne pour recevoir un reset distant' }
  }
  const delivered = sendToBuzzer(mac, { type: 'factory_reset' })
  logBuzzerEvent(mac, 'FACTORY_RESET_ADMIN', { meta: { delivered: !!delivered } }).catch(() => {})
  return { success: !!delivered, delivered: !!delivered }
}

// Libération FORCÉE par l'admin : retire le propriétaire (le buzzer redevient
// « à appairer »). Le propriétaire est notifié. Bloqué en pleine partie.
export async function adminReleaseBuzzer(mac) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return { success: false, error: 'Buzzer introuvable' }
  if (buzzer.status === 'IN_GAME') return { success: false, error: 'Impossible de libérer un buzzer en cours de partie' }

  const ancienOwner = buzzer.ownerId
  const updated = await prisma.buzzer.update({
    where: { mac },
    data: { ownerId: null, claimedAt: null, nom: null, status: buzzer.status === 'ONLINE' ? 'AWAITING_CLAIM' : 'OFFLINE' },
  })
  if (ancienOwner) notifyUser(ancienOwner, { type: 'buzzer_released_by_admin', mac, nom: buzzer.nom })
  if (buzzer.status === 'ONLINE') sendToBuzzer(mac, { type: 'awaiting_claim' })
  await emitBuzzerStatus(updated, updated.status)
  logBuzzerEvent(mac, 'RELEASE_ADMIN', { meta: { ancienOwner } }).catch(() => {})
  return { success: true }
}

// Oublier (supprimer) un enregistrement de buzzer. Détache d'abord les
// participations qui le référencent. Bloqué en pleine partie.
export async function adminForgetBuzzer(mac) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return { success: false, error: 'Buzzer introuvable' }
  if (buzzer.status === 'IN_GAME') return { success: false, error: 'Impossible de supprimer un buzzer en cours de partie' }

  await prisma.participant.updateMany({ where: { buzzerId: buzzer.id }, data: { buzzerId: null } })
  await prisma.buzzer.delete({ where: { id: buzzer.id } })
  logBuzzerEvent(mac, 'FORGET').catch(() => {})
  return { success: true }
}

export async function releaseBuzzer(mac, userId) {
  const buzzer = await prisma.buzzer.findUnique({ where: { mac } })
  if (!buzzer) return { success: false, error: 'Buzzer introuvable' }
  if (buzzer.ownerId !== userId) return { success: false, error: 'Ce buzzer ne vous appartient pas' }
  if (buzzer.status === 'IN_GAME') {
    return { success: false, error: 'Impossible de libérer un buzzer en cours de partie' }
  }

  await prisma.buzzer.update({
    where: { mac },
    data: { ownerId: null, claimedAt: null, nom: null, status: buzzer.status === 'ONLINE' ? 'AWAITING_CLAIM' : 'OFFLINE' },
  })

  if (buzzer.status === 'ONLINE') {
    sendToBuzzer(mac, { type: 'awaiting_claim' })
  }

  logBuzzerEvent(mac, 'RELEASE', { meta: { userId } }).catch(() => {})
  return { success: true }
}

// GET journal (ADMIN) — paginé, filtrable par MAC. Survit à la suppression du
// buzzer (aucune jointure requise, `mac` est une simple chaîne).
export async function getBuzzerJournal({ mac = null, page = 1, perPage = 30 } = {}) {
  // Recherche PARTIELLE (ex. les 4 derniers caractères d'une MAC suffisent).
  const where = mac ? { mac: { contains: mac.toUpperCase() } } : {}
  const [total, events] = await Promise.all([
    prisma.buzzerEvent.count({ where }),
    prisma.buzzerEvent.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage, take: perPage,
    }),
  ])
  return { events, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) }
}
