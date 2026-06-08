import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import { LogOut, Shield, Wifi, WifiOff, History, Crown, Sparkles, MailWarning } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'

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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40"
        style={{ background: 'var(--surface-2)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className={`${maxWidth} mx-auto px-5 h-14 flex items-center justify-between gap-4`}>

          <Link to={user?.isGuest ? '/invite' : '/dashboard'} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
              style={{ background: '#6366F1' }}>G</div>
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Gbairai</span>
          </Link>

          {/* Invité = participant éphémère : header minimal, aucun menu utilisateur. */}
          {user?.isGuest ? (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/register" className="btn-primary btn-sm gap-1.5">
                <Sparkles size={13} />Créer mon compte
              </Link>
            </div>
          ) : (
          <div className="flex items-center gap-1">
            <Link to="/historique" className="btn-ghost btn-sm gap-1.5 flex"
              title="Historique des parties">
              <History size={13} />
              <span className="text-sm hidden sm:inline">Historique</span>
            </Link>
            <Link to="/abonnement" className="btn-ghost btn-sm gap-1.5 flex"
              title="Abonnements & offres">
              <Crown size={13} />
              <span className="text-sm hidden sm:inline">Offres</span>
            </Link>
            {user?.isAdmin && (
              <Link to="/admin" className="btn-ghost btn-sm gap-1.5 flex"
                title="Panneau d'administration">
                <Shield size={13} />
                <span className="text-sm hidden sm:inline">Admin</span>
              </Link>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              title={connected ? 'Temps réel actif' : 'Déconnecté du serveur'}>
              {connected
                ? <Wifi size={13} style={{ color: '#4ADE80' }} />
                : <WifiOff size={13} style={{ color: 'var(--text-dim)' }} />}
            </div>

            <Link to="/compte" className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors btn-ghost text-sm">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-2xs font-bold text-white"
                style={{ background: '#6366F1', fontSize: '0.6rem' }}>
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-medium" style={{ color: 'var(--text)' }}>
                {user?.username ? `@${user.username}` : user?.prenom}
              </span>
            </Link>

            <button onClick={handleLogout} className="btn-ghost btn-sm" title="Déconnexion">
              <LogOut size={14} />
              <span className="hidden sm:block">Quitter</span>
            </button>
          </div>
          )}
        </div>
      </header>

      {/* Bandeau de vérification (email OU téléphone) — compte non-invité non vérifié. */}
      {(() => {
        if (!user || user.isGuest) return null
        const isPhoneUser = (user.email ?? '').endsWith('@phone.gbairai')
        const verified = isPhoneUser ? user.phoneVerified : user.emailVerified
        if (verified !== false) return null
        const to = isPhoneUser ? '/verifier-telephone' : '/verifier-email'
        const label = isPhoneUser ? 'ton numéro de téléphone' : 'ton adresse email'
        return (
          <div className={`${maxWidth} mx-auto px-5`}>
            <Link to={to}
              className="mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
              <MailWarning size={16} className="shrink-0" />
              <span className="flex-1" style={{ color: 'var(--text-muted)' }}>
                Confirme {label} pour débloquer toutes les fonctionnalités.
              </span>
              <span className="font-semibold shrink-0" style={{ color: '#F59E0B' }}>Vérifier →</span>
            </Link>
          </div>
        )
      })()}

      <main className={`${maxWidth} mx-auto px-5 py-8 animate-fadeUp`}>
        {children}
      </main>
    </div>
  )
}
