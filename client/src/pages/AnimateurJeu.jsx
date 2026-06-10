import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import QuestionMedia from '../components/QuestionMedia.jsx'
import Podium from '../components/Podium.jsx'
import { flattenManches } from '../utils/manches.js'
import {
  ChevronRight, Square, Trophy, ThumbsUp, ThumbsDown,
  Users, Hash, Loader2, Eye, EyeOff, Play, Pause, RotateCcw, Tv,
} from 'lucide-react'

const WEB_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#0EA5E9', '#A855F7', '#EF4444', '#14B8A6']

export default function AnimateurJeu() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, leaveRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzerStatuts, setBuzzerStatuts] = useState({})
  const [winner, setWinner] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [autoCountdown, setAutoCountdown] = useState(null)
  const [votes, setVotes] = useState({ pour: 0, contre: 0, total: 0 })
  const [myVote, setMyVote] = useState(null)
  const [endConfirm, setEndConfirm] = useState(false)
  const [finalClassement, setFinalClassement] = useState(null)
  const [animateurOffline, setAnimateurOffline] = useState(false) // A3
  const [winnerSelectedAnswer, setWinnerSelectedAnswer] = useState(null) // D2
  const [answersCount, setAnswersCount] = useState({ count: 0, total: 0 }) // QCM simultané
  // Réponses : pour l'animateur uniquement, chargées via l'endpoint autorisé.
  // Les joueurs ne reçoivent la réponse qu'au moment de la révélation (WS).
  const [answers, setAnswers] = useState({})
  const [revealData, setRevealData] = useState(null)
  const [mediaState, setMediaState] = useState(null)
  const countdownRef = useRef(null)

  const isAnimateur = partie?.animateurId === user?.id
  const isModeAuto  = partie?.modeAuto
  const isModeVote  = partie?.modeVote
  // Hôte = animateur OU créateur. En modes auto/vote (sans animateur), seul le
  // créateur peut terminer la partie / ouvrir l'écran public (#7).
  const isHost = isAnimateur || (partie?.creatorId && partie.creatorId === user?.id)
  // Réponses masquées : l'animateur projette directement, il ne dispose donc
  // d'aucun écran de régie ; il découvre la réponse à la révélation comme tous.
  const reponsesMasquees = !!partie?.masquerReponses
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

    // Écran de régie : on ne précharge les réponses que pour l'animateur ET
    // uniquement si l'affichage anticipé est autorisé (masquerReponses = false).
    // Si masqué, le serveur renvoie de toute façon une liste vide.
    if (p.animateurId === user?.id && !p.masquerReponses) {
      const ansRes = await apiFetch(`/parties/${p.id}/answers`)
      if (ansRes?.ok) {
        const list = await ansRes.json()
        const map = {}
        for (const a of list) map[a.index] = { reponse: a.reponse, explication: a.explication }
        setAnswers(map)
      }
    }
  }, [partieCode, user?.id])

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
      if (msg.type === 'answers_update') setAnswersCount({ count: msg.count ?? 0, total: msg.total ?? 0 })
      if (msg.type === 'vote_update') setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      if (msg.type === 'vote_result') {
        // Le serveur a tranché : il révèle, attribue les points et enchaîne tout
        // seul (auto_next_question). Le client n'avance plus (évitait un
        // multi-déclenchement quand chaque joueur appelait nextQuestion).
        setVotes({ pour: msg.pour, contre: msg.contre, total: msg.total })
      }
      if (msg.type === 'auto_next_question') startAutoCountdown(msg.countdown ?? 3)
      if (msg.type === 'question_display') {
        setQuestionIndex(msg.index ?? 0)
        setRevealed(false)
        setRevealData(null)
        setWinner(null)
        setMyVote(null)
        setMediaState(null)
        setVotes({ pour: 0, contre: 0, total: 0 })
        setWinnerSelectedAnswer(null) // D2
        setAnswersCount({ count: 0, total: 0 })
        clearBuzzerStatuts()
      }
      if (msg.type === 'media_state') {
        setMediaState(msg.hasMedia ? { playing: msg.playing, position: msg.position, seq: msg.seq } : null)
      }
      if (msg.type === 'question_reveal') {
        setRevealed(true)
        setRevealData({ reponse: msg.reponse, explication: msg.explication ?? null })
      }
      if (msg.type === 'answer_validated') {
        setWinner(null)
        setWinnerSelectedAnswer(null)
        resetBuzzers()
      }
      if (msg.type === 'buzz_reopened') {
        setWinner(null)
        setWinnerSelectedAnswer(null)
        resetBuzzers()
      }
      // D2 — Réponse sélectionnée par le buzzeur (QCM/VF en mode animateur).
      if (msg.type === 'winner_answer_selected') {
        setWinnerSelectedAnswer({ answer: msg.answer, isCorrect: msg.isCorrect })
      }
      // A3 — Animateur déconnecté : bannière pour les joueurs (ici juste enregistré).
      if (msg.type === 'animateur_offline') setAnimateurOffline(true)
      if (msg.type === 'question_display') setAnimateurOffline(false)
      if (msg.type === 'game_ended') {
        setFinalClassement(msg.classement ?? [])
      }
      if (msg.type === 'participant_update') setParticipants(msg.participants ?? [])
      if (msg.type === 'buzzer_status_update') {
        setBuzzerStatuts(prev => ({ ...prev, [msg.mac]: msg.status === 'OFFLINE' ? 'offline' : 'ready' }))
      }
    })

    return () => { unsub(); clearInterval(countdownRef.current); leaveRoom(partieCode) }
  }, [partieCode])

  // Pilotage média (animateur = maître de séance) : resynchronise tous les écrans.
  function mediaControl(action, position) {
    send({ type: 'media_control', partieCode, action, position })
  }

  function clearBuzzerStatuts() {
    setBuzzerStatuts(prev => {
      const next = {}
      Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
      return next
    })
  }

  function resetBuzzers() {
    setBuzzerStatuts(prev => {
      const next = {}
      Object.keys(prev).forEach(mac => { next[mac] = 'ready' })
      return next
    })
  }

  // En mode auto, c'est le serveur qui pilote l'avancement : ce compte à rebours
  // est purement visuel. Le prochain question_display arrivera du serveur.
  function startAutoCountdown(seconds) {
    clearInterval(countdownRef.current)
    setAutoCountdown(seconds)
    countdownRef.current = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return null }
        return prev - 1
      })
    }, 1000)
  }

  function nextQuestion() {
    setRevealed(false)
    send({ type: 'next_question', partieCode })
  }

  function revealAnswer() {
    send({ type: 'reveal_question', partieCode })
    setRevealed(true)
  }

  function validateAnswer(valide) {
    if (!winner) return
    send({ type: 'validate_answer', partieCode, participantId: winner.participantId, valide, scoreIncrement: 1 })
    setWinner(null)
    resetBuzzers()
  }

  function handleVote(valide) {
    if (myVote !== null) return
    setMyVote(valide)
    send({ type: 'submit_vote', partieCode, questionIndex, participantId: myParticipant?.id, valide })
  }

  function endGame() { send({ type: 'end_game', partieCode }); setEndConfirm(false) }

  if (!partie) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
      </div>
    )
  }

  if (finalClassement) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <Podium
          classement={finalClassement}
          variant="compact"
          title={partie.nom}
          onClose={() => navigate('/dashboard')}
        />
      </div>
    )
  }

  const questions = flattenManches(partie.manches)
  const currentQ  = questions[questionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  // Affichage de la réponse :
  //  - animateur en mode régie (réponses non masquées) → en permanence ;
  //  - tous les autres cas (joueurs, ET animateur en projection directe) →
  //    seulement après la révélation officielle (via le WS).
  const regieAnticipee = isAnimateur && !reponsesMasquees
  const answerToShow = regieAnticipee ? answers[questionIndex] : (revealed ? revealData : null)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5"
        style={{ background: 'var(--surface)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', minHeight: '52px' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white"
            style={{ background: '#6366F1' }}>G</div>
          <div>
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text)' }}>{partie.nom}</p>
            <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              Q{questionIndex + 1}{questions.length > 0 ? `/${questions.length}` : ''}
              {isModeAuto && ' · Auto'}{isModeVote && ' · Vote'}
            </p>
            {isAnimateur && (
              <p className="text-2xs mt-0.5" style={{ color: '#F59E0B' }}>🎤 Vous animez — hors classement</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="code-tag flex items-center gap-1"><Hash size={9} />{partieCode}</span>

          {/* Lien vers l'écran public de projection (hôte uniquement). */}
          {isHost && (
            <a href={`/screen/${partieCode}`} target="_blank" rel="noopener noreferrer"
              className="btn-sm gap-1.5" title="Ouvrir l'écran de projection"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' }}>
              <Tv size={13} />Écran public
            </a>
          )}

          {/* Reveal button — shows when answer not yet revealed */}
          {isAnimateur && !isModeAuto && !isModeVote && currentQ && !revealed && (
            <button onClick={revealAnswer} className="btn-sm gap-1.5"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' }}>
              <Eye size={13} />Révéler
            </button>
          )}

          {/* Next button — D1 : disponible uniquement après révélation (la réponse
              doit toujours être montrée avant de passer à la question suivante). */}
          {isAnimateur && !isModeAuto && revealed && (
            <button onClick={nextQuestion} className="btn-secondary btn-sm gap-1">
              Suivant <ChevronRight size={13} />
            </button>
          )}

          {isHost && (
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
            <div className="card p-7 max-w-2xl w-full text-center animate-fadeUp">
              <p className="text-2xs uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--text-dim)' }}>
                {currentQ.mancheNom && <>{currentQ.mancheNom} · </>}Question {questionIndex + 1}
              </p>
              <p className="text-2xl font-bold leading-snug mb-4" style={{ color: 'var(--text)' }}>
                {currentQ.enonce}
              </p>

              {/* QCM choices (for animateur reference) */}
              {currentQ.type === 'QCM' && currentQ.choix?.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-4 text-left">
                  {currentQ.choix.map((c, i) => (
                    <div key={i} className="rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                      <span className="font-bold mr-2" style={{ color: '#818CF8' }}>{['A','B','C','D'][i]}</span>
                      <span style={{ color: 'var(--text)' }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Média (aperçu animateur — synchronisé avec les joueurs) */}
              {['IMAGE', 'AUDIO', 'VIDEO'].includes(currentQ.type) && (
                <QuestionMedia question={currentQ} compact mediaState={mediaState} />
              )}

              {/* Pilotage média : play / pause / rejouer — diffusé à tous les écrans.
                  Réservé à l'animateur, hors mode auto (serveur-piloté). */}
              {isAnimateur && !isModeAuto && ['AUDIO', 'VIDEO'].includes(currentQ.type) && mediaState && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  {mediaState.playing ? (
                    <button onClick={() => mediaControl('pause')} className="btn-secondary btn-sm gap-1.5">
                      <Pause size={13} />Pause
                    </button>
                  ) : (
                    <button onClick={() => mediaControl('play')} className="btn-secondary btn-sm gap-1.5">
                      <Play size={13} />Lecture
                    </button>
                  )}
                  <button onClick={() => mediaControl('replay')} className="btn-secondary btn-sm gap-1.5">
                    <RotateCcw size={13} />Rejouer
                  </button>
                </div>
              )}

              {/* Answer section — animateur sees it always; players only after reveal */}
              {answerToShow ? (
                <div className="mt-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4ADE80' }}>
                      {regieAnticipee ? 'Réponse (régie)' : 'Réponse'}
                    </p>
                    {regieAnticipee && revealed && <span className="text-xs flex items-center gap-1" style={{ color: '#4ADE80' }}>
                      <Eye size={11} />Révélée au public
                    </span>}
                  </div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{answerToShow.reponse}</p>
                  {answerToShow.explication && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{answerToShow.explication}</p>
                  )}
                </div>
              ) : (!revealed && (
                <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-center gap-2"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                  <EyeOff size={13} style={{ color: 'var(--text-dim)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {reponsesMasquees && isAnimateur
                      ? 'Projection directe : réponse révélée en même temps qu\'au public'
                      : 'Réponse masquée jusqu\'à la révélation'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 max-w-2xl w-full text-center">
              <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                {questions.length === 0 ? 'Aucune question configurée' : 'Partie terminée !'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                {questions.length === 0 ? 'Attendez que les questions soient tirées.' : 'Toutes les questions ont été posées.'}
              </p>
            </div>
          )}

          {/* QCM/VF simultané : décompte des réponses (mode animateur, pas de buzz) */}
          {!isModeAuto && !isModeVote && currentQ && !winner && !revealed &&
            (currentQ.type === 'QCM' || currentQ.type === 'VRAI_FAUX' || currentQ.choix?.length > 0) && (
            <div className="card p-4 max-w-md w-full text-center animate-fadeUp">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="text-2xl font-black" style={{ color: '#818CF8' }}>{answersCount.count}</span>
                <span className="mx-1">/</span>{answersCount.total} joueur{answersCount.total !== 1 ? 's' : ''} ont répondu
              </p>
              <p className="text-2xs mt-1" style={{ color: 'var(--text-dim)' }}>
                Clique « Révéler » pour afficher la réponse et attribuer les points.
              </p>
            </div>
          )}

          {/* Winner */}
          {winner && (
            <div className="max-w-md w-full rounded-xl p-6 text-center animate-fadeUp"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-2xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#4ADE80' }}>PREMIER</p>
              <p className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>{winner.prenom}</p>

              {/* D2 — Réponse sélectionnée par le buzzeur (QCM/VF) */}
              {winnerSelectedAnswer && (
                <div className="rounded-lg px-3 py-2 mb-3 text-sm"
                  style={{
                    background: winnerSelectedAnswer.isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${winnerSelectedAnswer.isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: winnerSelectedAnswer.isCorrect ? '#4ADE80' : '#F87171',
                  }}>
                  {winnerSelectedAnswer.isCorrect ? '✅' : '❌'} a dit : <strong>{winnerSelectedAnswer.answer}</strong>
                </div>
              )}

              {/* A2 — Bonne réponse visible par l'animateur pour comparaison */}
              {!isModeAuto && !isModeVote && isAnimateur && !revealed && (
                <div className="rounded-lg px-3 py-2 mb-3 text-sm text-left"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: '#818CF8' }}>Bonne réponse</p>
                  <p className="font-bold" style={{ color: 'var(--text)' }}>
                    {regieAnticipee ? answers[questionIndex]?.reponse : '(masquée — projection directe)'}
                  </p>
                </div>
              )}

              {isModeAuto && autoCountdown && (
                <p className="text-5xl font-black mt-3" style={{ color: '#F59E0B' }}>{autoCountdown}</p>
              )}

              {!isModeAuto && !isModeVote && isAnimateur && (
                <div className="flex gap-2 justify-center mt-2">
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
              <p className="text-sm font-medium text-center mb-4" style={{ color: 'var(--text-muted)' }}>
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
                  <div className="flex justify-between text-2xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
                    <span style={{ color: '#4ADE80' }}>{votes.pour} pour</span>
                    <span style={{ color: '#F87171' }}>{votes.contre} contre</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--hover-overlay)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(votes.pour / votes.total) * 100}%`, background: '#22C55E' }} />
                  </div>
                  <p className="text-2xs text-center mt-2" style={{ color: 'var(--text-dim)' }}>
                    {votes.total}/{participants.length} vote{votes.total !== 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-56 flex flex-col"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="p-4 pb-2 flex items-center gap-1.5">
            <Users size={13} style={{ color: 'var(--text-dim)' }} />
            <p className="text-2xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-dim)' }}>
              Joueurs · {participants.length}
            </p>
          </div>
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {sortedParticipants.map((p, i) => {
              // Identité de buzz : mac physique, sinon buzzer virtuel (téléphone).
              const mac = p.buzzer?.mac ?? `WEB-${p.id}`
              const statut = buzzerStatuts[mac] ?? (p.buzzer?.mac ? 'offline' : 'ready')
              return (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg p-2.5 transition-all"
                  style={{
                    background: winner?.participantId === p.id ? 'rgba(34,197,94,0.06)' : 'var(--input-bg)',
                    border: `1px solid ${winner?.participantId === p.id ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                  }}>
                  <BuzzerAnime couleur={p.buzzer?.couleur ?? WEB_COLORS[i % WEB_COLORS.length]} statut={statut} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {i === 0 && <Trophy size={10} style={{ color: '#F59E0B' }} />}
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{p.prenom}</p>
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
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
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
