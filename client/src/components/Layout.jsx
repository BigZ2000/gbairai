import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import { LogOut, User, Wifi, WifiOff } from 'lucide-react'

export default function Layout({ children, maxWidth = 'max-w-5xl' }) {
  const { user, logout } = useAuth()
  const { connected } = useWs()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initial = (user?.username?.[0] ?? user?.prenom?.[0] ?? '?').toUpperCase()

  return (
    <div className="min-h-screen" style={{ background: '#0E0E12' }}>
      <header className="sticky top-0 z-40"
        style={{ background: 'rgba(14,14,18,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className={`${maxWidth} mx-auto px-5 h-14 flex items-center justify-between gap-4`}>

          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
              style={{ background: '#6366F1' }}>G</div>
            <span className="text-sm font-bold tracking-tight" style={{ color: '#ECECF0' }}>Gbairai</span>
          </Link>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              title={connected ? 'Temps réel actif' : 'Déconnecté du serveur'}>
              {connected
                ? <Wifi size={13} style={{ color: '#4ADE80' }} />
                : <WifiOff size={13} style={{ color: '#5A5A6E' }} />}
            </div>

            <Link to="/compte" className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors btn-ghost text-sm">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-2xs font-bold text-white"
                style={{ background: '#6366F1', fontSize: '0.6rem' }}>
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-medium" style={{ color: '#ECECF0' }}>
                {user?.username ? `@${user.username}` : user?.prenom}
              </span>
            </Link>

            <button onClick={handleLogout} className="btn-ghost btn-sm" title="Déconnexion">
              <LogOut size={14} />
              <span className="hidden sm:block">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`${maxWidth} mx-auto px-5 py-8 animate-fadeUp`}>
        {children}
      </main>
    </div>
  )
}
