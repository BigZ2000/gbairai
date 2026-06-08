import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Mail, Lock, User, AtSign, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { googleAuthAvailable } from '../utils/env.js'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '', prenom: '', username: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Username availability
  const [usernameState, setUsernameState] = useState('idle') // idle | checking | available | taken
  const [suggestions, setSuggestions] = useState([])
  const debouncedUsername = useDebounce(form.username, 400)

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
    if (usernameState === 'taken') return
    setError('')
    setLoading(true)
    try {
      await register(form.email, form.password, form.prenom, form.username.trim().toLowerCase())
      // Inscription par email → on invite directement à vérifier l'adresse.
      navigate('/verifier-email', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    window.location.href = '/api/auth/google'
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-fadeUp">

        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mb-4"
            style={{ background: '#6366F1', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>G</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Créer un compte</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Rejoignez et créez des parties en quelques secondes</p>
        </div>

        <div className="card p-6 space-y-4">
          {googleAuthAvailable() ? (
            <>
              <button onClick={handleGoogle} className="btn-google w-full btn-lg gap-3">
                <GoogleIcon />
                Continuer avec Google
              </button>
              <div className="divider">ou</div>
            </>
          ) : (
            <p className="text-2xs text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
              Connexion Google indisponible en réseau local — crée ton compte par email.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Prénom */}
            <div>
              <label className="label">Prénom</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input type="text" required maxLength={50}
                  value={form.prenom} onChange={set('prenom')}
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
                <input type="text" required minLength={3} maxLength={30}
                  value={form.username} onChange={set('username')}
                  placeholder="mon_pseudo"
                  className={`input pl-9 pr-9 ${usernameState === 'taken' ? 'input-error' : usernameState === 'available' ? 'input-success' : ''}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameState === 'checking' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-dim)' }} />}
                  {usernameState === 'available' && <CheckCircle2 size={14} style={{ color: '#22C55E' }} />}
                  {usernameState === 'taken' && <XCircle size={14} style={{ color: '#EF4444' }} />}
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
                          onClick={() => setForm(f => ({ ...f, username: s }))}
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

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input type="email" required autoComplete="email"
                  value={form.email} onChange={set('email')}
                  placeholder="vous@exemple.com"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input type="password" required minLength={6} autoComplete="new-password"
                  value={form.password} onChange={set('password')}
                  placeholder="Minimum 6 caractères"
                  className="input pl-9"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit"
              disabled={loading || usernameState === 'taken' || usernameState === 'checking'}
              className="btn-primary w-full btn-lg mt-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-dim)' }}>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#818CF8' }}>Se connecter</Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
