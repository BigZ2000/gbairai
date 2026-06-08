import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Gamepad2, Smartphone } from 'lucide-react'
import { googleAuthAvailable } from '../utils/env.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

const GOOGLE_ERRORS = {
  google_not_configured: 'Google OAuth non configuré sur ce serveur.',
  google_cancelled: 'Connexion annulée.',
  google_token_failed: 'Échec de la connexion Google. Réessayez.',
  google_server_error: 'Erreur serveur. Réessayez.',
  oauth_failed: 'Échec de la connexion. Réessayez.',
}

export default function Login() {
  const { loginWith } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [method, setMethod] = useState('email')   // 'email' | 'phone'
  const [identifier, setIdentifier] = useState('') // email ou numéro
  const [password, setPassword] = useState('')
  const [error, setError] = useState(GOOGLE_ERRORS[params.get('error')] ?? '')
  const [loading, setLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const googleOk = googleAuthAvailable()

  function handleJoin(e) {
    e.preventDefault()
    const c = joinCode.trim().toUpperCase()
    if (c) navigate(`/rejoindre/${c}`)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const creds = method === 'phone'
        ? { telephone: identifier.trim(), password }
        : { email: identifier.trim(), password }
      await loginWith(creds)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm animate-fadeUp">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mb-4"
            style={{ background: '#6366F1', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>G</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Bon retour</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connectez-vous à votre compte</p>
        </div>

        {/* Join-first : rejoindre une partie sans compte (un pseudo suffira). */}
        <form onSubmit={handleJoin} className="card p-4 mb-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Gamepad2 size={15} style={{ color: '#818CF8' }} />On t'a donné un code ?
          </p>
          <div className="flex gap-2">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8} placeholder="QUIZ42" className="input font-mono tracking-widest uppercase flex-1" />
            <button type="submit" disabled={!joinCode.trim()} className="btn-primary btn-lg shrink-0 gap-1">
              Rejoindre <ArrowRight size={14} />
            </button>
          </div>
          <p className="text-2xs mt-2" style={{ color: 'var(--text-dim)' }}>Pas besoin de compte — un pseudo suffit.</p>
        </form>

        {/* Card */}
        <div className="card p-6 space-y-4">

          {/* Google — masqué hors localhost/HTTPS (Google refuse le LAN). */}
          {googleOk ? (
            <>
              <button onClick={handleGoogle} className="btn-google w-full btn-lg gap-3">
                <GoogleIcon />
                Continuer avec Google
              </button>
              <div className="divider">ou</div>
            </>
          ) : (
            <p className="text-2xs text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
              Connexion Google indisponible en réseau local — utilise ton email, ou joue avec un pseudo via un code.
            </p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Bascule Email / Téléphone */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: 'var(--hover-overlay)' }}>
              {[['email', 'Email', Mail], ['phone', 'Téléphone', Smartphone]].map(([m, label, Icon]) => (
                <button key={m} type="button" onClick={() => { setMethod(m); setIdentifier(''); setError('') }}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{ background: method === m ? 'var(--surface)' : 'transparent', color: method === m ? 'var(--text)' : 'var(--text-dim)', boxShadow: method === m ? 'var(--shadow)' : 'none' }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            <div>
              <label className="label">{method === 'phone' ? 'Numéro de téléphone' : 'Email'}</label>
              <div className="relative">
                {method === 'phone'
                  ? <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                  : <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />}
                <input
                  type={method === 'phone' ? 'tel' : 'email'} required
                  inputMode={method === 'phone' ? 'tel' : 'email'}
                  autoComplete={method === 'phone' ? 'tel' : 'email'}
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder={method === 'phone' ? '07 01 02 03 04' : 'vous@exemple.com'}
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input
                  type="password" required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg mt-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-dim)' }}>
          Pas de compte ?{' '}
          <Link to="/register" className="font-medium transition-colors" style={{ color: '#818CF8' }}>
            S'inscrire
          </Link>
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
