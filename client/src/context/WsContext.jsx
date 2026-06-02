import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const WsContext = createContext(null)

export function WsProvider({ children }) {
  const { user } = useAuth()
  const ws = useRef(null)
  const listeners = useRef(new Map())
  // Salles rejointes : permet de re-rejoindre automatiquement après une
  // reconnexion (coupure réseau) sans intervention de l'utilisateur.
  const joinedRooms = useRef(new Set())
  const [connected, setConnected] = useState(false)

  const rawSend = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
      return true
    }
    return false
  }, [])

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws.current = new WebSocket(`${proto}://${window.location.host}/ws`)

    ws.current.onopen = () => {
      setConnected(true)
      const access = localStorage.getItem('access')
      if (access) ws.current.send(JSON.stringify({ type: 'auth', token: access }))
      // Re-rejoindre toutes les salles actives → le serveur renvoie un snapshot
      // (question courante, révélation, position média) pour chaque salle.
      joinedRooms.current.forEach(code => {
        ws.current.send(JSON.stringify({ type: 'join_room', partieCode: code }))
      })
    }

    ws.current.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      listeners.current.forEach(cb => cb(msg))
    }

    ws.current.onclose = () => {
      setConnected(false)
      setTimeout(connect, 3000)
    }

    ws.current.onerror = () => ws.current.close()
  }, [])

  useEffect(() => {
    if (user) connect()
    return () => ws.current?.close()
  }, [user])

  // Au retour de l'onglet (mobile / changement d'app), on demande une
  // resynchronisation de chaque salle active pour recaler le média.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (ws.current?.readyState !== WebSocket.OPEN) { connect(); return }
      joinedRooms.current.forEach(code => {
        rawSend({ type: 'request_state', partieCode: code })
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [connect, rawSend])

  function send(msg) { rawSend(msg) }

  function joinRoom(partieCode) {
    if (!partieCode) return
    joinedRooms.current.add(partieCode)
    rawSend({ type: 'join_room', partieCode })
  }

  function leaveRoom(partieCode) {
    if (!partieCode) return
    joinedRooms.current.delete(partieCode)
  }

  // Demande explicite de resynchronisation (utilisée par les pages de jeu).
  function requestState(partieCode) {
    rawSend({ type: 'request_state', partieCode })
  }

  function subscribe(id, callback) {
    listeners.current.set(id, callback)
    return () => listeners.current.delete(id)
  }

  return (
    <WsContext.Provider value={{ connected, send, joinRoom, leaveRoom, requestState, subscribe }}>
      {children}
    </WsContext.Provider>
  )
}

export const useWs = () => useContext(WsContext)
