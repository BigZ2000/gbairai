import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { Gamepad2, ArrowRight, Sparkles, Crown } from 'lucide-react'

// Écran « maison » d'un invité : il n'a PAS de menu utilisateur. Juste
// rejoindre une partie, ou se convertir en compte. Cible des redirections.
export default function GuestHome() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  if (loading) return <div className="min-h-screen" style={{ background: 'var(--bg)' }} />
  if (!user) return <Navigate to="/login" replace />
  if (!user.isGuest) return <Navigate to="/dashboard" replace />

  function join(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c) navigate(`/rejoindre/${c}`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white" style={{ background: '#6366F1' }}>G</div>
          <span className="font-bold text-sm">Gbairai</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-full max-w-sm animate-fadeUp">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Gamepad2 size={26} style={{ color: '#818CF8' }} />
          </div>
          <h1 className="text-2xl font-bold">Salut {user.prenom} 👋</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tu joues en invité.</p>

          <form onSubmit={join} className="card p-4 mt-6 text-left">
            <p className="text-sm font-semibold mb-2">Rejoindre une partie</p>
            <div className="flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8}
                placeholder="QUIZ42" className="input font-mono tracking-widest uppercase flex-1" />
              <button type="submit" disabled={!code.trim()} className="btn-primary btn-lg shrink-0 gap-1">
                Jouer <ArrowRight size={14} />
              </button>
            </div>
          </form>

          <div className="card p-4 mt-3 text-left" style={{ border: '1px solid rgba(99,102,241,0.25)' }}>
            <p className="text-sm font-semibold">Garde ta progression</p>
            <p className="text-2xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
              Crée ton compte pour conserver ton score, ton historique et débloquer plus de jeux.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/register" className="btn-primary flex-1 gap-2"><Sparkles size={14} />Créer mon compte</Link>
              <Link to="/register" className="btn-secondary flex-1 gap-2"><Crown size={14} />Voir les offres</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
