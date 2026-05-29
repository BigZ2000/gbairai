import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import { Trophy, Hash } from 'lucide-react'

// Écran grand format — TV / vidéoprojecteur
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
    apiFetch(`/parties/by-code/${partieCode.toUpperCase()}`)
      .then(r => r?.json())
      .then(p => {
        if (!p) return
        setPartie(p)
        setParticipants(p.participants ?? [])
        const init = {}
        p.participants.forEach(pt => { if (pt.buzzer?.mac) init[pt.buzzer.mac] = 'ready' })
        setBuzzerStatuts(init)
      })

    joinRoom(partieCode)

    const unsub = subscribe('ecran_principal', (msg) => {
      if (msg.type === 'buzzer_pressed_visual') {
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'pressed' }))
        setTimeout(() => setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: 'ready' })), 200)
      }
      if (msg.type === 'buzzer_winner') {
        setWinner(msg)
        setBuzzerStatuts(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(mac => { next[mac] = mac === msg.mac ? 'winner' : 'locked' })
          return next
        })
      }
      if (msg.type === 'answer_validated') setTimeout(() => setWinner(null), 1500)
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
      if (msg.type === 'vote_update') setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      if (msg.type === 'participant_update') setParticipants(msg.participants ?? [])
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
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: msg.status === 'OFFLINE' ? 'offline' : 'ready' }))
      }
    })

    return unsub
  }, [partieCode])

  const questions = partie?.questions ?? []
  const currentQ = questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: '#0A0A0E' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-10 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black text-white"
            style={{ background: '#6366F1' }}>G</div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>{partie?.nom ?? 'Gbairai'}</h1>
            {questions.length > 0 && (
              <p className="text-sm mt-0.5" style={{ color: '#5A5A6E' }}>
                Question {questionIndex + 1} / {questions.length}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 justify-end mb-1">
            <Hash size={16} style={{ color: '#5A5A6E' }} />
            <p className="text-4xl font-black font-mono tracking-[0.15em]" style={{ color: '#ECECF0' }}>{partieCode}</p>
          </div>
          <p className="text-sm" style={{ color: '#5A5A6E' }}>Code pour rejoindre</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-10 py-10 gap-10">

        {/* Countdown */}
        {autoCountdown && !winner && (
          <div className="text-center">
            <p className="text-sm uppercase tracking-widest mb-3" style={{ color: '#5A5A6E' }}>Prochaine question dans</p>
            <p className="text-[9rem] font-black leading-none" style={{ color: '#F59E0B' }}>{autoCountdown}</p>
          </div>
        )}

        {/* Winner */}
        {winner && (
          <div className="flex flex-col items-center gap-6 animate-fadeUp">
            <BuzzerAnime
              couleur={participants.find(p => p.id === winner.participantId)?.buzzer?.couleur ?? '#6366F1'}
              statut="winner"
              prenom={winner.prenom}
              size="xl"
            />
            <div className="text-center">
              <p className="text-7xl font-black" style={{ color: '#ECECF0' }}>{winner.prenom}</p>
              <p className="text-2xl font-semibold mt-2" style={{ color: '#4ADE80' }}>BUZZÉ EN PREMIER</p>
            </div>

            {partie?.modeVote && votes.total > 0 && (
              <div className="w-full max-w-xl mt-2">
                <div className="flex justify-between text-lg font-semibold mb-3">
                  <span style={{ color: '#4ADE80' }}>{votes.pour} bonne{votes.pour > 1 ? 's' : ''}</span>
                  <span style={{ color: '#F87171' }}>{votes.contre} mauvaise{votes.contre > 1 ? 's' : ''}</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: votes.total > 0 ? `${(votes.pour / votes.total) * 100}%` : '0%', background: '#22C55E' }} />
                </div>
                <p className="text-center mt-2 text-base" style={{ color: '#5A5A6E' }}>{votes.total} vote{votes.total !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        )}

        {/* Question */}
        {!winner && currentQ && (
          <div className="max-w-4xl w-full text-center rounded-2xl p-12"
            style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-base uppercase tracking-widest font-semibold mb-6" style={{ color: '#5A5A6E' }}>
              Question {questionIndex + 1}
            </p>
            <p className="text-5xl font-bold leading-tight" style={{ color: '#ECECF0' }}>
              {currentQ.question ?? currentQ}
            </p>
          </div>
        )}

        {/* Buzzers */}
        {!winner && (
          <div className="flex flex-wrap justify-center gap-10">
            {participants.map(p => {
              const statut = p.buzzer?.mac ? (buzzerStatuts[p.buzzer.mac] ?? 'offline') : 'offline'
              return (
                <BuzzerAnime key={p.id} couleur={p.buzzer?.couleur ?? '#6B7280'}
                  statut={statut} prenom={p.prenom} size="lg" />
              )
            })}
          </div>
        )}
      </main>

      {/* Scoreboard */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111115' }}
        className="px-10 py-5">
        <div className="flex justify-center gap-10 flex-wrap">
          {sortedParticipants.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              {i === 0 && <Trophy size={18} style={{ color: '#F59E0B' }} />}
              {i === 1 && <Trophy size={18} style={{ color: '#9CA3AF' }} />}
              {i === 2 && <Trophy size={18} style={{ color: '#A16207' }} />}
              {i > 2 && <span className="text-base font-bold" style={{ color: '#2A2A35' }}>{i + 1}.</span>}
              <span className="text-lg font-semibold" style={{ color: '#ECECF0' }}>{p.prenom}</span>
              <span className="text-lg font-black" style={{ color: '#F59E0B' }}>{p.score} pt{p.score !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {participants.length === 0 && (
            <p className="text-base" style={{ color: '#2A2A35' }}>En attente de joueurs…</p>
          )}
        </div>
      </footer>
    </div>
  )
}
