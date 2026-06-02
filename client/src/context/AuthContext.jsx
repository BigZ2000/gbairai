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

  // Upload multipart (FormData) — ne pas forcer le Content-Type (le navigateur gère la boundary).
  const apiUpload = useCallback(async (path, formData) => {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccess()}` },
      body: formData,
    })
    if (res.status === 401) {
      const refreshed = await tryRefresh()
      if (!refreshed) { logout(); return null }
      return apiUpload(path, formData)
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

  async function register(email, password, prenom, username) {
    // Si un compte invité est connecté, on transmet son jeton → conversion en
    // place côté serveur (score/historique conservés).
    const token = localStorage.getItem('access')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email, password, prenom, username }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? "Erreur d'inscription")
    }
    const data = await res.json()
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    setUser(data.user)
    return data.user
  }

  // Called after Google OAuth redirect — receives tokens from URL params
  function loginWithTokens(access, refresh) {
    localStorage.setItem('access', access)
    localStorage.setItem('refresh', refresh)
    // Fetch user info
    return fetch('/api/auth/me', { headers: { Authorization: `Bearer ${access}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); return u })
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

  // Applique le thème : la préférence APPAREIL (localStorage) prime ; sinon on
  // suit le thème du compte ; sinon « dark ». (Le toggle écrit dans localStorage.)
  useEffect(() => {
    const device = localStorage.getItem('gbairai_theme')
    const theme = device ?? (user?.theme === 'light' ? 'light' : 'dark')
    document.documentElement.setAttribute('data-theme', theme)
  }, [user?.theme])

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, loginWithTokens, logout, apiFetch, apiUpload }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
