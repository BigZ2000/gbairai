import { prisma } from '../utils/prisma.js'
import { sendToBuzzer, sendToUser as notifyUser, broadcast } from '../ws/wsServer.js'
import { getFirmwareConfig, otaAvailableFor } from '../config/firmware.js'

const LOW_BATTERY = 15 // seuil d'alerte batterie faible (%)

// Propose une mise à jour OTA à un buzzer s'il est appairé, au repos et obsolète.
function maybeOfferOta(buzzer, reportedFirmware) {
  if (!buzzer?.ownerId || buzzer.status === 'IN_GAME') return
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
export async function offerOtaToAllIdle() {
  const buzzers = await prisma.buzzer.findMany({ where: { status: 'ONLINE' } })
  const fw = getFirmwareConfig()
  let count = 0
  for (const b of buzzers) {
    if (otaAvailableFor(b.firmware)) { sendToBuzzer(b.mac, { type: 'ota', url: fw.url, version: fw.version }); count++ }
  }
  return count
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

export async function onBuzzerConnect(mac, firmware) {
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
  // Si le propriétaire est déjà dans une partie sans buzzer, on l'associe.
  await autoAssignToOwner(updated)
  return { success: true, buzzer: updated }
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

  return { success: true }
}
