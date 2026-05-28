import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

export default function Dashboard() {
  const { user, logout, apiFetch } = useAuth()
  const { connected } = useWs()
  const navigate = useNavigate()

  const [parties, setParties] = useState([])
  const [buzzers, setBuzzers] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch('/parties').then(r => r?.json()),
      apiFetch('/buzzers').then(r => r?.json()),
    ]).then(([p, b]) => {
      if (p) setParties(p)
      if (b) setBuzzers(b)
    }).finally(() => setLoading(false))
  }, [])

  const heure = new Date().getHours()
  const salutation = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bonsoir' : 'Bonsoir'

  const mesParties = parties.filter(p => p.animateurId === user?.id)
  const mesParticipations = parties.filter(p => p.animateurId !== user?.id)

  async function handleJoin(e) {
    e.preventDefault()
    setJoinError('')
    const res = await apiFetch('/parties/join', { method: 'POST', body: { code: joinCode.toUpperCase() } })
    if (!res?.ok) {
      const err = await res?.json()
      setJoinError(err?.error ?? 'Code invalide')
      return
    }
    const { partie } = await res.json()
    navigate(`/parties/${partie.code}/attente`)
  }

  function getBuzzerStatut(buzzer) {
    if (buzzer.status === 'OFFLINE') return 'offline'
    if (buzzer.status === 'IN_GAME') return 'pressed'
    return 'ready'
  }

  function getPartieLabel(status) {
    if (status === 'EN_ATTENTE') return { label: 'En attente', cls: 'bg-yellow-500/20 text-yellow-400' }
    if (status === 'EN_COURS') return { label: 'En cours', cls: 'bg-green-500/20 text-green-400' }
    return { label: 'Terminée', cls: 'bg-gray-500/20 text-gray-400' }
  }

  function getPartieLink(partie) {
    if (partie.status === 'EN_ATTENTE') return `/parties/${partie.code}/attente`
    if (partie.status === 'EN_COURS') return `/parties/${partie.code}/jeu`
    return '#'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-purple-400">Gbairai</h1>
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            <Link to="/compte" className="text-gray-400 hover:text-white text-sm">Mon compte</Link>
            <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Déconnexion</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Salutation + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">
            {salutation}, {user?.prenom} 👋
          </h2>
          <Link
            to="/parties/new"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            + Créer une partie
          </Link>
        </div>

        {/* Rejoindre */}
        <form onSubmit={handleJoin} className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Code de partie (ex: QUIZ42)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white uppercase tracking-widest focus:outline-none focus:border-purple-500"
            />
            {joinError && <p className="text-red-400 text-sm mt-1">{joinError}</p>}
          </div>
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            Rejoindre →
          </button>
        </form>

        {/* Deux colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* MES PARTIES */}
          <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-lg font-bold mb-4 text-gray-200">Mes parties</h3>

            {loading ? (
              <p className="text-gray-500 text-sm">Chargement...</p>
            ) : (
              <>
                {mesParties.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Créées par moi</p>
                    <ul className="space-y-2">
                      {mesParties.map(p => {
                        const { label, cls } = getPartieLabel(p.status)
                        return (
                          <li key={p.id}>
                            <Link
                              to={getPartieLink(p)}
                              className="flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-white">{p.nom}</p>
                                <p className="text-xs text-gray-400">{p.code} · {p.participants?.length ?? 0} joueur(s)</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {mesParticipations.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Mes participations</p>
                    <ul className="space-y-2">
                      {mesParticipations.map(p => {
                        const { label, cls } = getPartieLabel(p.status)
                        return (
                          <li key={p.id}>
                            <Link
                              to={getPartieLink(p)}
                              className="flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-white">{p.nom}</p>
                                <p className="text-xs text-gray-400">{p.code}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {parties.length === 0 && (
                  <p className="text-gray-500 text-sm">Aucune partie pour l'instant.</p>
                )}
              </>
            )}
          </section>

          {/* MES BUZZERS */}
          <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-lg font-bold mb-4 text-gray-200">Mes buzzers</h3>

            {buzzers.length === 0 ? (
              <p className="text-gray-500 text-sm mb-4">Aucun buzzer appairé.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {buzzers.map(b => (
                  <div key={b.id} className="flex flex-col items-center gap-2 bg-gray-800 rounded-xl p-3">
                    <BuzzerAnime
                      couleur={b.couleur}
                      statut={getBuzzerStatut(b)}
                      prenom={b.nom ?? b.mac.slice(-5)}
                      size="sm"
                    />
                    <p className="text-xs text-gray-400">
                      {b.status === 'OFFLINE' ? 'Hors ligne' : b.status === 'IN_GAME' ? 'En jeu' : 'Connecté'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Link
              to="/compte"
              className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              + Gérer mes buzzers
            </Link>
          </section>
        </div>
      </main>
    </div>
  )
}
