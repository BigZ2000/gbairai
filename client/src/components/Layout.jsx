import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { connected } = useWs()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F0A1E' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'rgba(15,10,30,0.85)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-black" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', boxShadow: '0 0 16px rgba(124,58,237,0.5)' }}>
              G
            </div>
            <span className="text-lg font-black tracking-tight" style={{ background: 'linear-gradient(90deg,#C4B5FD,#F8F4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Gbairai
            </span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Statut connexion WS */}
            <div className="flex items-center gap-1.5" title={connected ? 'Temps réel actif' : 'Déconnecté'}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-600'}`}
                style={connected ? { boxShadow: '0 0 6px #10B981' } : {}} />
              <span className="text-xs hidden sm:block" style={{ color: connected ? '#6EE7B7' : '#6B7280' }}>
                {connected ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>

            <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.1)' }} />

            <Link to="/compte" className="flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: '#C4B5FD' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg,#7C3AED,#4C1D95)' }}>
                {user?.prenom?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="hidden sm:block">{user?.prenom}</span>
            </Link>

            <button
              onClick={handleLogout}
              className="text-sm transition-colors px-3 py-1.5 rounded-lg"
              style={{ color: '#9CA3AF', background: 'rgba(255,255,255,0.04)' }}
            >
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 animate-fadeIn">
        {children}
      </main>
    </div>
  )
}
