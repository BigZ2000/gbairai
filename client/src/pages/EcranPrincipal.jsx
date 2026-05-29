import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import { Trophy, Hash, Eye } from 'lucide-react'

export default function EcranPrincipal() {
  const { partieCode } = useParams()
  const { apiFetch } = useAuth()
  const { joinRoom, subscribe } = useWs()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzerStatuts, setBuzzerStatuts] = useState({})
  const [winner, setWinner] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [revealData, setRevealData] = useState(null)
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
      if (msg.type === 'answer_validated') {
        setTimeout(() => { setWinner(null); resetBuzzers() }, 1500)
      }
      if (msg.type === 'question_display') {
        setCurrentQuestion(msg.question)
        setQuestionIndex(msg.index ?? 0)
        setRevealed(false)
        setRevealData(null)
        setWinner(null)
        setVotes({ pour: 0, contre: 0, total: 0 })
        setBuzzerStatuts(prev => {
          const next = {}
          Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
          return next
        })
      }
      if (msg.type === 'question_reveal') {
        setRevealed(true)
        setRevealData({ reponse: msg.reponse, explication: msg.explication })
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

  function resetBuzzers() {
    setBuzzerStatuts(prev => {
      const next = {}
      Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
      return next
    })
  }

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)
  const q = currentQuestion

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
            {q && (
              <p className="text-sm mt-0.5" style={{ color: '#5A5A6E' }}>
                Question {questionIndex + 1}
                {q.mancheNom && ` · ${q.mancheNom}`}
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

        {/* Auto countdown */}
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
              </div>
            )}
          </div>
        )}

        {/* Question */}
        {!winner && q && (
          <div className="max-w-4xl w-full rounded-2xl overflow-hidden"
            style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-12 pt-10 pb-6 text-center">
              <p className="text-base uppercase tracking-widest font-semibold mb-6" style={{ color: '#5A5A6E' }}>
                Question {questionIndex + 1}
              </p>
              <p className="text-5xl font-bold leading-tight" style={{ color: '#ECECF0' }}>
                {q.enonce}
              </p>

              {/* QCM choices */}
              {q.type === 'QCM' && q.choix?.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {q.choix.map((c, i) => {
                    const colors = [
                      { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#818CF8' },
                      { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.3)',  text: '#4ADE80' },
                      { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)', text: '#FCD34D' },
                      { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)',  text: '#F87171' },
                    ]
                    const col = colors[i % 4]
                    const letter = ['A','B','C','D'][i]
                    const isCorrect = revealed && revealData?.reponse === letter
                    return (
                      <div key={i}
                        className="flex items-center gap-4 rounded-xl px-6 py-4 text-left transition-all duration-500"
                        style={{
                          background: isCorrect ? 'rgba(34,197,94,0.15)' : col.bg,
                          border: `2px solid ${isCorrect ? 'rgba(34,197,94,0.6)' : col.border}`,
                          transform: isCorrect ? 'scale(1.02)' : 'none',
                        }}>
                        <span className="text-3xl font-black" style={{ color: col.text }}>{letter}</span>
                        <span className="text-xl font-semibold" style={{ color: '#ECECF0' }}>{c}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* VRAI/FAUX */}
              {q.type === 'VRAI_FAUX' && (
                <div className="flex gap-6 justify-center mt-8">
                  {['Vrai', 'Faux'].map(val => {
                    const isGreen = val === 'Vrai'
                    const isCorrect = revealed && revealData?.reponse?.toLowerCase() === val.toLowerCase()
                    return (
                      <div key={val}
                        className="flex items-center gap-3 rounded-2xl px-12 py-6 text-3xl font-bold transition-all duration-500"
                        style={{
                          background: isCorrect ? (isGreen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') :
                                     isGreen ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                          border: `3px solid ${isCorrect ? (isGreen ? '#22C55E' : '#EF4444') :
                                   isGreen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          color: isGreen ? '#4ADE80' : '#F87171',
                          transform: isCorrect ? 'scale(1.06)' : 'none',
                        }}>
                        {isGreen ? '✅' : '❌'} {val}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Image */}
              {q.type === 'IMAGE' && q.mediaUrl && (
                <div className="mt-6 flex justify-center">
                  <img src={q.mediaUrl} alt="Question" className="max-h-80 rounded-2xl object-contain" />
                </div>
              )}
            </div>

            {/* Answer reveal panel */}
            <div className="relative overflow-hidden transition-all duration-700"
              style={{ maxHeight: revealed ? '200px' : '0px' }}>
              <div className="px-12 pb-8 pt-4 animate-fadeUp"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(34,197,94,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={18} style={{ color: '#4ADE80' }} />
                  <p className="text-sm uppercase tracking-widest font-semibold" style={{ color: '#4ADE80' }}>Réponse</p>
                </div>
                <p className="text-4xl font-black" style={{ color: '#ECECF0' }}>{revealData?.reponse}</p>
                {revealData?.explication && (
                  <p className="text-lg mt-2" style={{ color: '#9090A0' }}>{revealData.explication}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {!winner && !q && (
          <div className="text-center">
            <p className="text-3xl font-bold mb-3" style={{ color: '#ECECF0' }}>En attente…</p>
            <p className="text-lg" style={{ color: '#5A5A6E' }}>La prochaine question va apparaître ici.</p>
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
