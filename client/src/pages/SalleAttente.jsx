import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import Layout from '../components/Layout.jsx'
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
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-6xl mb-4">🔍</p>
          <h2 className="text-2xl font-bold text-white mb-2">Partie introuvable</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.7)' }}>
            Le code <span className="font-mono text-white font-bold">{code}</span> ne correspond à aucune partie active.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary px-6 py-3">
            Retour au tableau de bord
          </button>
        </div>
      </Layout>
    )
  }

  if (!partie) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7C3AED', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">{partie.nom}</h1>
            <div className="flex items-center flex-wrap gap-3 mt-2">
              <span className="font-mono font-bold tracking-widest text-base px-3 py-1 rounded-lg" style={{ background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)' }}>
                {partie.code}
              </span>
              <span className="text-sm" style={{ color: 'rgba(156,163,175,0.6)' }}>
                {participants.length} joueur{participants.length > 1 ? 's' : ''} en attente
              </span>
              {isModeLibre && (
                <span className="badge-auto">
                  {partie.modeAuto ? '⏱ Automatique' : '🗳 Vote collectif'}
                </span>
              )}
            </div>
          </div>

          {canStart && (
            <button onClick={handleStart} disabled={starting || participants.length < 1}
              className="shrink-0 font-bold px-6 py-3 rounded-xl transition-all text-base"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', boxShadow: '0 4px 15px rgba(16,185,129,0.4)', opacity: (starting || participants.length < 1) ? 0.4 : 1 }}>
              {starting ? 'Lancement...' : '▶ Lancer'}
            </button>
          )}
        </div>

        {/* Grille */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* JOUEURS */}
          <section className="card p-5">
            <h2 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: 'rgba(196,181,253,0.5)' }}>
              Participants
            </h2>
            <ul className="space-y-2">
              {participants.map(p => {
                const buzzer = buzzersDispo.find(b => b.id === p.buzzerId) ?? p.buzzer
                return (
                  <li key={p.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
                    style={{
                      background: dragOverId === p.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${dragOverId === p.id ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                    onDragOver={isAnimateur ? e => { e.preventDefault(); setDragOverId(p.id) } : undefined}
                    onDragLeave={isAnimateur ? () => setDragOverId(null) : undefined}
                    onDrop={isAnimateur ? () => { setDragOverId(null); if (draggingBuzzer) assignBuzzer(p.id, draggingBuzzer) } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.userId ? '#34D399' : '#FBBF24' }} />
                      <div>
                        <p className="font-semibold text-white">{p.prenom}</p>
                        <p className="text-xs" style={{ color: 'rgba(156,163,175,0.5)' }}>
                          {p.isAnimateur ? 'Crée cette partie' : p.userId ? 'Compte Gbairai' : 'Invité'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {buzzer ? (
                        <>
                          <BuzzerAnime couleur={buzzer.couleur} statut={getBuzzerStatut(buzzer)} size="sm" />
                          {isAnimateur && (
                            <button onClick={() => unassignBuzzer(p.id)} title="Retirer le buzzer"
                              className="text-xs transition-colors ml-1" style={{ color: 'rgba(156,163,175,0.4)' }}>
                              ✕
                            </button>
                          )}
                        </>
                      ) : (
                        isAnimateur && (
                          <span className="text-xs italic" style={{ color: 'rgba(124,58,237,0.5)' }}>glisser un buzzer</span>
                        )
                      )}
                    </div>
                  </li>
                )
              })}

              {isAnimateur && (
                <li>
                  {showInvite ? (
                    <form onSubmit={handleInvite} className="flex gap-2">
                      <input type="text" placeholder="Prénom de l'invité" value={invitePrenom}
                        onChange={e => setInvitePrenom(e.target.value)} maxLength={50}
                        className="input flex-1 text-sm py-2" autoFocus />
                      <button type="submit" className="btn-primary text-sm px-3 py-2">Ajouter</button>
                      <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost text-sm px-3 py-2">✕</button>
                    </form>
                  ) : (
                    <button onClick={() => setShowInvite(true)}
                      className="w-full rounded-xl py-3 text-sm font-medium transition-all"
                      style={{ border: '1px dashed rgba(124,58,237,0.35)', color: 'rgba(196,181,253,0.5)' }}>
                      + Ajouter un invité sans compte
                    </button>
                  )}
                </li>
              )}
            </ul>
          </section>

          {/* BUZZERS */}
          {isAnimateur && (
            <section className="card p-5">
              <h2 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: 'rgba(196,181,253,0.5)' }}>
                Buzzers — glisser vers un joueur
              </h2>
              {unassignedBuzzers.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(156,163,175,0.5)' }}>Tous les buzzers sont assignés.</p>
              ) : (
                <ul className="space-y-2">
                  {unassignedBuzzers.map(b => (
                    <li key={b.id} draggable
                      onDragStart={() => setDraggingBuzzer(b)}
                      onDragEnd={() => { setDraggingBuzzer(null); setDragOverId(null) }}
                      className="flex items-center justify-between rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing select-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <p className="font-semibold text-white">{b.nom ?? b.mac.slice(-8)}</p>
                        <p className="text-xs mt-0.5" style={{ color: b.status === 'ONLINE' ? '#34D399' : 'rgba(156,163,175,0.5)' }}>
                          {b.status === 'ONLINE' ? '● Connecté' : b.status === 'AWAITING_CLAIM' ? '● Appairage...' : '● Hors ligne'}
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

        {/* Questions */}
        {isAnimateur && (
          <section className="mt-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#221445,#1A1035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setShowQuestions(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors"
              style={{ color: 'white' }}>
              <div className="flex items-center gap-3">
                <span>📋</span>
                <span className="font-bold">Questions</span>
                {questions.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(124,58,237,0.25)', color: '#C4B5FD' }}>
                    {questions.length}
                  </span>
                )}
                {savingQ && <span className="text-xs" style={{ color: 'rgba(156,163,175,0.5)' }}>Enregistrement...</span>}
              </div>
              <span style={{ color: 'rgba(196,181,253,0.5)' }}>{showQuestions ? '▲' : '▼'}</span>
            </button>
            {showQuestions && (
              <div className="px-5 pb-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <QuestionEditor questions={questions} onChange={handleQuestionsChange} />
              </div>
            )}
          </section>
        )}

        {/* Partage */}
        <div className="mt-6 rounded-2xl p-4 text-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <p className="text-sm" style={{ color: 'rgba(196,181,253,0.7)' }}>
            Partagez le code{' '}
            <span className="font-mono font-black text-xl tracking-widest" style={{ color: '#C4B5FD' }}>{partie.code}</span>
            {' '}pour inviter des joueurs
          </p>
        </div>
      </div>
    </Layout>
  )
}
