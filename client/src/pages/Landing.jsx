import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import Brand from '../components/Brand.jsx'
import { ArrowRight, Wand2, Users, Radio, PartyPopper, Building2, GraduationCap, Check } from 'lucide-react'

// Page d'accueil publique. Un visiteur doit comprendre en cinq secondes :
// ce que c'est (des quiz à jouer ensemble), comment on entre (un code, sans
// compte) et pour qui c'est (amis, maquis, entreprises, écoles).
const USAGES = [
  { icon: PartyPopper, titre: 'Entre amis, au maquis', texte: 'Un écran, des téléphones, des packs prêts : la soirée quiz démarre en une minute.' },
  { icon: Building2, titre: 'En entreprise', texte: 'Team building, séminaire, afterwork, challenge commercial : un quiz sur vos métiers, créé en une phrase.' },
  { icon: GraduationCap, titre: 'À l\'école', texte: 'Révisions qui réveillent la classe, tournois entre équipes, buzzers comme à la télé.' },
]

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
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between max-w-5xl w-full mx-auto">
        <Brand size={34} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className="btn-secondary btn-sm">Se connecter</Link>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 max-w-5xl w-full mx-auto">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-8 sm:py-14">
          <div className="animate-fadeUp min-w-0">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.05]">
              Le quiz qui met<br />
              <span style={{ color: 'var(--brand)' }}>l'ambiance</span> partout.
            </h1>
            <p className="text-base mt-4 max-w-md" style={{ color: 'var(--text-muted)' }}>
              Des quiz à jouer ensemble, sur téléphone ou avec de vrais buzzers. Entre amis, au maquis, en entreprise, en classe.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Link to="/register" className="btn-primary btn-xl">Créer une partie<ArrowRight size={17} /></Link>
              <Link to="/buzzer" className="btn-secondary btn-xl"><Radio size={17} />Voir les buzzers</Link>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {['Tes invités jouent sans compte, avec un simple pseudo', 'Jouer seul est gratuit et illimité', 'Crée ton propre quiz en une phrase grâce à l\'IA'].map(t => (
                <li key={t} className="flex items-center gap-2"><Check size={15} style={{ color: 'var(--leaf)' }} />{t}</li>
              ))}
            </ul>
          </div>

          {/* Le chemin le plus court vers le jeu */}
          <form onSubmit={handleJoin} className="panel-ink p-6 sm:p-8 animate-pop" style={{ borderRadius: 28 }}>
            <p className="font-display text-2xl font-extrabold">On t'a donné un code ?</p>
            <p className="text-sm mt-1" style={{ opacity: 0.75 }}>Entre-le, choisis un pseudo, joue.</p>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8}
              placeholder="QUIZ42" aria-label="Code de la partie" autoCapitalize="characters" autoComplete="off"
              className="w-full mt-5 text-center font-mono text-3xl tracking-[0.3em] uppercase rounded-2xl focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)', color: 'inherit', height: 72 }} />
            <button type="submit" disabled={!joinCode.trim()} className="btn-primary btn-xl w-full mt-3">Rejoindre la partie<ArrowRight size={17} /></button>
            <p className="text-xs mt-3 flex items-center justify-center gap-1.5" style={{ opacity: 0.7 }}>
              <Users size={13} />Pas de compte, pas d'application à installer.
            </p>
          </form>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-6">
          {USAGES.map(({ icon: Icon, titre, texte }) => (
            <div key={titre} className="card p-5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--brand-soft)' }}>
                <Icon size={20} style={{ color: 'var(--brand-text)' }} />
              </div>
              <h2 className="font-bold text-base">{titre}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{texte}</p>
            </div>
          ))}
        </section>

        <section className="card p-5 sm:p-6 mb-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,194,61,0.3)' }}>
            <Wand2 size={22} style={{ color: '#C98A00' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base">« Prépare un quiz pour notre team building de vendredi »</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Décris ce que tu veux : l'IA rédige les questions, tu relis, tu lances. Une création offerte à l'inscription.
            </p>
          </div>
          <Link to="/register" className="btn-primary shrink-0">Essayer</Link>
        </section>
      </main>

      <footer className="text-center pb-6 text-xs" style={{ color: 'var(--text-dim)' }}>
        Gbairai · Scanner → Rejoindre → Jouer
      </footer>
    </div>
  )
}
