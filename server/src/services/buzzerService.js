import { prisma } from '../utils/prisma.js'
import { sendToBuzzer, sendToUser as notifyUser } from '../ws/wsServer.js'

export async function onBuzzerConnect(mac, firmware) {
  let buzzer = await prisma.buzzer.findUnique({ where: { mac } })

  if (!buzzer) {
    buzzer = await prisma.buzzer.create({
      data: { mac, firmware, status: 'AWAITING_CLAIM', ownerId: null, claimedAt: null },
    })
    sendToBuzzer(mac, { type: 'awaiting_claim' })
  } else {
    buzzer = await prisma.buzzer.update({
      where: { mac },
      data: { status: 'ONLINE', lastSeenAt: new Date(), firmware: firmware ?? buzzer.firmware },
    })
    if (buzzer.ownerId) {
      notifyUser(buzzer.ownerId, { type: 'buzzer_online', mac, nom: buzzer.nom })
    } else {
      sendToBuzzer(mac, { type: 'awaiting_claim' })
    }
  }

  return buzzer
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
