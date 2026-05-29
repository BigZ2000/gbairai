import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

// Écran grand format — projeté sur TV / vidéoprojecteur
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
        p.participants.forEach(pt => {
          if (pt.buzzer?.mac) init[pt.buzzer.mac] = 'ready'
        })
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
      if (msg.type === 'participant_update') {
        setParticipants(msg.participants ?? [])
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
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: '#0A0618' }}>
      {/* Orbs décoratifs en arrière-plan */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{ top: '-10%', left: '-5%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div className="absolute" style={{ bottom: '-10%', right: '-5%', width: '45vw', height: '45vw', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 py-5"
        style={{ borderBottom: '1px solid rgba(124,58,237,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}>
            G
          </div>
          <div>
            <h1 className="text-2xl font-black text-white leading-none">{partie?.nom ?? 'Gbairai'}</h1>
            {questions.length > 0 && (
              <p className="text-sm mt-1" style={{ color: 'rgba(196,181,253,0.5)' }}>
                Question {questionIndex + 1} / {questions.length}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-4xl font-black font-mono tracking-[0.2em] text-white">{partieCode}</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(196,181,253,0.5)' }}>Code pour rejoindre</p>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-10 py-8 gap-10">

        {/* Countdown auto */}
        {autoCountdown && !winner && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(245,158,11,0.7)' }}>Prochaine question dans</p>
            <p className="text-[8rem] font-black leading-none" style={{ color: '#F59E0B', textShadow: '0 0 60px rgba(245,158,11,0.5)' }}>
              {autoCountdown}
            </p>
          </div>
        )}

        {/* Winner */}
        {winner && (
          <div className="flex flex-col items-center gap-6 animate-fadeIn">
            <BuzzerAnime
              couleur={participants.find(p => p.id === winner.participantId)?.buzzer?.couleur ?? '#7C3AED'}
              statut="winner"
              prenom={winner.prenom}
              size="xl"
            />
            <div className="text-center">
              <p className="text-8xl font-black text-white" style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}>
                {winner.prenom}
              </p>
              <p className="text-3xl font-bold mt-2" style={{ color: '#34D399', textShadow: '0 0 20px rgba(16,185,129,0.4)' }}>
                BUZZÉ EN PREMIER !
              </p>
            </div>

            {/* Votes grand écran */}
            {partie?.modeVote && votes.total > 0 && (
              <div className="w-full max-w-2xl mt-4">
                <div className="flex justify-between text-xl font-bold mb-3">
                  <span style={{ color: '#34D399' }}>👍 {votes.pour} bonne{votes.pour > 1 ? 's' : ''}</span>
                  <span style={{ color: '#FB7185' }}>{votes.contre} mauvaise{votes.contre > 1 ? 's' : ''} 👎</span>
                </div>
                <div className="h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: votes.total > 0 ? `${(votes.pour / votes.total) * 100}%` : '0%', background: 'linear-gradient(90deg,#10B981,#34D399)' }} />
                </div>
                <p className="text-center mt-2 text-lg" style={{ color: 'rgba(196,181,253,0.6)' }}>{votes.total} vote{votes.total > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        )}

        {/* Question courante */}
        {!winner && currentQ && (
          <div className="max-w-4xl w-full text-center rounded-3xl p-10"
            style={{ background: 'rgba(34,20,69,0.6)', border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 0 60px rgba(124,58,237,0.1)', backdropFilter: 'blur(12px)' }}>
            <p className="text-lg uppercase tracking-widest font-semibold mb-5" style={{ color: 'rgba(196,181,253,0.5)' }}>
              Question {questionIndex + 1}
            </p>
            <p className="text-5xl font-black text-white leading-tight">
              {currentQ.question ?? currentQ}
            </p>
          </div>
        )}

        {/* Buzzers des joueurs */}
        {!winner && (
          <div className="flex flex-wrap justify-center gap-10">
            {participants.map(p => {
              const statut = p.buzzer?.mac ? (buzzerStatuts[p.buzzer.mac] ?? 'offline') : 'offline'
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

      {/* Scoreboard */}
      <footer className="relative z-10 px-10 py-5"
        style={{ borderTop: '1px solid rgba(124,58,237,0.12)', background: 'rgba(15,10,30,0.6)', backdropFilter: 'blur(8px)' }}>
        <div className="flex justify-center gap-10 flex-wrap">
          {sortedParticipants.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              {i === 0 && <span className="text-2xl">🥇</span>}
              {i === 1 && <span className="text-2xl">🥈</span>}
              {i === 2 && <span className="text-2xl">🥉</span>}
              {i > 2 && <span className="text-lg font-bold" style={{ color: 'rgba(156,163,175,0.4)' }}>{i + 1}.</span>}
              <span className="text-lg font-bold text-white">{p.prenom}</span>
              <span className="text-lg font-black" style={{ color: '#FBBF24' }}>{p.score} pt{p.score !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {participants.length === 0 && (
            <p className="text-base" style={{ color: 'rgba(156,163,175,0.4)' }}>En attente de joueurs…</p>
          )}
        </div>
      </footer>
    </div>
  )
}
