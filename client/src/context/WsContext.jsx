import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { useAuth } from './AuthContext.jsx'

const WsContext = createContext(null)

export function WsProvider({ children }) {
  const { user } = useAuth()
  const ws = useRef(null)
  const listeners = useRef(new Map())
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws.current = new WebSocket(`${proto}://${window.location.host}/ws`)

    ws.current.onopen = () => {
      setConnected(true)
      const access = localStorage.getItem('access')
      if (access) ws.current.send(JSON.stringify({ type: 'auth', token: access }))
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

  function send(msg) {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }

  function joinRoom(partieCode) {
    send({ type: 'join_room', partieCode })
  }

  function subscribe(id, callback) {
    listeners.current.set(id, callback)
    return () => listeners.current.delete(id)
  }

  return (
    <WsContext.Provider value={{ connected, send, joinRoom, subscribe }}>
      {children}
    </WsContext.Provider>
  )
}

export const useWs = () => useContext(WsContext)
