import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

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
    p.participants.forEach(pt => {
      if (pt.buzzer?.mac) init[pt.buzzer.mac] = 'ready'
    })
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
      if (msg.type === 'vote_update') {
        setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      }
      if (msg.type === 'vote_result') {
        setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
        setTimeout(() => nextQuestion(), 2000)
      }
      if (msg.type === 'auto_next_question') {
        startAutoCountdown(msg.countdown ?? 3)
      }
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
      if (msg.type === 'game_ended') {
        navigate('/dashboard')
      }
      if (msg.type === 'participant_update') {
        setParticipants(msg.participants ?? [])
      }
      if (msg.type === 'buzzer_status_update') {
        setBuzzerStatuts(prev => ({
          ...prev,
          [msg.mac]: msg.status === 'OFFLINE' ? 'offline' : 'ready',
        }))
      }
    })

    return () => {
      unsub()
      clearInterval(countdownRef.current)
    }
  }, [partieCode])

  function startAutoCountdown(seconds) {
    clearInterval(countdownRef.current)
    setAutoCountdown(seconds)
    countdownRef.current = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          nextQuestion()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function nextQuestion() {
    send({ type: 'next_question', partieCode })
  }

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

  function endGame() {
    send({ type: 'end_game', partieCode })
    setEndConfirm(false)
  }

  if (!partie) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', boxShadow: '0 0 24px rgba(124,58,237,0.5)' }}>
            G
          </div>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7C3AED', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const questions = partie.questions ?? []
  const currentQ = questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0F0A1E' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(15,10,30,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(124,58,237,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}>G</div>
          <div>
            <p className="font-bold text-white leading-none">{partie.nom}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(196,181,253,0.55)' }}>
              Q{questionIndex + 1}{questions.length > 0 ? `/${questions.length}` : ''}
              {isModeAuto && ' · Auto'}
              {isModeVote && ' · Vote'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm px-3 py-1 rounded-lg"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)' }}>
            {partieCode}
          </span>
          {isAnimateur && !isModeAuto && !isModeVote && (
            <button onClick={nextQuestion} className="btn-ghost text-sm px-4 py-1.5">
              Suivant →
            </button>
          )}
          {isAnimateur && (
            <button onClick={() => setEndConfirm(true)}
              className="text-sm px-4 py-1.5 rounded-xl font-semibold transition-all"
              style={{ background: 'rgba(244,63,94,0.12)', color: '#FB7185', border: '1px solid rgba(244,63,94,0.25)' }}>
              Terminer
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Zone principale */}
        <main className="flex-1 p-6 flex flex-col items-center justify-center gap-6 overflow-y-auto">

          {/* Question */}
          {currentQ ? (
            <div className="card p-8 max-w-2xl w-full text-center animate-fadeIn">
              <p className="text-xs uppercase tracking-widest font-semibold mb-3"
                style={{ color: 'rgba(196,181,253,0.5)' }}>Question {questionIndex + 1}</p>
              <p className="text-2xl font-bold text-white leading-snug">{currentQ.question ?? currentQ}</p>
              {currentQ.reponse && (
                <p className="mt-4 text-base font-medium" style={{ color: 'rgba(196,181,253,0.6)' }}>
                  {currentQ.reponse}
                </p>
              )}
            </div>
          ) : (
            <div className="card p-8 max-w-2xl w-full text-center">
              <p className="text-5xl mb-4">🎯</p>
              <p className="text-xl font-bold text-white mb-2">Aucune question configurée</p>
              <p className="text-sm" style={{ color: 'rgba(156,163,175,0.6)' }}>
                Appuyez sur un buzzer pour commencer !
              </p>
            </div>
          )}

          {/* Winner banner */}
          {winner && (
            <div className="max-w-md w-full rounded-2xl p-6 text-center animate-fadeIn"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 32px rgba(16,185,129,0.15)' }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#34D399' }}>PREMIER !</p>
              <p className="text-3xl font-black text-white">{winner.prenom}</p>

              {isModeAuto && autoCountdown && (
                <p className="text-5xl font-black mt-3" style={{ color: '#FBBF24' }}>{autoCountdown}</p>
              )}

              {!isModeAuto && !isModeVote && isAnimateur && (
                <div className="flex gap-3 justify-center mt-5">
                  <button onClick={() => validateAnswer(true)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34D399' }}>
                    ✓ Bonne réponse
                  </button>
                  <button onClick={() => validateAnswer(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.35)', color: '#FB7185' }}>
                    ✗ Mauvaise réponse
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vote collectif */}
          {isModeVote && winner && (
            <div className="card p-6 max-w-md w-full animate-fadeIn">
              <p className="text-center text-sm font-semibold mb-5" style={{ color: 'rgba(196,181,253,0.7)' }}>
                La réponse est-elle correcte ?
              </p>
              <div className="flex gap-3 mb-5">
                <button onClick={() => handleVote(true)} disabled={myVote !== null}
                  className="flex-1 py-3 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
                  style={{
                    background: myVote === true ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${myVote === true ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.2)'}`,
                    color: '#34D399'
                  }}>
                  👍 Bonne
                </button>
                <button onClick={() => handleVote(false)} disabled={myVote !== null}
                  className="flex-1 py-3 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
                  style={{
                    background: myVote === false ? 'rgba(244,63,94,0.25)' : 'rgba(244,63,94,0.1)',
                    border: `1px solid ${myVote === false ? 'rgba(244,63,94,0.5)' : 'rgba(244,63,94,0.2)'}`,
                    color: '#FB7185'
                  }}>
                  👎 Mauvaise
                </button>
              </div>
              {votes.total > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(156,163,175,0.6)' }}>
                    <span style={{ color: '#34D399' }}>{votes.pour} pour</span>
                    <span style={{ color: '#FB7185' }}>{votes.contre} contre</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(votes.pour / votes.total) * 100}%`, background: 'linear-gradient(90deg,#10B981,#34D399)' }} />
                  </div>
                  <p className="text-xs text-center mt-2" style={{ color: 'rgba(156,163,175,0.5)' }}>
                    {votes.total}/{participants.length} vote{votes.total > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Sidebar joueurs */}
        <aside className="w-60 flex flex-col overflow-y-auto"
          style={{ borderLeft: '1px solid rgba(124,58,237,0.12)', background: 'rgba(26,16,53,0.5)' }}>
          <div className="p-4 pb-2">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(196,181,253,0.4)' }}>
              Joueurs · {participants.length}
            </p>
          </div>
          <div className="flex-1 p-3 space-y-2 overflow-y-auto">
            {sortedParticipants.map((p, i) => {
              const statut = p.buzzer?.mac ? (buzzerStatuts[p.buzzer.mac] ?? 'offline') : 'offline'
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl p-3 transition-all"
                  style={{ background: winner?.participantId === p.id ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${winner?.participantId === p.id ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)'}` }}>
                  <BuzzerAnime couleur={p.buzzer?.couleur ?? '#6B7280'} statut={statut} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && <span className="text-xs">🥇</span>}
                      {i === 1 && <span className="text-xs">🥈</span>}
                      {i === 2 && <span className="text-xs">🥉</span>}
                      <p className="text-sm font-bold text-white truncate">{p.prenom}</p>
                    </div>
                    <p className="text-xs font-bold mt-0.5" style={{ color: '#FBBF24' }}>
                      {p.score} pt{p.score !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
            {participants.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: 'rgba(156,163,175,0.4)' }}>
                Aucun joueur
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Modal fin de partie */}
      {endConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-sm w-full animate-fadeIn" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#F43F5E' }}>Terminer la partie ?</h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.7)' }}>
              Tous les joueurs seront redirigés vers le tableau de bord.
            </p>
            <div className="flex gap-3">
              <button onClick={endGame}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E' }}>
                Terminer
              </button>
              <button onClick={() => setEndConfirm(false)} className="btn-ghost flex-1 py-2.5 text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
