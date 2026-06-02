import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { ArrowRight, Zap, Gamepad2, Sparkles, Radio } from 'lucide-react'

// Page d'accueil publique — premier contact chaleureux, orienté « join-first ».
// Un visiteur connecté est renvoyé au Dashboard.
export default function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')

  if (loading) return <div className="min-h-screen" style={{ background: 'var(--bg)' }} />
  if (user) return <Navigate to={user.isGuest ? '/invite' : '/dashboard'} replace />

  function handleJoin(e) {
    e.preventDefault()
    const c = joinCode.trim().toUpperCase()
    if (c) navigate(`/rejoindre/${c}`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white" style={{ background: '#6366F1' }}>G</div>
          <span className="font-bold text-sm">Gbairai</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className="btn-ghost btn-sm">Se connecter</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 text-center">
        <div className="w-full max-w-md animate-fadeUp">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Gamepad2 size={30} style={{ color: '#818CF8' }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Crée une partie et joue<br />en moins d'une minute.
          </h1>
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
            Quiz et jeux animés, sur téléphone ou avec de vrais buzzers. Scanne, rejoins, joue.
          </p>

          {/* Join-first : le chemin le plus court vers le jeu */}
          <form onSubmit={handleJoin} className="card p-4 mt-7 text-left">
            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Zap size={15} style={{ color: '#818CF8' }} />On t'a donné un code ?
            </p>
            <div className="flex gap-2">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8}
                placeholder="QUIZ42" className="input font-mono tracking-widest uppercase flex-1" />
              <button type="submit" disabled={!joinCode.trim()} className="btn-primary btn-lg shrink-0 gap-1">
                Jouer <ArrowRight size={14} />
              </button>
            </div>
            <p className="text-2xs mt-2" style={{ color: 'var(--text-dim)' }}>Pas besoin de compte — un pseudo suffit.</p>
          </form>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Link to="/register" className="btn-secondary btn-lg flex-1 gap-2"><Sparkles size={15} />Créer un compte</Link>
            <Link to="/buzzer" className="btn-ghost btn-lg flex-1 gap-2"><Radio size={15} />Découvrir les buzzers</Link>
          </div>
        </div>
      </main>

      <footer className="text-center pb-6 text-2xs" style={{ color: 'var(--text-dim)' }}>
        Scanner → Rejoindre → Jouer
      </footer>
    </div>
  )
}
