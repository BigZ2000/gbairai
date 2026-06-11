import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import QuestionMedia from '../components/QuestionMedia.jsx'
import Podium from '../components/Podium.jsx'
import { Trophy, Hash, Eye, Timer, Zap, Heart, Skull, AlertTriangle, Check, X } from 'lucide-react'

// Palette stable pour les buzzers virtuels (joueurs sur téléphone, sans matériel).
const WEB_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#0EA5E9', '#A855F7', '#EF4444', '#14B8A6']

export default function EcranPrincipal() {
  const { partieCode } = useParams()
  const { apiFetch } = useAuth()
  const { joinRoom, leaveRoom, subscribe } = useWs()

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
  const [finalClassement, setFinalClassement] = useState(null)
  const [mediaState, setMediaState] = useState(null)
  // Chronomètre géant : échéance (ms) + durée totale de la question (s).
  const [deadline, setDeadline] = useState(null)
  const [totalTemps, setTotalTemps] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())
  // Récapitulatif de fin de manche (classement intermédiaire) affiché ~7 s.
  const [mancheRecap, setMancheRecap] = useState(null)
  const prevMancheRef = useRef(null)
  const prevMancheNomRef = useRef(null)
  const recapTimerRef = useRef(null)

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
        setDeadline(null) // un buzz fige le chronomètre de la question
        setBuzzerStatuts(prev => {
          const next = { ...prev }
          Object.keys(next).forEach(mac => { next[mac] = mac === msg.mac ? 'winner' : 'locked' })
          return next
        })
      }
      if (msg.type === 'answer_validated') {
        // Bonne réponse uniquement : on laisse le badge gagnant 1,5 s puis on
        // nettoie. En cas de mauvaise réponse, c'est `buzz_reopened` qui pilote
        // (évite d'effacer par erreur un nouveau gagnant « vol »).
        if (msg.valide) setTimeout(() => { setWinner(null); resetBuzzers() }, 1500)
      }
      if (msg.type === 'buzz_reopened') {
        setWinner(null); resetBuzzers()
      }
      if (msg.type === 'question_display') {
        setCurrentQuestion(msg.question)
        setQuestionIndex(msg.index ?? 0)
        setRevealed(false)
        setRevealData(null)
        setWinner(null)
        setMediaState(null)
        setVotes({ pour: 0, contre: 0, total: 0 })
        // Démarre le chronomètre géant à partir du temps restant calculé serveur.
        if (msg.question && msg.remainingMs != null) {
          setDeadline(Date.now() + msg.remainingMs)
          setTotalTemps(msg.tempsLimite ?? null)
        } else {
          setDeadline(null); setTotalTemps(null)
        }
        // Détection d'un changement de manche → récapitulatif intermédiaire.
        const newManche = msg.question?.mancheOrdre ?? null
        if (prevMancheRef.current != null && newManche != null && newManche !== prevMancheRef.current) {
          setMancheRecap({ nom: prevMancheNomRef.current ?? `Manche ${prevMancheRef.current}`, ordre: prevMancheRef.current })
          clearTimeout(recapTimerRef.current)
          recapTimerRef.current = setTimeout(() => setMancheRecap(null), 7000)
        }
        if (newManche != null) { prevMancheRef.current = newManche; prevMancheNomRef.current = msg.question?.mancheNom ?? null }
        setBuzzerStatuts(prev => {
          const next = {}
          Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
          return next
        })
      }
      if (msg.type === 'media_state') {
        setMediaState(msg.hasMedia ? { playing: msg.playing, position: msg.position, seq: msg.seq } : null)
      }
      if (msg.type === 'question_reveal') {
        setRevealed(true)
        setDeadline(null) // la révélation arrête le chronomètre
        setRevealData({ reponse: msg.reponse, explication: msg.explication, correctIndex: msg.correctIndex ?? -1 })
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
      if (msg.type === 'game_ended') setFinalClassement(msg.classement ?? [])
    })

    return () => { unsub(); leaveRoom(partieCode) }
  }, [partieCode])

  function resetBuzzers() {
    setBuzzerStatuts(prev => {
      const next = {}
      Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
      return next
    })
  }

  // Tic du chronomètre géant (tant qu'une échéance est active).
  useEffect(() => {
    if (deadline == null) return
    const t = setInterval(() => setNowTick(Date.now()), 250)
    return () => clearInterval(t)
  }, [deadline])

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)
  const q = currentQuestion

  // Progression globale : nombre total de questions tirées (somme des manches).
  const totalQuestions = (partie?.manches ?? []).reduce((s, m) => s + (m.nbQuestions ?? 0), 0)
  // Secondes restantes affichées par le chronomètre géant.
  const secondsLeft = deadline != null ? Math.max(0, Math.ceil((deadline - nowTick) / 1000)) : null
  const timerRatio = (secondsLeft != null && totalTemps) ? secondsLeft / totalTemps : 1
  const timerColor = secondsLeft == null ? 'var(--text-dim)'
    : timerRatio > 0.5 ? '#4ADE80' : timerRatio > 0.2 ? '#F59E0B' : '#F87171'
  // Temps de réaction du buzz (en secondes, 1 décimale).
  const reactionSec = winner?.responseMs != null ? (winner.responseMs / 1000).toFixed(1) : null

  if (finalClassement) {
    const champion = finalClassement[0]
    const stats = [
      { label: 'Questions', value: totalQuestions || finalClassement.reduce((s) => s, 0) || '—' },
      { label: 'Joueurs', value: finalClassement.length },
      { label: 'Champion', value: champion?.prenom ?? '—' },
      { label: 'Meilleur score', value: `${champion?.score ?? 0} pts` },
    ]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-10 overflow-y-auto select-none"
        style={{ background: 'var(--bg)' }}>
        <Podium classement={finalClassement} variant="tv" title={partie?.nom ?? 'Partie terminée'} />
        <div className="flex flex-wrap justify-center gap-6">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl px-8 py-5 text-center min-w-[160px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-3xl font-black mb-1" style={{ color: 'var(--text)' }}>{s.value}</p>
              <p className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'var(--bg)' }}>

      {/* Récapitulatif de fin de manche — classement intermédiaire animé. */}
      {mancheRecap && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-12 animate-fadeUp"
          style={{ background: 'rgba(10,10,15,0.96)', backdropFilter: 'blur(6px)' }}>
          <p className="text-base uppercase tracking-[0.3em] mb-2" style={{ color: '#818CF8' }}>Fin de manche</p>
          <h2 className="text-5xl font-black mb-10" style={{ color: 'var(--text)' }}>{mancheRecap.nom}</h2>
          <div className="w-full max-w-2xl space-y-3">
            {sortedParticipants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-5 rounded-2xl px-7 py-4 transition-all"
                style={{
                  background: i === 0 ? 'rgba(245,158,11,0.12)' : 'var(--surface)',
                  border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                }}>
                <span className="text-3xl font-black w-10 text-center"
                  style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#A16207' : 'var(--text-dim)' }}>
                  {i + 1}
                </span>
                <BuzzerAnime couleur={p.buzzer?.couleur ?? '#6366F1'} statut="ready" size="sm" />
                <span className="text-2xl font-bold flex-1" style={{ color: 'var(--text)' }}>{p.prenom}</span>
                {p.vies != null && (
                  <span className="inline-flex items-center gap-1 mr-3" title="Vies">
                    {p.vies > 0
                      ? Array.from({ length: p.vies }).map((_, k) => <Heart key={k} size={18} fill="#F87171" color="#F87171" />)
                      : <Skull size={20} color="#9090A0" />}
                  </span>
                )}
                <span className="text-2xl font-black" style={{ color: '#F59E0B' }}>{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-10 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black text-white"
            style={{ background: '#6366F1' }}>G</div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{partie?.nom ?? 'Gbairai'}</h1>
            {q && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Question {questionIndex + 1}{totalQuestions > 0 ? ` / ${totalQuestions}` : ''}
                {q.mancheNom && ` · ${q.mancheNom}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Chronomètre géant — visible pendant la question (avant buzz/révélation). */}
          {secondsLeft != null && !winner && !revealed && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Timer size={26} style={{ color: timerColor }} />
                <span className="text-6xl font-black tabular-nums leading-none" style={{ color: timerColor }}>
                  {secondsLeft}
                </span>
              </div>
              <div className="w-28 h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--hover-overlay)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, timerRatio * 100))}%`, background: timerColor }} />
              </div>
            </div>
          )}

          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Hash size={16} style={{ color: 'var(--text-dim)' }} />
              <p className="text-4xl font-black font-mono tracking-[0.15em]" style={{ color: 'var(--text)' }}>{partieCode}</p>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Code pour rejoindre</p>
          </div>
        </div>
      </header>

      {/* Barre de progression globale de la partie. */}
      {totalQuestions > 0 && (
        <div className="h-1 w-full" style={{ background: 'var(--hover-overlay)' }}>
          <div className="h-full transition-all duration-500"
            style={{ width: `${Math.min(100, ((questionIndex + 1) / totalQuestions) * 100)}%`, background: '#6366F1' }} />
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center px-10 py-10 gap-10">

        {/* Auto countdown */}
        {autoCountdown && !winner && (
          <div className="text-center">
            <p className="text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>Prochaine question dans</p>
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
              <p className="text-7xl font-black" style={{ color: 'var(--text)' }}>{winner.prenom}</p>
              <p className="text-2xl font-semibold mt-2" style={{ color: '#4ADE80' }}>BUZZÉ EN PREMIER</p>
              {reactionSec != null && (
                <p className="text-xl font-bold mt-3 flex items-center justify-center gap-2" style={{ color: '#F59E0B' }}>
                  <Zap size={20} fill="#F59E0B" />{reactionSec}s de réaction
                </p>
              )}
            </div>

            {partie?.modeVote && votes.total > 0 && (
              <div className="w-full max-w-xl mt-2">
                <div className="flex justify-between text-lg font-semibold mb-3">
                  <span style={{ color: '#4ADE80' }}>{votes.pour} bonne{votes.pour > 1 ? 's' : ''}</span>
                  <span style={{ color: '#F87171' }}>{votes.contre} mauvaise{votes.contre > 1 ? 's' : ''}</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--hover-overlay)' }}>
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
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-12 pt-10 pb-6 text-center">
              <p className="text-base uppercase tracking-widest font-semibold mb-6" style={{ color: 'var(--text-dim)' }}>
                Question {questionIndex + 1}
              </p>
              {/* P2 — Enjeux de la manche (multiplicateur / malus) visibles par la salle. */}
              {((q.multiplicateurPoints && q.multiplicateurPoints !== 1) || q.malusEnabled) && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
                  {q.multiplicateurPoints && q.multiplicateurPoints !== 1 && (
                    <span className="text-lg font-bold px-4 py-1.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}>
                      ×{q.multiplicateurPoints} points
                    </span>
                  )}
                  {q.malusEnabled && (
                    <span className="text-lg font-bold px-4 py-1.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                      <AlertTriangle size={16} className="inline mr-1.5 -mt-1" />Manche à risque −{q.malusPenalite ?? 50}%
                    </span>
                  )}
                </div>
              )}
              <p className="text-5xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
                {q.enonce}
              </p>

              {/* Choix RICHES (texte et/ou image — drapeaux, logos…) */}
              {q.choices?.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {q.choices.map((c, i) => {
                    const isCorrect = revealed && revealData?.correctIndex === i
                    return (
                      <div key={i}
                        className="flex flex-col items-center justify-center gap-3 rounded-xl px-4 py-4 transition-all duration-500"
                        style={{
                          background: isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.10)',
                          border: `2px solid ${isCorrect ? 'rgba(34,197,94,0.6)' : 'rgba(99,102,241,0.3)'}`,
                          transform: isCorrect ? 'scale(1.03)' : 'none',
                        }}>
                        {c?.mediaUrl && (
                          <img src={c.mediaUrl} alt="" className="rounded-lg object-contain"
                            style={{ maxHeight: 160, maxWidth: '100%', background: 'rgba(0,0,0,0.2)' }} />
                        )}
                        {c?.text && <span className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{c.text}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* QCM choices (texte) */}
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
                    // La bonne réponse est le TEXTE du choix (comparaison robuste).
                    const norm = s => String(s ?? '').trim().toLowerCase()
                    const isCorrect = revealed && norm(revealData?.reponse) === norm(c)
                    return (
                      <div key={i}
                        className="flex items-center gap-4 rounded-xl px-6 py-4 text-left transition-all duration-500"
                        style={{
                          background: isCorrect ? 'rgba(34,197,94,0.15)' : col.bg,
                          border: `2px solid ${isCorrect ? 'rgba(34,197,94,0.6)' : col.border}`,
                          transform: isCorrect ? 'scale(1.02)' : 'none',
                        }}>
                        <span className="text-3xl font-black" style={{ color: col.text }}>{letter}</span>
                        <span className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{c}</span>
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
                        {isGreen ? <Check size={26} className="inline mr-2 -mt-1" /> : <X size={26} className="inline mr-2 -mt-1" />}{val}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Média (image / audio / vidéo) — synchronisé via l'horloge serveur */}
              <QuestionMedia question={q} autoplay mediaState={mediaState} />
            </div>

            {/* Answer reveal panel */}
            <div className="relative overflow-hidden transition-all duration-700"
              style={{ maxHeight: revealed ? '200px' : '0px' }}>
              <div className="px-12 pb-8 pt-4 animate-fadeUp"
                style={{ borderTop: '1px solid var(--border)', background: 'rgba(34,197,94,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={18} style={{ color: '#4ADE80' }} />
                  <p className="text-sm uppercase tracking-widest font-semibold" style={{ color: '#4ADE80' }}>Réponse</p>
                </div>
                <p className="text-4xl font-black" style={{ color: 'var(--text)' }}>{revealData?.reponse}</p>
                {revealData?.explication && (
                  <p className="text-lg mt-2" style={{ color: 'var(--text-muted)' }}>{revealData.explication}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {!winner && !q && (
          <div className="text-center">
            <p className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>En attente…</p>
            <p className="text-lg" style={{ color: 'var(--text-dim)' }}>La prochaine question va apparaître ici.</p>
          </div>
        )}

        {/* Buzzers — matériel (mac) ET téléphone (buzzer virtuel WEB-<id>) */}
        {!winner && (
          <div className="flex flex-wrap justify-center gap-10">
            {participants.map((p, i) => {
              // Identité de buzz : mac physique si présent, sinon buzzer virtuel.
              const mac = p.buzzer?.mac ?? `WEB-${p.id}`
              // Un joueur web est toujours « présent » (ready) une fois rejoint ;
              // un buzzer matériel est offline tant qu'il n'est pas connecté.
              const statut = buzzerStatuts[mac] ?? (p.buzzer?.mac ? 'offline' : 'ready')
              const couleur = p.buzzer?.couleur ?? WEB_COLORS[i % WEB_COLORS.length]
              return <BuzzerAnime key={p.id} couleur={couleur} statut={statut} prenom={p.prenom} size="lg" />
            })}
          </div>
        )}
      </main>

      {/* Scoreboard */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
        className="px-10 py-5">
        <div className="flex justify-center gap-10 flex-wrap">
          {sortedParticipants.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              {i === 0 && <Trophy size={18} style={{ color: '#F59E0B' }} />}
              {i === 1 && <Trophy size={18} style={{ color: '#9CA3AF' }} />}
              {i === 2 && <Trophy size={18} style={{ color: '#A16207' }} />}
              {i > 2 && <span className="text-base font-bold" style={{ color: 'var(--text-dim)' }}>{i + 1}.</span>}
              <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{p.prenom}</span>
              <span className="text-lg font-black" style={{ color: '#F59E0B' }}>{p.score} pt{p.score !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {participants.length === 0 && (
            <p className="text-base" style={{ color: 'var(--text-dim)' }}>En attente de joueurs…</p>
          )}
        </div>
      </footer>
    </div>
  )
}
