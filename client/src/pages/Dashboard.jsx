import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import {
  Plus, ArrowRight, Clock, Zap, Trophy,
  Wifi, WifiOff, Gamepad2, Radio, AlertCircle, Loader2,
} from 'lucide-react'

export default function Dashboard() {
  const { user, apiFetch } = useAuth()
  const navigate = useNavigate()

  const [parties, setParties] = useState([])
  const [buzzers, setBuzzers] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    Promise.all([
      apiFetch('/parties').then(r => r?.json()).catch(() => []),
      apiFetch('/buzzers').then(r => r?.json()).catch(() => []),
    ]).then(([p, b]) => {
      setParties(Array.isArray(p) ? p : [])
      setBuzzers(Array.isArray(b) ? b : [])
    }).catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

  const greeting = new Date().getHours() < 12 ? 'Bonjour' : 'Bonsoir'
  const displayName = user?.username ? `@${user.username}` : user?.prenom

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm mb-0.5" style={{ color: '#9090A0' }}>{greeting} 👋</p>
          <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>{displayName}</h1>
        </div>
        <Link to="/parties/new" className="btn-primary btn-lg gap-2">
          <Plus size={16} />
          Nouvelle partie
        </Link>
      </div>

      {/* Join form */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleJoin} className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Code de partie  —  ex : QUIZ42"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              maxLength={8}
              className="input font-mono tracking-widest text-base uppercase"
            />
            {joinError && (
              <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: '#F87171' }}>
                <AlertCircle size={13} />{joinError}
              </div>
            )}
          </div>
          <button type="submit" disabled={joinLoading || !joinCode.trim()} className="btn-primary btn-lg shrink-0">
            {joinLoading ? <Loader2 size={15} className="animate-spin" /> : <>Rejoindre <ArrowRight size={14} /></>}
          </button>
        </form>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
          <AlertCircle size={14} /> Erreur : {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Mes parties */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Gamepad2 size={15} style={{ color: '#6366F1' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#ECECF0' }}>Mes parties</h2>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : parties.length === 0 ? (
            <div className="py-10 text-center">
              <Gamepad2 size={28} className="mx-auto mb-3" style={{ color: '#2A2A35' }} />
              <p className="text-sm" style={{ color: '#5A5A6E' }}>Aucune partie pour l'instant.</p>
              <p className="text-xs mt-1" style={{ color: '#5A5A6E' }}>Créez-en une ou rejoignez via un code ci-dessus.</p>
            </div>
          ) : (
            <>
              {mesParties.length > 0 && (
                <div className="mb-4">
                  <p className="text-2xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: '#5A5A6E' }}>Parties que j'anime</p>
                  <PartieList parties={mesParties} getLink={getPartieLink} />
                </div>
              )}
              {mesParticipations.length > 0 && (
                <div>
                  <p className="text-2xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: '#5A5A6E' }}>Parties où je joue</p>
                  <PartieList parties={mesParticipations} getLink={getPartieLink} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Mes buzzers */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Radio size={15} style={{ color: '#6366F1' }} />
              <h2 className="font-semibold text-sm" style={{ color: '#ECECF0' }}>Mes buzzers</h2>
            </div>
            {buzzers.length > 0 && (
              <Link to="/compte" className="text-2xs font-medium" style={{ color: '#818CF8' }}>Gérer →</Link>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
          ) : buzzers.length === 0 ? (
            <div className="py-10 text-center">
              <Radio size={28} className="mx-auto mb-3" style={{ color: '#2A2A35' }} />
              <p className="text-sm mb-3" style={{ color: '#5A5A6E' }}>Aucun buzzer appairé.</p>
              <Link to="/compte" className="btn-secondary btn-sm">Ajouter un buzzer</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {buzzers.map(b => (
                <div key={b.id} className="flex flex-col items-center gap-2 rounded-lg p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} prenom={b.nom ?? b.mac.slice(-5)} size="sm" />
                  <div className="flex items-center gap-1">
                    {b.status === 'OFFLINE'
                      ? <WifiOff size={10} style={{ color: '#5A5A6E' }} />
                      : <Wifi size={10} style={{ color: b.status === 'IN_GAME' ? '#F59E0B' : '#22C55E' }} />}
                    <span className="text-2xs font-medium" style={{
                      color: b.status === 'OFFLINE' ? '#5A5A6E' : b.status === 'IN_GAME' ? '#F59E0B' : '#22C55E'
                    }}>
                      {b.status === 'OFFLINE' ? 'Hors ligne' : b.status === 'IN_GAME' ? 'En jeu' : 'Connecté'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

function PartieList({ parties, getLink }) {
  return (
    <ul className="space-y-1.5">
      {parties.map(p => {
        const link = getLink(p)
        const inner = (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#ECECF0' }}>{p.nom}</p>
              <p className="text-2xs mt-0.5 font-mono" style={{ color: '#5A5A6E' }}>
                {p.code} · {p.participants?.length ?? 0} joueur{(p.participants?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        )
        return (
          <li key={p.id}>
            {link ? <Link to={link} className="block hover:opacity-75 transition-opacity">{inner}</Link> : inner}
          </li>
        )
      })}
    </ul>
  )
}

function StatusBadge({ status }) {
  if (status === 'EN_ATTENTE') return <span className="badge-wait"><Clock size={9} />Attente</span>
  if (status === 'EN_COURS')   return <span className="badge-active"><Zap size={9} />En cours</span>
  return <span className="badge-done"><Trophy size={9} />Terminée</span>
}
