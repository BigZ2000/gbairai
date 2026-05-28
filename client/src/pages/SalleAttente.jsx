import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

export default function SalleAttente() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzersDispo, setBuzzersDispo] = useState([])
  const [draggingBuzzer, setDraggingBuzzer] = useState(null)
  const [invitePrenom, setInvitePrenom] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [starting, setStarting] = useState(false)

  const isAnimateur = partie?.animateurId === user?.id
  const isModeLibre = partie?.modeAuto || partie?.modeVote

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/${partieCode.toUpperCase()}`.replace('/parties/', '/parties/'))
    // Chercher par code
    const allRes = await apiFetch('/parties')
    if (!allRes?.ok) return
    const all = await allRes.json()
    const p = all.find(x => x.code === partieCode.toUpperCase())
    if (!p) return
    setPartie(p)
    setParticipants(p.participants ?? [])
  }, [partieCode])

  useEffect(() => {
    load()
    apiFetch('/buzzers').then(r => r?.json()).then(b => {
      if (b) setBuzzersDispo(b.filter(bz => bz.status !== 'OFFLINE'))
    })

    joinRoom(partieCode)

    const unsub = subscribe('salle_attente', (msg) => {
      if (msg.type === 'participant_joined') {
        setParticipants(prev => [...prev.filter(p => p.id !== msg.participant.id), msg.participant])
      }
      if (msg.type === 'buzzer_assigned') {
        setParticipants(prev => prev.map(p =>
          p.id === msg.participantId ? { ...p, buzzerId: msg.buzzerId } : p
        ))
      }
      if (msg.type === 'unassign_buzzer') {
        setParticipants(prev => prev.map(p =>
          p.id === msg.participantId ? { ...p, buzzerId: null } : p
        ))
      }
      if (msg.type === 'game_started') {
        navigate(`/parties/${partieCode}/jeu`)
      }
      if (msg.type === 'buzzer_status_update') {
        setBuzzersDispo(prev => prev.map(b =>
          b.mac === msg.mac ? { ...b, status: msg.status } : b
        ))
      }
    })

    return unsub
  }, [partieCode])

  async function assignBuzzer(participantId, buzzerId) {
    await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, {
      method: 'POST',
      body: { buzzerId },
    })
  }

  async function handleDrop(participantId) {
    if (!draggingBuzzer) return
    await assignBuzzer(participantId, draggingBuzzer.id)
    setDraggingBuzzer(null)
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, buzzerId: draggingBuzzer.id, buzzer: draggingBuzzer } : p
    ))
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!invitePrenom.trim()) return
    const res = await apiFetch(`/parties/${partie.id}/participants/invite`, {
      method: 'POST',
      body: { prenom: invitePrenom.trim() },
    })
    if (res?.ok) {
      const p = await res.json()
      setParticipants(prev => [...prev, p])
      setInvitePrenom('')
      setShowInvite(false)
    }
  }

  async function handleStart() {
    setStarting(true)
    const endpoint = isModeLibre
      ? null  // via WS
      : `/parties/${partie.id}/start`

    if (isModeLibre) {
      const myParticipant = participants.find(p => p.userId === user?.id)
      send({ type: 'start_game_collective', partieCode, participantId: myParticipant?.id })
    } else {
      await apiFetch(endpoint, { method: 'POST', body: {} })
    }
    setStarting(false)
  }

  function getBuzzerStatut(b) {
    if (!b || b.status === 'OFFLINE') return 'offline'
    if (b.status === 'IN_GAME') return 'pressed'
    return 'ready'
  }

  const unassignedBuzzers = buzzersDispo.filter(
    b => !participants.some(p => p.buzzerId === b.id)
  )

  if (!partie) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-purple-400">{partie.nom}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Code : <span className="text-white font-mono font-bold tracking-widest">{partie.code}</span>
              &nbsp;·&nbsp;En attente ({participants.length} joueur{participants.length > 1 ? 's' : ''})
            </p>
            {isModeLibre && (
              <span className="inline-block mt-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                {partie.modeAuto ? 'Mode automatique' : 'Mode vote collectif'}
              </span>
            )}
          </div>
          {(isAnimateur || isModeLibre) && (
            <button
              onClick={handleStart}
              disabled={starting || participants.length < 1}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              {starting ? 'Lancement...' : 'Lancer →'}
            </button>
          )}
        </div>

        {/* Grille joueurs + buzzers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* JOUEURS */}
          <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Joueurs</h2>
            <ul className="space-y-3">
              {participants.map(p => {
                const buzzer = buzzersDispo.find(b => b.id === p.buzzerId)
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
                    onDragOver={isAnimateur ? e => e.preventDefault() : undefined}
                    onDrop={isAnimateur ? () => handleDrop(p.id) : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${p.userId ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <div>
                        <p className="font-semibold">{p.prenom}</p>
                        {p.isAnimateur && <span className="text-xs text-purple-400">Animateur</span>}
                        {!p.userId && <span className="text-xs text-yellow-400">Invité</span>}
                      </div>
                    </div>
                    {buzzer ? (
                      <BuzzerAnime
                        couleur={buzzer.couleur}
                        statut={getBuzzerStatut(buzzer)}
                        size="sm"
                      />
                    ) : (
                      isAnimateur && (
                        <span className="text-xs text-gray-500 italic">
                          Glisser un buzzer ici
                        </span>
                      )
                    )}
                  </li>
                )
              })}

              {isAnimateur && (
                <li>
                  {showInvite ? (
                    <form onSubmit={handleInvite} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Prénom de l'invité"
                        value={invitePrenom}
                        onChange={e => setInvitePrenom(e.target.value)}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        autoFocus
                      />
                      <button type="submit" className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm">OK</button>
                      <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 px-2">✕</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowInvite(true)}
                      className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 text-gray-400 hover:text-purple-400 rounded-xl py-3 text-sm transition-colors"
                    >
                      + Ajouter un invité
                    </button>
                  )}
                </li>
              )}
            </ul>
          </section>

          {/* BUZZERS DISPONIBLES */}
          {isAnimateur && (
            <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Buzzers disponibles</h2>
              {unassignedBuzzers.length === 0 ? (
                <p className="text-gray-500 text-sm">Tous les buzzers sont assignés.</p>
              ) : (
                <ul className="space-y-3">
                  {unassignedBuzzers.map(b => (
                    <li
                      key={b.id}
                      draggable
                      onDragStart={() => setDraggingBuzzer(b)}
                      onDragEnd={() => setDraggingBuzzer(null)}
                      className="flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing"
                    >
                      <div>
                        <p className="font-semibold">{b.nom ?? b.mac.slice(-8)}</p>
                        <p className="text-xs text-gray-400">
                          {b.status === 'ONLINE' ? 'Connecté' : 'Hors ligne'}
                        </p>
                      </div>
                      <BuzzerAnime
                        couleur={b.couleur}
                        statut={getBuzzerStatut(b)}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Info partage */}
        <div className="mt-6 bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
          <p className="text-gray-400 text-sm">
            Partagez le code <span className="text-white font-mono font-bold text-lg tracking-widest">{partie.code}</span> pour inviter des joueurs
          </p>
        </div>
      </div>
    </div>
  )
}
