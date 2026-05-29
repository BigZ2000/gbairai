import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import {
  ChevronRight, Square, Trophy, ThumbsUp, ThumbsDown,
  Users, Hash, Loader2, Check, X,
} from 'lucide-react'

export default function AnimateurJeu() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzerStatuts, setBuzzerStatuts] = useState({})
  const [winner, setWinner] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [autoCountdown, setAutoCountdown] = useState(null)
  const [votes, setVotes] = useState({ pour: 0, contre: 0, total: 0 })
  const [myVote, setMyVote] = useState(null)
  const [endConfirm, setEndConfirm] = useState(false)
  const countdownRef = useRef(null)

  const isAnimateur = partie?.animateurId === user?.id
  const isModeAuto = partie?.modeAuto
  const isModeVote = partie?.modeVote
  const myParticipant = participants.find(p => p.userId === user?.id)

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/by-code/${partieCode.toUpperCase()}`)
    if (!res?.ok) return
    const p = await res.json()
    setPartie(p)
    setParticipants(p.participants ?? [])
    const init = {}
    p.participants.forEach(pt => { if (pt.buzzer?.mac) init[pt.buzzer.mac] = 'ready' })
    setBuzzerStatuts(init)
  }, [partieCode])

  useEffect(() => {
    load()
    joinRoom(partieCode)

    const unsub = subscribe('animateur_jeu', (msg) => {
      if (msg.type === 'buzzer_pressed_visual') {
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'pressed' }))
        setTimeout(() => setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'ready' })), 300)
      }
      if (msg.type === 'buzzer_winner') {
        setWinner(msg)
        setBuzzerStatuts(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(mac => { next[mac] = mac === msg.mac ? 'winner' : 'locked' })
          return next
        })
      }
      if (msg.type === 'vote_update') setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      if (msg.type === 'vote_result') {
        setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
        setTimeout(() => nextQuestion(), 2000)
      }
      if (msg.type === 'auto_next_question') startAutoCountdown(msg.countdown ?? 3)
      if (msg.type === 'question_changed') {
        setQuestionIndex(msg.index)
        setWinner(null)
        setMyVote(null)
        setVotes({ pour: 0, contre: 0, total: 0 })
        setBuzzerStatuts(prev => {
          const next = {}
          Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
          return next
        })
      }
      if (msg.type === 'game_ended') navigate('/dashboard')
      if (msg.type === 'participant_update') setParticipants(msg.participants ?? [])
      if (msg.type === 'buzzer_status_update') {
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: msg.status === 'OFFLINE' ? 'offline' : 'ready' }))
      }
    })

    return () => { unsub(); clearInterval(countdownRef.current) }
  }, [partieCode])

  function startAutoCountdown(seconds) {
    clearInterval(countdownRef.current)
    setAutoCountdown(seconds)
    countdownRef.current = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); nextQuestion(); return null }
        return prev - 1
      })
    }, 1000)
  }

  function nextQuestion() { send({ type: 'next_question', partieCode }) }

  function validateAnswer(valide) {
    if (!winner) return
    send({ type: 'validate_answer', partieCode, participantId: winner.participantId, valide, scoreIncrement: 1 })
    setWinner(null)
    setBuzzerStatuts(prev => {
      const next = {}
      Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
      return next
    })
  }

  function handleVote(valide) {
    if (myVote !== null) return
    setMyVote(valide)
    send({ type: 'submit_vote', partieCode, questionIndex, participantId: myParticipant?.id, valide })
  }

  function endGame() { send({ type: 'end_game', partieCode }); setEndConfirm(false) }

  if (!partie) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0E0E12' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
      </div>
    )
  }

  const questions = partie.questions ?? []
  const currentQ = questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0E0E12' }}>

      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 h-13"
        style={{ background: 'rgba(14,14,18,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)', minHeight: '52px' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white"
            style={{ background: '#6366F1' }}>G</div>
          <div>
            <p className="text-sm font-semibold leading-none" style={{ color: '#ECECF0' }}>{partie.nom}</p>
            <p className="text-2xs mt-0.5" style={{ color: '#5A5A6E' }}>
              Q{questionIndex + 1}{questions.length > 0 ? `/${questions.length}` : ''}
              {isModeAuto && ' · Auto'}{isModeVote && ' · Vote'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="code-tag flex items-center gap-1"><Hash size={9} />{partieCode}</span>
          {isAnimateur && !isModeAuto && !isModeVote && (
            <button onClick={nextQuestion} className="btn-secondary btn-sm gap-1">
              Suivant <ChevronRight size={13} />
            </button>
          )}
          {isAnimateur && (
            <button onClick={() => setEndConfirm(true)} className="btn-danger btn-sm gap-1">
              <Square size={12} />Fin
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Main */}
        <main className="flex-1 p-6 flex flex-col items-center justify-center gap-5 overflow-y-auto">

          {currentQ ? (
            <div className="card p-8 max-w-2xl w-full text-center animate-fadeUp">
              <p className="text-2xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#5A5A6E' }}>
                Question {questionIndex + 1}
              </p>
              <p className="text-2xl font-bold leading-snug" style={{ color: '#ECECF0' }}>{currentQ.question ?? currentQ}</p>
              {currentQ.reponse && (
                <p className="mt-4 text-sm" style={{ color: '#9090A0' }}>{currentQ.reponse}</p>
              )}
            </div>
          ) : (
            <div className="card p-8 max-w-2xl w-full text-center">
              <p className="text-lg font-semibold mb-2" style={{ color: '#ECECF0' }}>Aucune question configurée</p>
              <p className="text-sm" style={{ color: '#5A5A6E' }}>Appuyez sur un buzzer pour commencer !</p>
            </div>
          )}

          {/* Winner */}
          {winner && (
            <div className="max-w-md w-full rounded-xl p-6 text-center animate-fadeUp"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-2xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#4ADE80' }}>PREMIER</p>
              <p className="text-3xl font-bold" style={{ color: '#ECECF0' }}>{winner.prenom}</p>

              {isModeAuto && autoCountdown && (
                <p className="text-5xl font-black mt-3" style={{ color: '#F59E0B' }}>{autoCountdown}</p>
              )}

              {!isModeAuto && !isModeVote && isAnimateur && (
                <div className="flex gap-2 justify-center mt-5">
                  <button onClick={() => validateAnswer(true)} className="btn flex-1 gap-2"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ADE80' }}>
                    <ThumbsUp size={14} />Bonne
                  </button>
                  <button onClick={() => validateAnswer(false)} className="btn flex-1 gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
                    <ThumbsDown size={14} />Mauvaise
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vote */}
          {isModeVote && winner && (
            <div className="card p-5 max-w-md w-full animate-fadeUp">
              <p className="text-sm font-medium text-center mb-4" style={{ color: '#9090A0' }}>
                La réponse est-elle correcte ?
              </p>
              <div className="flex gap-2 mb-4">
                <button onClick={() => handleVote(true)} disabled={myVote !== null}
                  className="btn flex-1 gap-2"
                  style={{
                    background: myVote === true ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.06)',
                    border: `1px solid rgba(34,197,94,${myVote === true ? '0.4' : '0.15'})`,
                    color: '#4ADE80',
                  }}>
                  <ThumbsUp size={14} />Bonne
                </button>
                <button onClick={() => handleVote(false)} disabled={myVote !== null}
                  className="btn flex-1 gap-2"
                  style={{
                    background: myVote === false ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid rgba(239,68,68,${myVote === false ? '0.4' : '0.15'})`,
                    color: '#F87171',
                  }}>
                  <ThumbsDown size={14} />Mauvaise
                </button>
              </div>
              {votes.total > 0 && (
                <>
                  <div className="flex justify-between text-2xs mb-1.5" style={{ color: '#5A5A6E' }}>
                    <span style={{ color: '#4ADE80' }}>{votes.pour} pour</span>
                    <span style={{ color: '#F87171' }}>{votes.contre} contre</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(votes.pour / votes.total) * 100}%`, background: '#22C55E' }} />
                  </div>
                  <p className="text-2xs text-center mt-2" style={{ color: '#5A5A6E' }}>
                    {votes.total}/{participants.length} vote{votes.total !== 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-56 flex flex-col"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: '#141418' }}>
          <div className="p-4 pb-2 flex items-center gap-1.5">
            <Users size={13} style={{ color: '#5A5A6E' }} />
            <p className="text-2xs uppercase tracking-wider font-semibold" style={{ color: '#5A5A6E' }}>
              Joueurs · {participants.length}
            </p>
          </div>
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {sortedParticipants.map((p, i) => {
              const statut = p.buzzer?.mac ? (buzzerStatuts[p.buzzer.mac] ?? 'offline') : 'offline'
              return (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg p-2.5 transition-all"
                  style={{
                    background: winner?.participantId === p.id ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${winner?.participantId === p.id ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                  <BuzzerAnime couleur={p.buzzer?.couleur ?? '#6366F1'} statut={statut} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {i === 0 && <Trophy size={10} style={{ color: '#F59E0B' }} />}
                      <p className="text-xs font-medium truncate" style={{ color: '#ECECF0' }}>{p.prenom}</p>
                    </div>
                    <p className="text-2xs font-bold" style={{ color: '#F59E0B' }}>
                      {p.score} pt{p.score !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {/* End confirm modal */}
      {endConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-xs w-full animate-scaleIn"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-semibold mb-1" style={{ color: '#F87171' }}>Terminer la partie ?</h3>
            <p className="text-sm mb-5" style={{ color: '#9090A0' }}>
              Tous les joueurs seront redirigés vers le tableau de bord.
            </p>
            <div className="flex gap-2">
              <button onClick={endGame} className="btn-danger flex-1">Terminer</button>
              <button onClick={() => setEndConfirm(false)} className="btn-ghost flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
