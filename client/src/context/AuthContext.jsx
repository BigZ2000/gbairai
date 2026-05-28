import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const getAccess = useCallback(() => localStorage.getItem('access'), [])

  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccess()}`,
        ...(opts.headers ?? {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (res.status === 401) {
      const refreshed = await tryRefresh()
      if (!refreshed) { logout(); return null }
      return apiFetch(path, opts)
    }
    return res
  }, [getAccess])

  async function tryRefresh() {
    const refresh = localStorage.getItem('refresh')
    if (!refresh) return false
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    return true
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erreur de connexion')
    }
    const data = await res.json()
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    setUser(data.user)
    return data.user
  }

  async function register(email, password, prenom) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, prenom }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Erreur d\'inscription')
    }
    const data = await res.json()
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setUser(null)
  }

  useEffect(() => {
    const access = getAccess()
    if (!access) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${access}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
