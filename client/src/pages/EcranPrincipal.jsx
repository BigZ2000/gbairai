import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

// Page d'affichage grand écran (projetée sur TV/vidéoprojecteur)
export default function EcranPrincipal() {
  const { partieCode } = useParams()
  const { apiFetch } = useAuth()
  const { joinRoom, subscribe } = useWs()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzerStatuts, setBuzzerStatuts] = useState({})
  const [winner, setWinner] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [votes, setVotes] = useState({ pour: 0, contre: 0, total: 0 })
  const [autoCountdown, setAutoCountdown] = useState(null)

  useEffect(() => {
    apiFetch('/parties').then(r => r?.json()).then(all => {
      if (!all) return
      const p = all.find(x => x.code === partieCode.toUpperCase())
      if (!p) return
      setPartie(p)
      setParticipants(p.participants ?? [])
    })

    joinRoom(partieCode)

    const unsub = subscribe('ecran_principal', (msg) => {
      if (msg.type === 'buzzer_pressed_visual') {
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'pressed' }))
        setTimeout(() => setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: winner?.mac === msg.mac ? 'winner' : 'ready' })), 200)
      }
      if (msg.type === 'buzzer_winner') {
        setWinner(msg)
        setBuzzerStatuts(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(mac => { next[mac] = mac === msg.mac ? 'winner' : 'locked' })
          return next
        })
      }
      if (msg.type === 'answer_validated') {
        setTimeout(() => setWinner(null), 1500)
      }
      if (msg.type === 'question_changed') {
        setQuestionIndex(msg.index)
        setWinner(null)
        setVotes({ pour: 0, contre: 0, total: 0 })
        setBuzzerStatuts(prev => {
          const next = {}
          Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
          return next
        })
      }
      if (msg.type === 'vote_update') {
        setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      }
      if (msg.type === 'auto_next_question') {
        let cd = msg.countdown ?? 3
        setAutoCountdown(cd)
        const t = setInterval(() => {
          cd--
          setAutoCountdown(cd > 0 ? cd : null)
          if (cd <= 0) clearInterval(t)
        }, 1000)
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

  const questions = partie?.questions ?? []
  const currentQ = questions[questionIndex]

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* En-tête grand écran */}
      <header className="px-8 py-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-3xl font-black text-purple-400">{partie?.nom ?? 'Gbairai'}</h1>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold tracking-widest text-white">{partieCode}</p>
          <p className="text-gray-400 text-sm">Scannez pour rejoindre</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {/* Question */}
        {currentQ && (
          <div className="bg-gray-900 rounded-3xl p-8 max-w-3xl w-full border border-gray-700 text-center shadow-2xl">
            <p className="text-gray-400 text-lg mb-3">Question {questionIndex + 1}</p>
            <p className="text-4xl font-black text-white leading-tight">
              {currentQ.question ?? currentQ}
            </p>
          </div>
        )}

        {/* Winner display */}
        {winner && (
          <div className="flex flex-col items-center gap-4 animate-winner_bounce">
            <BuzzerAnime
              couleur={participants.find(p => p.id === winner.participantId)?.buzzer?.couleur ?? '#6D28D9'}
              statut="winner"
              prenom={winner.prenom}
              size="xl"
            />
            <p className="text-5xl font-black text-white">{winner.prenom}</p>
            <p className="text-2xl text-green-400 font-bold">BUZZÉ EN PREMIER !</p>
          </div>
        )}

        {/* Mode vote : barre de votes grand écran */}
        {partie?.modeVote && winner && votes.total > 0 && (
          <div className="w-full max-w-xl">
            <div className="flex justify-between text-lg font-bold mb-2">
              <span className="text-green-400">👍 {votes.pour} bonne</span>
              <span className="text-red-400">{votes.contre} mauvaise 👎</span>
            </div>
            <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: votes.total > 0 ? `${(votes.pour / votes.total) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-center text-gray-400 mt-2">{votes.total} vote(s)</p>
          </div>
        )}

        {/* Countdown auto */}
        {autoCountdown && (
          <p className="text-8xl font-black text-amber-400">{autoCountdown}</p>
        )}

        {/* Buzzers de tous les joueurs */}
        {!winner && (
          <div className="flex flex-wrap justify-center gap-8">
            {participants.map(p => {
              const statut = p.buzzer?.mac
                ? (buzzerStatuts[p.buzzer.mac] ?? 'offline')
                : 'offline'
              return (
                <BuzzerAnime
                  key={p.id}
                  couleur={p.buzzer?.couleur ?? '#6B7280'}
                  statut={statut}
                  prenom={p.prenom}
                  size="lg"
                />
              )
            })}
          </div>
        )}
      </main>

      {/* Scores en bas */}
      <footer className="border-t border-gray-800 px-8 py-4">
        <div className="flex justify-center gap-8 flex-wrap">
          {[...participants]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                {i === 0 && <span className="text-amber-400 text-xl">🥇</span>}
                {i === 1 && <span className="text-gray-300 text-xl">🥈</span>}
                {i === 2 && <span className="text-amber-700 text-xl">🥉</span>}
                <span className="font-semibold">{p.prenom}</span>
                <span className="text-purple-400 font-bold">{p.score} pt{p.score > 1 ? 's' : ''}</span>
              </div>
            ))}
        </div>
      </footer>
    </div>
  )
}
