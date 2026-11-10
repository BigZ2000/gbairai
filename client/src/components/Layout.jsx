import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import { LogOut, Shield, WifiOff, History, Crown, Sparkles, MailWarning, Home, Wand2, User } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import Brand from './Brand.jsx'

// Quatre destinations, pas une de plus : jouer, créer, revoir, mon compte.
// Barre du haut sur ordinateur ; barre d'onglets au pouce sur téléphone.
const NAV = [
  { to: '/dashboard',    label: 'Jouer',      icon: Home,    end: true },
  { to: '/quiz/nouveau', label: 'Créer',      icon: Wand2 },
  { to: '/historique',   label: 'Historique', icon: History },
  { to: '/compte',       label: 'Compte',     icon: User },
]

export default function Layout({ children, maxWidth = 'max-w-5xl' }) {
  const { user, logout } = useAuth()
  const { connected } = useWs()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const guest = !!user?.isGuest
  const isFree = !user?.plan || user.plan === 'FREE'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40"
        style={{
          background: 'var(--header-bg)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)',
          // PWA iOS : décale l'en-tête sous la barre d'état (encoche / Dynamic Island).
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}>
        <div className={`${maxWidth} mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3`}>
          <Link to={guest ? '/invite' : '/dashboard'} aria-label="Accueil Gbairai"><Brand size={30} /></Link>

          {/* Invité = participant éphémère : en-tête minimal, aucun menu. */}
          {guest ? (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/register" className="btn-primary btn-sm gap-1.5"><Sparkles size={13} />Créer mon compte</Link>
            </div>
          ) : (
            <>
              <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
                {NAV.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
                    style={({ isActive }) => ({
                      background: isActive ? 'var(--brand-soft)' : 'transparent',
                      color: isActive ? 'var(--brand-text)' : 'var(--text-muted)',
                    })}>
                    <Icon size={15} />{label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex items-center gap-1.5">
                {!connected && (
                  <span className="hidden sm:flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-full"
                    title="Connexion au serveur perdue — reconnexion en cours"
                    style={{ background: 'var(--hover-overlay)', color: 'var(--text-dim)' }}>
                    <WifiOff size={11} />Hors ligne
                  </span>
                )}
                {isFree && !user?.isAdmin && (
                  <Link to="/abonnement" className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full"
                    style={{ background: 'rgba(255,194,61,0.28)', color: 'var(--text)' }} title="Découvrir Premium">
                    <Crown size={13} style={{ color: '#C98A00' }} />Premium
                  </Link>
                )}
                {user?.isAdmin && (
                  <Link to="/admin" className="btn-ghost btn-sm gap-1.5" title="Administration">
                    <Shield size={14} /><span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <ThemeToggle />
                <button onClick={handleLogout} className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }} title="Se déconnecter" aria-label="Se déconnecter">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Bandeau de vérification (email OU téléphone) — compte non vérifié. */}
      {(() => {
        if (!user || guest) return null
        const isPhoneUser = (user.email ?? '').endsWith('@phone.gbairai')
        const verified = isPhoneUser ? user.phoneVerified : user.emailVerified
        if (verified !== false) return null
        const to = isPhoneUser ? '/verifier-telephone' : '/verifier-email'
        const label = isPhoneUser ? 'ton numéro de téléphone' : 'ton adresse email'
        return (
          <div className={`${maxWidth} mx-auto px-4 sm:px-5`}>
            <Link to={to} className="mt-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,194,61,0.2)', border: '1px solid rgba(255,194,61,0.5)' }}>
              <MailWarning size={16} className="shrink-0" style={{ color: '#C98A00' }} />
              <span className="flex-1" style={{ color: 'var(--text-muted)' }}>
                Confirme {label} pour débloquer toutes les fonctionnalités.
              </span>
              <span className="font-semibold shrink-0" style={{ color: 'var(--text)' }}>Vérifier →</span>
            </Link>
          </div>
        )
      })()}

      <main className={`${maxWidth} mx-auto px-4 sm:px-5 pt-6 animate-fadeUp ${guest ? 'pb-10' : 'pb-tabbar'}`}>
        {children}
      </main>

      {/* Barre d'onglets mobile */}
      {!guest && user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4"
          aria-label="Navigation principale"
          style={{
            background: 'var(--header-bg)', backdropFilter: 'blur(14px)', borderTop: '1px solid var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="flex flex-col items-center justify-center gap-0.5 py-2 text-2xs font-semibold"
              style={({ isActive }) => ({ color: isActive ? 'var(--brand-text)' : 'var(--text-dim)' })}>
              {({ isActive }) => (
                <>
                  <span className="w-12 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: isActive ? 'var(--brand-soft)' : 'transparent' }}>
                    <Icon size={19} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
