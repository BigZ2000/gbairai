import { WebSocketServer, WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { handleGameMessage, sendSnapshot, sendLedSnapshot } from './gameHandler.js'
import { onBuzzerConnect, onBuzzerDisconnect, onTelemetry } from '../services/buzzerService.js'
import { prisma } from '../utils/prisma.js'

// Map<partieCode, Set<WebSocket>>
const rooms = new Map()

// Map<userId, WebSocket>
const userSockets = new Map()

// Map<mac, WebSocket>
const buzzerSockets = new Map()

export function initWsServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    ws._gbairai = {}

    ws.on('message', async (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      // Authentification du client web
      if (msg.type === 'auth') {
        try {
          const payload = jwt.verify(msg.token, process.env.JWT_SECRET)
          ws._gbairai.userId = payload.sub
          userSockets.set(payload.sub, ws)
          ws.send(JSON.stringify({ type: 'auth_ok' }))
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error' }))
        }
        return
      }

      // Authentification d'un buzzer physique
      if (msg.type === 'buzzer_hello') {
        const { mac, firmware } = msg
        ws._gbairai.mac = mac?.toUpperCase()
        buzzerSockets.set(ws._gbairai.mac, ws)
        await onBuzzerConnect(ws._gbairai.mac, firmware)
        // S'il est déjà assigné à une partie EN_COURS, on lui pousse l'état
        // courant de sa LED (reprise transparente après (re)connexion).
        await sendLedSnapshot(ws._gbairai.mac)
        return
      }

      // Télémétrie d'un buzzer (batterie / signal Wi-Fi).
      if (msg.type === 'device_telemetry') {
        const mac = ws._gbairai.mac ?? msg.mac?.toUpperCase()
        if (mac) await onTelemetry(mac, { battery: msg.battery, rssi: msg.rssi })
        return
      }

      // Rejoindre une salle
      if (msg.type === 'join_room') {
        const { partieCode } = msg
        ws._gbairai.partieCode = partieCode
        if (!rooms.has(partieCode)) rooms.set(partieCode, new Set())
        rooms.get(partieCode).add(ws)
        ws.send(JSON.stringify({ type: 'room_joined', partieCode }))
        // Resynchronisation immédiate : si une partie est en cours, on renvoie
        // l'état courant (question, révélation, position média) à ce client.
        await sendSnapshot(ws, partieCode)
        return
      }

      // Messages de jeu
      await handleGameMessage(ws, msg, { broadcast, sendToUser, sendToBuzzer })
    })

    ws.on('close', async () => {
      const { partieCode, userId, mac } = ws._gbairai

      // Nettoyage salle
      if (partieCode) {
        rooms.get(partieCode)?.delete(ws)
      }
      // Nettoyage user
      if (userId) {
        userSockets.delete(userId)
      }
      // Nettoyage buzzer
      if (mac) {
        buzzerSockets.delete(mac)
        await onBuzzerDisconnect(mac)
      }

      // A3 — si l'animateur quitte une partie EN_COURS, les joueurs sont notifiés
      // (la partie se met en pause automatiquement — reprise à la reconnexion).
      if (userId && partieCode) {
        try {
          const p = await prisma.partie.findUnique({
            where: { code: partieCode },
            select: { animateurId: true, status: true },
          })
          if (p?.status === 'EN_COURS' && p.animateurId === userId) {
            broadcast(partieCode, { type: 'animateur_offline' })
          }
        } catch { /* best-effort */ }
      }
    })
  })

  console.log('WebSocket server ready')
}

export function broadcast(partieCode, message) {
  const room = rooms.get(partieCode)
  if (!room) return
  const payload = JSON.stringify(message)
  room.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  })
}

export function sendToUser(userId, message) {
  const ws = userSockets.get(userId)
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

export function sendToBuzzer(mac, message) {
  const ws = buzzerSockets.get(mac?.toUpperCase())
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}
