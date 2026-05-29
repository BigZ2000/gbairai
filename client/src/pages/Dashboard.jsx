import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

export default function Dashboard() {
  const { user, apiFetch } = useAuth()
  const navigate = useNavigate()

  const [parties, setParties] = useState([])
  const [buzzers, setBuzzers] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      apiFetch('/parties').then(r => r?.json()).catch(() => []),
      apiFetch('/buzzers').then(r => r?.json()).catch(() => []),
    ]).then(([p, b]) => {
      setParties(Array.isArray(p) ? p : [])
      setBuzzers(Array.isArray(b) ? b : [])
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const heure = new Date().getHours()
  const salutation = heure < 12 ? 'Bonjour' : 'Bonsoir'

  const mesParties = parties.filter(p =>
    p.animateurId === user?.id ||
    (p.animateurId === null && p.participants?.some(pt => pt.userId === user?.id && pt.isAnimateur))
  )
  const mesParticipations = parties.filter(p => !mesParties.find(mp => mp.id === p.id))

  async function handleJoin(e) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinError('')
    setJoinLoading(true)
    try {
      const checkRes = await apiFetch(`/parties/check/${code}`)
      if (!checkRes?.ok) {
        const err = await checkRes?.json().catch(() => ({}))
        setJoinError(err?.error ?? 'Code invalide ou partie introuvable')
        return
      }
      const partieInfo = await checkRes.json()
      const joinRes = await apiFetch('/parties/join', { method: 'POST', body: { code } })
      if (!joinRes?.ok) {
        const err = await joinRes?.json().catch(() => ({}))
        setJoinError(err?.error ?? 'Impossible de rejoindre')
        return
      }
      navigate(partieInfo.status === 'EN_COURS' ? `/parties/${code}/jeu` : `/parties/${code}/attente`)
    } catch {
      setJoinError('Erreur de connexion au serveur')
    } finally {
      setJoinLoading(false)
    }
  }

  function getBuzzerStatut(b) {
    if (b.status === 'IN_GAME') return 'pressed'
    if (b.status === 'OFFLINE') return 'offline'
    return 'ready'
  }

  function getPartieLink(p) {
    if (p.status === 'EN_ATTENTE') return `/parties/${p.code}/attente`
    if (p.status === 'EN_COURS') return `/parties/${p.code}/jeu`
    return null
  }

  return (
    <Layout>
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-white">
            {salutation}, <span style={{ background: 'linear-gradient(90deg,#C4B5FD,#A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user?.prenom}</span> 👋
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(196,181,253,0.55)' }}>
            Prêt à animer ou rejoindre une partie ?
          </p>
        </div>

        {/* Bouton visible pour TOUS les utilisateurs */}
        <Link to="/parties/new" className="btn-primary text-base px-6 py-3 shrink-0">
          <span>+</span> Créer une partie
        </Link>
      </div>

      {/* Rejoindre */}
      <section className="mb-8">
        <form onSubmit={handleJoin} className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Code de la partie  —  ex : QUIZ42"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              maxLength={8}
              className="input uppercase tracking-widest text-lg font-bold"
              style={{ letterSpacing: '0.15em' }}
            />
            {joinError && (
              <p className="mt-2 text-sm flex items-center gap-1.5" style={{ color: '#FB7185' }}>
                <span>⚠</span> {joinError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={joinLoading || !joinCode.trim()}
            className="btn-gold px-6 py-3 text-base shrink-0"
          >
            {joinLoading ? '...' : 'Rejoindre →'}
          </button>
        </form>
      </section>

      {/* Erreur de chargement */}
      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#FB7185' }}>
          ⚠ Erreur de chargement : {error}
        </div>
      )}

      {/* Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* MES PARTIES */}
        <section className="card p-6">
          <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <span className="text-lg">🎮</span> Mes parties
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
            </div>
          ) : (
            <>
              {mesParties.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(196,181,253,0.5)' }}>
                    Parties que j'anime
                  </p>
                  <PartieList parties={mesParties} getLink={getPartieLink} />
                </div>
              )}

              {mesParticipations.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(196,181,253,0.5)' }}>
                    Parties où je joue
                  </p>
                  <PartieList parties={mesParticipations} getLink={getPartieLink} />
                </div>
              )}

              {parties.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🎯</p>
                  <p className="text-sm" style={{ color: 'rgba(156,163,175,0.7)' }}>
                    Aucune partie pour l'instant.
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(156,163,175,0.5)' }}>
                    Créez-en une ou entrez un code ci-dessus.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* MES BUZZERS */}
        <section className="card p-6">
          <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <span className="text-lg">🔔</span> Mes buzzers
          </h3>

          {buzzers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📡</p>
              <p className="text-sm mb-4" style={{ color: 'rgba(156,163,175,0.7)' }}>
                Aucun buzzer appairé.
              </p>
              <Link to="/compte" className="btn-ghost text-sm px-4 py-2">
                Ajouter un buzzer
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {buzzers.map(b => (
                  <div key={b.id} className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} prenom={b.nom ?? b.mac.slice(-5)} size="sm" />
                    <span className="text-xs font-medium" style={{ color: b.status === 'OFFLINE' ? '#6B7280' : b.status === 'IN_GAME' ? '#FBBF24' : '#34D399' }}>
                      {b.status === 'OFFLINE' ? 'Hors ligne' : b.status === 'IN_GAME' ? 'En jeu' : 'Connecté'}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/compte" className="text-sm font-medium transition-colors" style={{ color: '#A855F7' }}>
                Gérer mes buzzers →
              </Link>
            </>
          )}
        </section>
      </div>
    </Layout>
  )
}

function PartieList({ parties, getLink }) {
  function getBadge(status) {
    if (status === 'EN_ATTENTE') return <span className="badge-wait">En attente</span>
    if (status === 'EN_COURS')   return <span className="badge-active">En cours</span>
    return <span className="badge-done">Terminée</span>
  }

  return (
    <ul className="space-y-2">
      {parties.map(p => {
        const link = getLink(p)
        const content = (
          <div className="flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-150 group"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div>
              <p className="font-semibold text-white group-hover:text-violet-light transition-colors">{p.nom}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(156,163,175,0.6)' }}>
                {p.code} · {p.participants?.length ?? 0} joueur{(p.participants?.length ?? 0) > 1 ? 's' : ''}
              </p>
            </div>
            {getBadge(p.status)}
          </div>
        )
        return (
          <li key={p.id}>
            {link
              ? <Link to={link} className="block hover:scale-[1.01] transition-transform">{content}</Link>
              : content}
          </li>
        )
      })}
    </ul>
  )
}
