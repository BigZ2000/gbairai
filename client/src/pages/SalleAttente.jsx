import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import QuestionEditor from '../components/QuestionEditor.jsx'

export default function SalleAttente() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzersDispo, setBuzzersDispo] = useState([])
  const [draggingBuzzer, setDraggingBuzzer] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [invitePrenom, setInvitePrenom] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [questions, setQuestions] = useState([])
  const [showQuestions, setShowQuestions] = useState(false)
  const [savingQ, setSavingQ] = useState(false)

  const code = partieCode?.toUpperCase()

  const isAnimateur = partie?.animateurId === user?.id
  const isModeLibre = partie?.modeAuto || partie?.modeVote
  // En mode libre, le créateur (isAnimateur dans le participant) peut aussi lancer
  const myParticipant = participants.find(p => p.userId === user?.id)
  const canStart = isAnimateur || (isModeLibre && myParticipant)

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/by-code/${code}`)
    if (!res?.ok) {
      setNotFound(true)
      return
    }
    const p = await res.json()
    if (p.status === 'EN_COURS') {
      navigate(`/parties/${code}/jeu`, { replace: true })
      return
    }
    if (p.status === 'TERMINEE' || p.status === 'ANNULEE') {
      setNotFound(true)
      return
    }
    setPartie(p)
    setParticipants(p.participants ?? [])
    setQuestions(Array.isArray(p.questions) ? p.questions : [])
  }, [code])

  useEffect(() => {
    load()
    apiFetch('/buzzers').then(r => r?.json()).then(b => {
      if (Array.isArray(b)) setBuzzersDispo(b)
    })

    joinRoom(code)

    const unsub = subscribe('salle_attente', (msg) => {
      if (msg.type === 'participant_joined') {
        setParticipants(prev => {
          const exists = prev.find(p => p.id === msg.participant.id)
          return exists ? prev : [...prev, msg.participant]
        })
      }
      if (msg.type === 'buzzer_assigned') {
        setParticipants(prev => prev.map(p =>
          p.id === msg.participantId ? { ...p, buzzerId: msg.buzzerId } : p
        ))
      }
      if (msg.type === 'unassign_buzzer') {
        setParticipants(prev => prev.map(p =>
          p.id === msg.participantId ? { ...p, buzzerId: null, buzzer: null } : p
        ))
      }
      if (msg.type === 'game_started') {
        navigate(`/parties/${code}/jeu`, { replace: true })
      }
      if (msg.type === 'buzzer_status_update') {
        setBuzzersDispo(prev => prev.map(b =>
          b.mac === msg.mac ? { ...b, status: msg.status } : b
        ))
      }
    })

    return unsub
  }, [code])

  async function assignBuzzer(participantId, buzzer) {
    const res = await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, {
      method: 'POST',
      body: { buzzerId: buzzer.id },
    })
    if (res?.ok) {
      setParticipants(prev => prev.map(p =>
        p.id === participantId ? { ...p, buzzerId: buzzer.id, buzzer } : p
      ))
    }
  }

  async function unassignBuzzer(participantId) {
    await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, { method: 'DELETE' })
    setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, buzzerId: null, buzzer: null } : p
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

  async function saveQuestions(qs) {
    setSavingQ(true)
    await apiFetch(`/parties/${partie.id}/questions`, {
      method: 'PATCH',
      body: { questions: qs },
    })
    setSavingQ(false)
  }

  async function handleQuestionsChange(qs) {
    setQuestions(qs)
    await saveQuestions(qs)
  }

  async function handleStart() {
    setStarting(true)
    try {
      if (isModeLibre) {
        send({ type: 'start_game_collective', partieCode: code, participantId: myParticipant?.id })
      } else {
        const res = await apiFetch(`/parties/${partie.id}/start`, { method: 'POST', body: {} })
        if (!res?.ok) {
          const err = await res?.json()
          alert(err?.error ?? 'Impossible de lancer')
        }
      }
    } finally {
      setStarting(false)
    }
  }

  function getBuzzerStatut(b) {
    if (!b || b.status === 'OFFLINE') return 'offline'
    if (b.status === 'IN_GAME') return 'pressed'
    return 'ready'
  }

  const unassignedBuzzers = buzzersDispo.filter(
    b => !participants.some(p => p.buzzerId === b.id)
  )

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">🔍</p>
          <h2 className="text-2xl font-bold text-white mb-2">Partie introuvable</h2>
          <p className="text-gray-400 mb-6">Le code <span className="font-mono text-white">{code}</span> ne correspond à aucune partie active.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-xl"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  if (!partie) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-purple-400">{partie.nom}</h1>
            <p className="text-gray-400 text-sm mt-1">
              Code :{' '}
              <span className="text-white font-mono font-bold tracking-widest bg-gray-800 px-2 py-0.5 rounded">
                {partie.code}
              </span>
              <span className="ml-2 text-gray-500">
                · {participants.length} joueur{participants.length > 1 ? 's' : ''} en attente
              </span>
            </p>
            {isModeLibre && (
              <span className="inline-block mt-1.5 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                {partie.modeAuto ? 'Mode automatique' : 'Mode vote collectif'}
              </span>
            )}
          </div>

          {canStart && (
            <button
              onClick={handleStart}
              disabled={starting || participants.length < 1}
              className="shrink-0 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              {starting ? 'Lancement...' : 'Lancer →'}
            </button>
          )}
        </div>

        {/* Grille */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* JOUEURS */}
          <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-4">Joueurs</h2>
            <ul className="space-y-2">
              {participants.map(p => {
                const buzzer = buzzersDispo.find(b => b.id === p.buzzerId) ?? p.buzzer
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                      dragOverId === p.id ? 'bg-purple-900/40 border border-purple-500' : 'bg-gray-800'
                    }`}
                    onDragOver={isAnimateur ? e => { e.preventDefault(); setDragOverId(p.id) } : undefined}
                    onDragLeave={isAnimateur ? () => setDragOverId(null) : undefined}
                    onDrop={isAnimateur ? () => { setDragOverId(null); if (draggingBuzzer) assignBuzzer(p.id, draggingBuzzer) } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.userId ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <div>
                        <p className="font-semibold">{p.prenom}</p>
                        <p className="text-xs text-gray-500">
                          {p.isAnimateur ? 'Anime cette partie' : p.userId ? 'Joueur' : 'Invité'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {buzzer ? (
                        <>
                          <BuzzerAnime couleur={buzzer.couleur} statut={getBuzzerStatut(buzzer)} size="sm" />
                          {isAnimateur && (
                            <button
                              onClick={() => unassignBuzzer(p.id)}
                              className="text-gray-500 hover:text-red-400 text-xs ml-1"
                              title="Retirer le buzzer"
                            >
                              ✕
                            </button>
                          )}
                        </>
                      ) : (
                        isAnimateur && (
                          <span className="text-xs text-gray-600 italic">glisser un buzzer</span>
                        )
                      )}
                    </div>
                  </li>
                )
              })}

              {/* Ajouter invité */}
              {isAnimateur && (
                <li>
                  {showInvite ? (
                    <form onSubmit={handleInvite} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Prénom de l'invité"
                        value={invitePrenom}
                        onChange={e => setInvitePrenom(e.target.value)}
                        maxLength={50}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        autoFocus
                      />
                      <button type="submit" className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm">Ajouter</button>
                      <button type="button" onClick={() => setShowInvite(false)} className="text-gray-400 px-2">✕</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowInvite(true)}
                      className="w-full border-2 border-dashed border-gray-700 hover:border-purple-500 text-gray-500 hover:text-purple-400 rounded-xl py-3 text-sm transition-colors"
                    >
                      + Ajouter un invité sans compte
                    </button>
                  )}
                </li>
              )}
            </ul>
          </section>

          {/* BUZZERS DISPONIBLES (animateur uniquement) */}
          {isAnimateur && (
            <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-4">
                Buzzers disponibles — glisser vers un joueur
              </h2>
              {unassignedBuzzers.length === 0 ? (
                <p className="text-gray-500 text-sm">Tous les buzzers sont assignés.</p>
              ) : (
                <ul className="space-y-2">
                  {unassignedBuzzers.map(b => (
                    <li
                      key={b.id}
                      draggable
                      onDragStart={() => setDraggingBuzzer(b)}
                      onDragEnd={() => { setDraggingBuzzer(null); setDragOverId(null) }}
                      className="flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing select-none"
                    >
                      <div>
                        <p className="font-semibold">{b.nom ?? b.mac.slice(-8)}</p>
                        <p className="text-xs text-gray-400">
                          {b.status === 'ONLINE' ? '🟢 Connecté' : b.status === 'AWAITING_CLAIM' ? '🟣 Appairage...' : '⚫ Hors ligne'}
                        </p>
                      </div>
                      <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* ÉDITEUR DE QUESTIONS (animateur uniquement) */}
        {isAnimateur && (
          <section className="mt-6 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowQuestions(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <span className="font-semibold text-white">Questions</span>
                {questions.length > 0 && (
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                    {questions.length} question{questions.length > 1 ? 's' : ''}
                  </span>
                )}
                {savingQ && <span className="text-xs text-gray-400">Enregistrement...</span>}
              </div>
              <span className="text-gray-400 text-sm">{showQuestions ? '▲' : '▼'}</span>
            </button>

            {showQuestions && (
              <div className="px-5 pb-5 border-t border-gray-800 pt-4">
                <QuestionEditor questions={questions} onChange={handleQuestionsChange} />
              </div>
            )}
          </section>
        )}

        {/* Code partage */}
        <div className="mt-6 bg-gray-900/50 rounded-2xl p-4 border border-gray-800 text-center">
          <p className="text-gray-400 text-sm">
            Partagez le code{' '}
            <span className="text-white font-mono font-bold text-lg tracking-widest">{partie.code}</span>
            {' '}pour inviter des joueurs
          </p>
        </div>
      </div>
    </div>
  )
}
