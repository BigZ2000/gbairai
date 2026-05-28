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
  const [buzzerStatuts, setBuzzerStatuts] = useState({}) // mac → statut
  const [winner, setWinner] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [autoCountdown, setAutoCountdown] = useState(null)
  const [votes, setVotes] = useState({ pour: 0, contre: 0, total: 0 })
  const [voteTimer, setVoteTimer] = useState(null)
  const [myVote, setMyVote] = useState(null)
  const countdownRef = useRef(null)

  const isAnimateur = partie?.animateurId === user?.id
  const isModeAuto = partie?.modeAuto
  const isModeVote = partie?.modeVote
  const myParticipant = participants.find(p => p.userId === user?.id)

  const load = useCallback(async () => {
    const allRes = await apiFetch('/parties')
    if (!allRes?.ok) return
    const all = await allRes.json()
    const p = all.find(x => x.code === partieCode.toUpperCase())
    if (!p) return
    setPartie(p)
    setParticipants(p.participants ?? [])
    // Init statuts buzzers
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
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'winner' }))
        // Verrouiller les autres
        setBuzzerStatuts(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(mac => {
            if (mac !== msg.mac) next[mac] = 'locked'
          })
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
        navigate(`/dashboard`)
      }
      if (msg.type === 'buzzer_status_update') {
        setBuzzerStatuts(prev => ({
          ...prev,
          [msg.mac]: msg.status === 'OFFLINE' ? 'offline' : 'ready',
        }))
      }
    })

    return unsub
  }, [partieCode])

  function startAutoCountdown(seconds) {
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
    send({
      type: 'validate_answer',
      partieCode,
      participantId: winner.participantId,
      valide,
      scoreIncrement: 1,
    })
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
    send({
      type: 'submit_vote',
      partieCode,
      questionIndex,
      participantId: myParticipant?.id,
      valide,
    })
  }

  async function endGame() {
    if (!confirm('Terminer la partie ?')) return
    send({ type: 'end_game', partieCode })
  }

  if (!partie) {
    return <div className="flex items-center justify-center h-screen text-gray-400">Chargement...</div>
  }

  const questions = partie.questions ?? []
  const currentQ = questions[questionIndex]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-purple-400">{partie.nom}</h1>
          <p className="text-xs text-gray-400">
            Question {questionIndex + 1}{questions.length > 0 ? `/${questions.length}` : ''}
            {isModeAuto && ' · Mode auto'}
            {isModeVote && ' · Mode vote'}
          </p>
        </div>
        {(isAnimateur || isModeLibre) && (
          <div className="flex gap-2">
            {!isModeAuto && !isModeVote && isAnimateur && (
              <button
                onClick={nextQuestion}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Question suivante →
              </button>
            )}
            <button
              onClick={endGame}
              className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Terminer
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 gap-0">
        {/* Zone principale */}
        <main className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
          {/* Question courante */}
          {currentQ && (
            <div className="bg-gray-900 rounded-2xl p-6 max-w-xl w-full border border-gray-700 text-center">
              <p className="text-gray-400 text-sm mb-2">Question {questionIndex + 1}</p>
              <p className="text-xl font-bold text-white">{currentQ.question ?? currentQ}</p>
            </div>
          )}

          {/* Winner */}
          {winner && (
            <div className="bg-green-900/30 border border-green-500 rounded-2xl p-6 text-center max-w-sm w-full">
              <p className="text-green-400 text-lg font-bold">PREMIER !</p>
              <p className="text-2xl font-black text-white mt-1">{winner.prenom}</p>

              {/* Boutons validation animateur */}
              {!isModeAuto && !isModeVote && isAnimateur && (
                <div className="flex gap-3 justify-center mt-4">
                  <button
                    onClick={() => validateAnswer(true)}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded-xl"
                  >
                    Bonne réponse
                  </button>
                  <button
                    onClick={() => validateAnswer(false)}
                    className="bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-2 rounded-xl"
                  >
                    Mauvaise réponse
                  </button>
                </div>
              )}

              {/* Countdown mode auto */}
              {isModeAuto && autoCountdown && (
                <p className="text-amber-400 mt-3 text-2xl font-black">{autoCountdown}s</p>
              )}
            </div>
          )}

          {/* Interface vote collectif */}
          {isModeVote && winner && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
              <p className="text-center text-gray-400 text-sm mb-4">Votez sur la réponse</p>

              <div className="flex gap-3 justify-center mb-4">
                <button
                  onClick={() => handleVote(true)}
                  disabled={myVote !== null}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
                    myVote === true ? 'bg-green-600 text-white' : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'
                  } disabled:opacity-50`}
                >
                  👍 Bonne
                </button>
                <button
                  onClick={() => handleVote(false)}
                  disabled={myVote !== null}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
                    myVote === false ? 'bg-red-700 text-white' : 'bg-red-700/20 hover:bg-red-700/40 text-red-400'
                  } disabled:opacity-50`}
                >
                  👎 Mauvaise
                </button>
              </div>

              {/* Barre de progression vote */}
              {votes.total > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{votes.pour} pour</span>
                    <span>{votes.contre} contre</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(votes.pour / votes.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    {votes.total} / {participants.length} vote(s)
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Colonne latérale buzzers */}
        <aside className="w-56 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4">Joueurs</h3>
          <div className="space-y-3">
            {participants.map(p => {
              const statut = p.buzzer?.mac
                ? (buzzerStatuts[p.buzzer.mac] ?? 'offline')
                : 'offline'
              return (
                <div key={p.id} className="flex items-center gap-2 bg-gray-900 rounded-xl p-2">
                  <BuzzerAnime
                    couleur={p.buzzer?.couleur ?? '#6B7280'}
                    statut={statut}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.prenom}</p>
                    <p className="text-xs text-amber-400 font-bold">{p.score} pt{p.score > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}

const isModeLibre = false // placé en dehors pour éviter erreur de scope
