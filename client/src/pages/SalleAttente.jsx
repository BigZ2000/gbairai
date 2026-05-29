import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import QuestionEditor from '../components/QuestionEditor.jsx'
import {
  Users, Radio, Hash, Play, Plus, X, ChevronDown, ChevronUp,
  GripVertical, Loader2, SearchX, Wifi, WifiOff,
} from 'lucide-react'

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
  const myParticipant = participants.find(p => p.userId === user?.id)
  const canStart = isAnimateur || (isModeLibre && myParticipant)

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/by-code/${code}`)
    if (!res?.ok) { setNotFound(true); return }
    const p = await res.json()
    if (p.status === 'EN_COURS') { navigate(`/parties/${code}/jeu`, { replace: true }); return }
    if (p.status === 'TERMINEE' || p.status === 'ANNULEE') { setNotFound(true); return }
    setPartie(p)
    setParticipants(p.participants ?? [])
    setQuestions(Array.isArray(p.questions) ? p.questions : [])
  }, [code])

  useEffect(() => {
    load()
    apiFetch('/buzzers').then(r => r?.json()).then(b => { if (Array.isArray(b)) setBuzzersDispo(b) })
    joinRoom(code)

    const unsub = subscribe('salle_attente', (msg) => {
      if (msg.type === 'participant_joined') {
        setParticipants(prev => prev.find(p => p.id === msg.participant.id) ? prev : [...prev, msg.participant])
      }
      if (msg.type === 'buzzer_assigned') {
        setParticipants(prev => prev.map(p => p.id === msg.participantId ? { ...p, buzzerId: msg.buzzerId } : p))
      }
      if (msg.type === 'unassign_buzzer') {
        setParticipants(prev => prev.map(p => p.id === msg.participantId ? { ...p, buzzerId: null, buzzer: null } : p))
      }
      if (msg.type === 'game_started') {
        navigate(`/parties/${code}/jeu`, { replace: true })
      }
      if (msg.type === 'buzzer_status_update') {
        setBuzzersDispo(prev => prev.map(b => b.mac === msg.mac ? { ...b, status: msg.status } : b))
      }
    })
    return unsub
  }, [code])

  async function assignBuzzer(participantId, buzzer) {
    const res = await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, {
      method: 'POST', body: { buzzerId: buzzer.id },
    })
    if (res?.ok) {
      setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, buzzerId: buzzer.id, buzzer } : p))
    }
  }

  async function unassignBuzzer(participantId) {
    await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, { method: 'DELETE' })
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, buzzerId: null, buzzer: null } : p))
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!invitePrenom.trim()) return
    const res = await apiFetch(`/parties/${partie.id}/participants/invite`, {
      method: 'POST', body: { prenom: invitePrenom.trim() },
    })
    if (res?.ok) {
      const p = await res.json()
      setParticipants(prev => [...prev, p])
      setInvitePrenom('')
      setShowInvite(false)
    }
  }

  async function handleQuestionsChange(qs) {
    setQuestions(qs)
    setSavingQ(true)
    await apiFetch(`/parties/${partie.id}/questions`, { method: 'PATCH', body: { questions: qs } })
    setSavingQ(false)
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

  const unassignedBuzzers = buzzersDispo.filter(b => !participants.some(p => p.buzzerId === b.id))

  if (notFound) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <SearchX size={40} className="mb-4" style={{ color: '#2A2A35' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#ECECF0' }}>Partie introuvable</h2>
          <p className="text-sm mb-6" style={{ color: '#9090A0' }}>
            Le code <span className="font-mono font-bold" style={{ color: '#ECECF0' }}>{code}</span> ne correspond à aucune partie active.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Retour au tableau de bord</button>
        </div>
      </Layout>
    )
  }

  if (!partie) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#ECECF0' }}>{partie.nom}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="code-tag flex items-center gap-1"><Hash size={10} />{partie.code}</span>
              <span className="text-sm" style={{ color: '#9090A0' }}>
                {participants.length} joueur{participants.length !== 1 ? 's' : ''} en attente
              </span>
              {isModeLibre && (
                <span className="badge-indigo">
                  {partie.modeAuto ? 'Automatique' : 'Vote collectif'}
                </span>
              )}
            </div>
          </div>

          {canStart && (
            <button onClick={handleStart} disabled={starting || participants.length < 1}
              className="btn btn-lg shrink-0 gap-2 font-semibold"
              style={{
                background: participants.length < 1 ? 'rgba(34,197,94,0.2)' : '#22C55E',
                color: participants.length < 1 ? '#22C55E' : '#000',
                opacity: starting ? 0.6 : 1,
              }}>
              {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {starting ? 'Lancement…' : 'Lancer'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Participants */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} style={{ color: '#6366F1' }} />
              <h2 className="font-semibold text-sm" style={{ color: '#ECECF0' }}>Participants</h2>
            </div>

            <ul className="space-y-1.5">
              {participants.map(p => {
                const buzzer = buzzersDispo.find(b => b.id === p.buzzerId) ?? p.buzzer
                return (
                  <li key={p.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-150"
                    style={{
                      background: dragOverId === p.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${dragOverId === p.id ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                    onDragOver={isAnimateur ? e => { e.preventDefault(); setDragOverId(p.id) } : undefined}
                    onDragLeave={isAnimateur ? () => setDragOverId(null) : undefined}
                    onDrop={isAnimateur ? () => { setDragOverId(null); if (draggingBuzzer) assignBuzzer(p.id, draggingBuzzer) } : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.userId ? '#22C55E' : '#F59E0B' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#ECECF0' }}>{p.prenom}</p>
                        <p className="text-2xs" style={{ color: '#5A5A6E' }}>
                          {p.isAnimateur ? 'Animateur' : p.userId ? 'Membre' : 'Invité'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {buzzer
                        ? <>
                            <BuzzerAnime couleur={buzzer.couleur} statut={getBuzzerStatut(buzzer)} size="sm" />
                            {isAnimateur && (
                              <button onClick={() => unassignBuzzer(p.id)} className="btn-ghost" style={{ padding: '2px 4px' }}>
                                <X size={12} />
                              </button>
                            )}
                          </>
                        : isAnimateur && (
                            <span className="text-2xs italic" style={{ color: '#5A5A6E' }}>glisser →</span>
                          )
                      }
                    </div>
                  </li>
                )
              })}

              {isAnimateur && (
                <li>
                  {showInvite ? (
                    <form onSubmit={handleInvite} className="flex gap-1.5">
                      <input type="text" placeholder="Prénom de l'invité" value={invitePrenom}
                        onChange={e => setInvitePrenom(e.target.value)} maxLength={50}
                        className="input flex-1 text-sm" autoFocus />
                      <button type="submit" className="btn-primary btn-sm">OK</button>
                      <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost btn-sm"><X size={12} /></button>
                    </form>
                  ) : (
                    <button onClick={() => setShowInvite(true)}
                      className="w-full rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-1.5"
                      style={{ border: '1px dashed rgba(99,102,241,0.2)', color: '#5A5A6E' }}>
                      <Plus size={12} />Ajouter un invité
                    </button>
                  )}
                </li>
              )}
            </ul>
          </div>

          {/* Buzzers */}
          {isAnimateur && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Radio size={14} style={{ color: '#6366F1' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#ECECF0' }}>Buzzers disponibles</h2>
              </div>
              <p className="text-2xs mb-3" style={{ color: '#5A5A6E' }}>Glissez un buzzer vers un participant.</p>

              {unassignedBuzzers.length === 0 ? (
                <p className="text-sm" style={{ color: '#5A5A6E' }}>Tous les buzzers sont assignés.</p>
              ) : (
                <ul className="space-y-1.5">
                  {unassignedBuzzers.map(b => (
                    <li key={b.id} draggable
                      onDragStart={() => setDraggingBuzzer(b)}
                      onDragEnd={() => { setDraggingBuzzer(null); setDragOverId(null) }}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-2.5">
                        <GripVertical size={12} style={{ color: '#5A5A6E' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#ECECF0' }}>{b.nom ?? b.mac.slice(-8)}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {b.status === 'ONLINE'
                              ? <Wifi size={10} style={{ color: '#22C55E' }} />
                              : <WifiOff size={10} style={{ color: '#5A5A6E' }} />}
                            <span className="text-2xs" style={{ color: b.status === 'ONLINE' ? '#22C55E' : '#5A5A6E' }}>
                              {b.status === 'ONLINE' ? 'Connecté' : b.status === 'AWAITING_CLAIM' ? 'Appairage…' : 'Hors ligne'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Questions */}
        {isAnimateur && (
          <div className="card overflow-hidden mb-4">
            <button onClick={() => setShowQuestions(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold" style={{ color: '#ECECF0' }}>Questions</span>
                {questions.length > 0 && (
                  <span className="badge-indigo">{questions.length}</span>
                )}
                {savingQ && <span className="text-2xs" style={{ color: '#5A5A6E' }}>Enregistrement…</span>}
              </div>
              {showQuestions ? <ChevronUp size={14} style={{ color: '#5A5A6E' }} /> : <ChevronDown size={14} style={{ color: '#5A5A6E' }} />}
            </button>
            {showQuestions && (
              <div className="px-5 pb-5 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <QuestionEditor questions={questions} onChange={handleQuestionsChange} />
              </div>
            )}
          </div>
        )}

        {/* Code de partage */}
        <div className="rounded-lg p-4 text-center"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-sm" style={{ color: '#9090A0' }}>
            Partagez le code{' '}
            <span className="font-mono font-black text-lg tracking-widest" style={{ color: '#818CF8' }}>{partie.code}</span>
            {' '}pour inviter des joueurs
          </p>
        </div>
      </div>
    </Layout>
  )
}
