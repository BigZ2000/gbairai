import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { User, AtSign, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function decodeJwtPayload(token) {
  try {
    const [, b64] = token.split('.')
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export default function RegisterGoogle() {
  const [params] = useSearchParams()
  const { loginWithTokens } = useAuth()
  const navigate = useNavigate()

  const pendingToken = params.get('pending') ?? ''
  const googleInfo = decodeJwtPayload(pendingToken)

  const [prenom, setPrenom] = useState(googleInfo?.prenom ?? '')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [usernameState, setUsernameState] = useState('idle')
  const [suggestions, setSuggestions] = useState([])
  const debouncedUsername = useDebounce(username, 400)

  // Redirect away if no valid pending token
  useEffect(() => {
    if (!pendingToken || !googleInfo || googleInfo.type !== 'google_pending') {
      navigate('/login?error=oauth_failed', { replace: true })
    }
  }, [])

  useEffect(() => {
    const u = debouncedUsername.trim().toLowerCase()
    if (!u || u.length < 3) { setUsernameState('idle'); setSuggestions([]); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(u)) { setUsernameState('idle'); return }
    setUsernameState('checking')
    fetch(`/api/auth/check-username?username=${encodeURIComponent(u)}`)
      .then(r => r.json())
      .then(data => {
        setUsernameState(data.available ? 'available' : 'taken')
        setSuggestions(data.suggestions ?? [])
      })
      .catch(() => setUsernameState('idle'))
  }, [debouncedUsername])

  async function handleSubmit(e) {
    e.preventDefault()
    if (usernameState === 'taken' || usernameState === 'checking') return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/google/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingToken,
          username: username.trim().toLowerCase(),
          prenom: prenom.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la création du compte')
        return
      }
      await loginWithTokens(data.access, data.refresh)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-fadeUp">

        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mb-4"
            style={{ background: '#6366F1', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>G</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Finalise ton profil</h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
            Compte Google : <span style={{ color: '#818CF8' }}>{googleInfo?.email}</span>
          </p>
        </div>

        <div className="card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Prénom */}
            <div>
              <label className="label">Prénom</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input
                  type="text" required maxLength={50}
                  value={prenom} onChange={e => setPrenom(e.target.value)}
                  placeholder="Affiché pendant les parties"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="label">Pseudo unique</label>
              <div className="relative">
                <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input
                  type="text" required minLength={3} maxLength={30}
                  value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="mon_pseudo"
                  className={`input pl-9 pr-9 ${usernameState === 'taken' ? 'input-error' : usernameState === 'available' ? 'input-success' : ''}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameState === 'checking'   && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-dim)' }} />}
                  {usernameState === 'available'  && <CheckCircle2 size={14} style={{ color: '#22C55E' }} />}
                  {usernameState === 'taken'      && <XCircle size={14} style={{ color: '#EF4444' }} />}
                </div>
              </div>
              {usernameState === 'available' && (
                <p className="text-2xs mt-1.5 font-medium" style={{ color: '#22C55E' }}>Disponible</p>
              )}
              {usernameState === 'taken' && (
                <div className="mt-1.5">
                  <p className="text-2xs font-medium" style={{ color: '#EF4444' }}>Pseudo déjà pris</p>
                  {suggestions.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {suggestions.map(s => (
                        <button key={s} type="button"
                          onClick={() => setUsername(s)}
                          className="text-2xs px-2 py-0.5 rounded font-medium transition-colors"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.2)' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-2xs mt-1" style={{ color: 'var(--text-dim)' }}>Lettres, chiffres, _ et - · Min. 3 caractères</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || usernameState === 'taken' || usernameState === 'checking' || !username.trim()}
              className="btn-primary w-full btn-lg mt-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
