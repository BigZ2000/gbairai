import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import { flattenManches } from '../utils/manches.js'
import QuestionMedia from '../components/QuestionMedia.jsx'
import { Loader2, Zap, Check, X, Trophy, Hand, AlertTriangle, Tv, Square, Gamepad2, Smartphone, Heart, Skull, PartyPopper, Frown, AlarmClock, Eye } from 'lucide-react'

// Écran JOUEUR — pensé pour le présentiel « lève les yeux » :
// l'essentiel est un grand bouton BUZZ. La question est sur l'écran public.
export default function JoueurJeu() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, leaveRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie] = useState(null)
  const [participants, setParticipants] = useState([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [armed, setArmed] = useState(false)     // peut buzzer ?
  const [winner, setWinner] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [revealReponse, setRevealReponse] = useState(null)
  const [revealCorrectIndex, setRevealCorrectIndex] = useState(-1) // choix-images
  const [voted, setVoted] = useState(null)
  const [classement, setClassement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState(null)    // contenu public
  const [myAnswer, setMyAnswer] = useState(null)    // réponse choisie (auto ou D2)
  const [mediaState, setMediaState] = useState(null)// D5 : sync média en distanciel
  const [animateurOffline, setAnimateurOffline] = useState(false) // A3
  const [isEliminated, setIsEliminated] = useState(false)         // D6
  const [textAnswer, setTextAnswer] = useState('')  // A4 : saisie libre BUZZER distanciel
  const [endConfirm, setEndConfirm] = useState(false) // confirmation Fin (hôte)
  const [toast, setToast] = useState(null)

  const code = partieCode.toUpperCase()
  const myParticipant = participants.find(p => p.userId === user?.id)
  // Source de buzz active : buzzer matériel si présent et en ligne, sinon téléphone.
  const buzzerLive = myParticipant?.buzzer && myParticipant.buzzer.status !== 'OFFLINE'
  // Refs pour accéder à mon identité depuis le callback WS (closure stable).
  const myIdRef = useRef(null), myMacRef = useRef(null), toastTimer = useRef(null)
  useEffect(() => { myIdRef.current = myParticipant?.id ?? null; myMacRef.current = myParticipant?.buzzer?.mac ?? null })
  function showToast(t) { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3500) }
  const myScore = myParticipant?.score ?? 0
  const totalQuestions = partie ? flattenManches(partie.manches ?? []).length : 0
  const isVote        = !!partie?.modeVote
  const isAuto        = !!partie?.modeAuto
  const isDistanciel  = !!partie?.modeDistanciel
  const isHost        = !!partie && partie.creatorId === user?.id // créateur (projection/Fin)
  const iWon = winner && myParticipant && winner.participantId === myParticipant.id
  const hasChoix = question && (question.type === 'QCM' || question.type === 'VRAI_FAUX'
    || (question.choix?.length > 0) || (question.choices?.length > 0))
  // Questions à choix (QCM/VF/choix-images) → réponse SIMULTANÉE de tous (auto ET
  // animateur), sauf en mode vote (qui reste buzz + vote collectif).
  const showSelect    = hasChoix && !isVote && !isEliminated
  // BUZZER + auto + distanciel → saisie texte (matching intelligent).
  const showTextInput = isAuto && isDistanciel && !hasChoix && !isEliminated
  // D5 — Afficher le média sur le téléphone en distanciel (selon l'URL, pas le type).
  const showMediaOnPhone = isDistanciel && question && (question.mediaUrl || question.audioUrl || question.videoUrl)

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/by-code/${code}`)
    if (!res?.ok) { navigate('/dashboard', { replace: true }); return }
    const p = await res.json()
    if (p.status === 'EN_ATTENTE') { navigate(`/parties/${code}/attente`, { replace: true }); return }
    setPartie(p)
    setParticipants(p.participants ?? [])
    setLoading(false)
  }, [code])

  useEffect(() => {
    load()
    joinRoom(code)
    const unsub = subscribe('joueur_jeu', (msg) => {
      switch (msg.type) {
        case 'question_display':
          setQuestionIndex(msg.index ?? 0); setQuestion(msg.question ?? null)
          setArmed(true); setWinner(null); setRevealed(false); setRevealReponse(null)
          setRevealCorrectIndex(-1)
          setVoted(null); setMyAnswer(null); setTextAnswer(''); setMediaState(null)
          setAnimateurOffline(false); break
        case 'buzzer_winner':
          setWinner(msg); setArmed(false); break
        case 'question_reveal':
          setRevealed(true); setArmed(false); setWinner(null)
          setRevealReponse(msg.reponse ?? null); setRevealCorrectIndex(msg.correctIndex ?? -1); break
        case 'buzz_reopened':
          // Mauvaise réponse : le buzz rouvre pour tout le monde (« vol »).
          setWinner(null); setArmed(true); break
        case 'answer_validated':
          // Bonne réponse → on garde le badge gagnant jusqu'à la question
          // suivante ; le réarmement éventuel passe par buzz_reopened.
          if (msg.valide) setArmed(false); break
        // Bascule de source transparente (Part 6) — avis discrets, jamais bloquants.
        case 'buzzer_assigned':
          if (msg.participantId === myIdRef.current) showToast('Buzzer connecté'); break
        case 'unassign_buzzer':
          if (msg.participantId === myIdRef.current) showToast('Buzzer retiré — tu joues au téléphone'); break
        case 'buzzer_status_update':
          if (msg.mac && msg.mac === myMacRef.current)
            showToast(msg.status === 'OFFLINE' ? 'Buzzer déconnecté — continue au téléphone' : 'Buzzer reconnecté')
          break
        case 'media_state': // D5
          setMediaState(msg.hasMedia ? { playing: msg.playing, position: msg.position, seq: msg.seq } : null); break
        case 'animateur_offline': // A3
          setAnimateurOffline(true); break
        case 'player_eliminated': // D6
          if (msg.participantId === myIdRef.current) setIsEliminated(true)
          break
        case 'participant_update':
          if (msg.participants) {
            setParticipants(msg.participants)
            // D6 : mise à jour du statut d'élimination depuis le serveur
            const me = msg.participants.find(p => p.id === myIdRef.current)
            if (me?.isEliminated) setIsEliminated(true)
          }
          break
        case 'game_ended':
          setClassement(msg.classement ?? []); break
        case 'game_started':
          setArmed(true); break
        default: break
      }
    })
    return () => { unsub(); leaveRoom(code) }
  }, [code])

  function buzz() {
    if (!armed || !myParticipant) return
    setArmed(false) // retour immédiat ; le serveur tranche le vrai gagnant
    // Évènement unifié : source 'web' (buzzer virtuel résolu par participantId).
    send({ type: 'buzz', source: 'web', partieCode: code, participantId: myParticipant.id })
    if (navigator.vibrate) navigator.vibrate(40)
  }

  function vote(valide) {
    if (voted !== null) return
    setVoted(valide)
    send({ type: 'submit_vote', partieCode: code, questionIndex, participantId: myParticipant?.id, valide })
  }

  // Mode auto, question à choix : le joueur sélectionne → le serveur valide.
  function answer(value) {
    if (myAnswer !== null || revealed || !myParticipant) return
    setMyAnswer(value)
    send({ type: 'submit_answer', partieCode: code, participantId: myParticipant.id, answer: value })
    if (navigator.vibrate) navigator.vibrate(30)
  }

  // A4 — Mode auto + BUZZER + distanciel : saisie libre, le serveur valide.
  function submitTextAnswer() {
    const v = textAnswer.trim()
    if (!v || myAnswer !== null || revealed || !myParticipant) return
    setMyAnswer(v)
    send({ type: 'submit_answer', partieCode: code, participantId: myParticipant.id, answer: v })
    if (navigator.vibrate) navigator.vibrate(30)
  }

  // Hôte (créateur) en auto/vote/distanciel : terminer la partie depuis l'écran joueur.
  function endGame() { send({ type: 'end_game', partieCode: code }) }

  if (loading) {
    return <Center><Loader2 size={28} className="animate-spin" style={{ color: '#6366F1' }} /></Center>
  }

  // Écran de fin : classement personnel.
  if (classement) {
    const mine = classement.find(c => c.participantId === myParticipant?.id) ?? classement.find(c => c.userId === user?.id)
    const rang = mine?.rang ?? (classement.findIndex(c => c.participantId === myParticipant?.id) + 1 || null)
    return (
      <Center>
        <div className="text-center px-6">
          <Trophy size={56} style={{ color: '#EAB308' }} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#ECECF0' }}>Partie terminée !</h1>
          {rang && <p className="text-lg mb-1" style={{ color: '#ECECF0' }}>Tu finis <strong>{rang}{rang === 1 ? 'er' : 'e'}</strong></p>}
          <p className="text-sm mb-6" style={{ color: '#9090A0' }}>{myScore} point{myScore !== 1 ? 's' : ''}</p>
          {user?.isGuest ? (
            // Invité → tunnel de conversion (jamais de retour au tableau de bord).
            <div className="w-full max-w-xs mx-auto">
              <p className="text-sm mb-3" style={{ color: '#9090A0' }}>Garde ton score et ton historique :</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate('/register')} className="btn-primary w-full">Créer mon compte</button>
                <button onClick={() => navigate('/abonnement')} className="btn-secondary w-full">Voir les offres</button>
                <button onClick={() => navigate('/invite')} className="btn-ghost w-full">Rejoindre une autre partie</button>
              </div>
            </div>
          ) : (
            <button onClick={() => navigate('/dashboard')} className="btn-primary">Retour au tableau de bord</button>
          )}
        </div>
      </Center>
    )
  }

  // Vote collectif : la salle valide la réponse de celui qui a buzzé.
  const showVote = isVote && winner && !revealed && !iWon

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0E0E12' }}>
      {/* Barre haute : question + score */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-sm font-medium" style={{ color: '#9090A0' }}>
          {totalQuestions ? `Question ${questionIndex + 1}/${totalQuestions}` : `Question ${questionIndex + 1}`}
        </span>
        <div className="flex items-center gap-2">
          {/* Source de buzz active (informatif) : matériel ou téléphone. */}
          <span className="text-2xs px-2 py-1 rounded-lg" title="Ta source de buzz"
            style={{ background: 'rgba(255,255,255,0.04)', color: buzzerLive ? '#A5B4FC' : '#9090A0' }}>
            {buzzerLive ? <><Gamepad2 size={12} className="inline mr-1 -mt-0.5" />Buzzer</> : <><Smartphone size={12} className="inline mr-1 -mt-0.5" />Téléphone</>}
          </span>
          <span className="text-2xs" style={{ color: '#5A5A6E' }}>{myParticipant?.prenom}</span>
          {myParticipant?.vies != null && (
            <span className="text-sm px-2 py-1 rounded-lg" title="Vies restantes"
              style={{ background: 'rgba(239,68,68,0.12)' }}>
              {myParticipant.vies > 0
                ? <span className="inline-flex items-center gap-0.5">{Array.from({ length: myParticipant.vies }).map((_, i) => <Heart key={i} size={13} fill="#F87171" color="#F87171" />)}</span>
                : <Skull size={14} color="#9090A0" />}
            </span>
          )}
          <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)', color: '#A5B4FC' }}>
            {myScore} pts
          </span>
        </div>
      </div>

      {/* Avis discret (bascule de source) — non bloquant */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 px-4 py-2 rounded-full text-sm z-50 animate-fadeUp"
          style={{ background: 'rgba(20,20,28,0.95)', border: '1px solid rgba(255,255,255,0.12)', color: '#ECECF0' }}>
          {toast}
        </div>
      )}

      {/* A3 — Animateur déconnecté */}
      {animateurOffline && (
        <div className="px-4 py-2 flex items-center gap-2 text-sm"
          style={{ background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          <AlertTriangle size={15} />
          L'animateur s'est déconnecté — la partie est en pause.
        </div>
      )}

      {/* D6 — Joueur éliminé : mode spectateur */}
      {isEliminated && (
        <div className="px-4 py-2 flex items-center gap-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}>
          Tu as été éliminé · Reste spectateur pour soutenir les autres
        </div>
      )}

      {/* Barre HÔTE (créateur en auto/vote/distanciel) : projection + Fin */}
      {isHost && (
        <div className="px-4 py-2 flex items-center justify-between gap-2"
          style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
          <span className="text-2xs font-semibold" style={{ color: '#A5B4FC' }}>HÔTE</span>
          <div className="flex items-center gap-2">
            <a href={`/screen/${code}`} target="_blank" rel="noopener noreferrer"
              className="text-2xs px-2.5 py-1 rounded-lg flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#A5B4FC' }}>
              <Tv size={12} />Écran public
            </a>
            <button onClick={() => setEndConfirm(true)}
              className="text-2xs px-2.5 py-1 rounded-lg flex items-center gap-1"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>
              <Square size={11} />Fin
            </button>
          </div>
        </div>
      )}

      {/* Zone centrale */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Média de la question (ex. drapeau) — AU-DESSUS des réponses, sous la barre HÔTE. */}
        {showMediaOnPhone && !revealed && (
          <div className="w-full max-w-md mb-4">
            <QuestionMedia question={question} compact mediaState={mediaState} />
          </div>
        )}

        {/* P2 — Enjeux de la manche rendus visibles (sinon scores « magiques »). */}
        {!revealed && question && ((question.multiplicateurPoints && question.multiplicateurPoints !== 1) || question.malusEnabled) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {question.multiplicateurPoints && question.multiplicateurPoints !== 1 && (
              <span className="text-2xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}>
                ×{question.multiplicateurPoints} points
              </span>
            )}
            {question.malusEnabled && (
              <span className="text-2xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />Manche à risque −{question.malusPenalite ?? 50}%
              </span>
            )}
          </div>
        )}

        {/* P0 — L'énoncé est TOUJOURS visible sur le téléphone (téléphone-seul,
            présentiel sans écran, saisie texte distanciel…). Exceptions : le pavé
            QCM/VF l'affiche déjà lui-même, et on le masque après la révélation. */}
        {!showSelect && !revealed && question?.enonce && (
          <p className="text-center text-base font-semibold mb-6 max-w-md px-2" style={{ color: '#ECECF0' }}>
            {question.enonce}
          </p>
        )}
        {showVote ? (
          <div className="text-center w-full max-w-xs">
            <p className="text-sm mb-1" style={{ color: '#9090A0' }}><strong style={{ color: '#ECECF0' }}>{winner.prenom}</strong> a buzzé.</p>
            <p className="text-base font-semibold mb-6" style={{ color: '#ECECF0' }}>Sa réponse est-elle bonne ?</p>
            {voted === null ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => vote(true)} className="btn-lg rounded-2xl py-6 flex flex-col items-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }}>
                  <Check size={28} />Oui
                </button>
                <button onClick={() => vote(false)} className="btn-lg rounded-2xl py-6 flex flex-col items-center gap-2"
                  style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171' }}>
                  <X size={28} />Non
                </button>
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#9090A0' }}>Vote enregistré ✓ — on attend les autres…</p>
            )}
          </div>
        ) : showSelect ? (
          // QCM / Vrai-Faux : tout le monde répond (auto ET animateur). Le serveur
          // marque chaque bonne réponse à la révélation.
          <AnswerPad question={question} myAnswer={myAnswer} revealed={revealed} revealReponse={revealReponse} revealCorrectIndex={revealCorrectIndex} onAnswer={answer} />
        ) : showTextInput ? (
          // A4 — Mode auto + BUZZER + distanciel : saisie libre, matching intelligent.
          // À la révélation : grand panneau trouvé/raté (même lisibilité que le QCM).
          <div className="w-full max-w-sm text-center">
            {revealed ? (() => {
              const ok = myAnswer !== null && answersMatchClient(myAnswer, revealReponse)
              const none = myAnswer === null
              const color = none ? '#9090A0' : ok ? '#22C55E' : '#F87171'
              return (
                <div className="rounded-3xl px-6 py-8 animate-fadeUp"
                  style={{
                    background: none ? 'rgba(255,255,255,0.04)' : ok ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.10)',
                    border: `2px solid ${none ? 'rgba(255,255,255,0.10)' : ok ? 'rgba(34,197,94,0.55)' : 'rgba(248,113,113,0.45)'}`,
                  }}>
                  <div className="flex justify-center mb-4">
                    {none ? <AlarmClock size={56} color="#9090A0" /> : ok ? <PartyPopper size={56} color="#22C55E" /> : <Frown size={56} color="#F87171" />}
                  </div>
                  <p className="text-2xl font-extrabold mb-1" style={{ color }}>
                    {none ? 'Pas de réponse' : ok ? 'Bonne réponse !' : 'Raté cette fois…'}
                  </p>
                  {!none && !ok && (
                    <p className="text-sm mb-2" style={{ color: '#9090A0' }}>Ta réponse : « {myAnswer} »</p>
                  )}
                  <p className="text-lg mt-2" style={{ color: '#ECECF0' }}>
                    Réponse : <strong>{revealReponse ?? '—'}</strong>
                  </p>
                </div>
              )
            })() : (
              <>
                <p className="text-sm mb-4" style={{ color: '#9090A0' }}>Tape ta réponse</p>
                <input
                  className="w-full rounded-2xl px-4 py-4 text-lg font-semibold text-center mb-3"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(99,102,241,0.4)', color: '#ECECF0', outline: 'none' }}
                  value={textAnswer}
                  onChange={e => setTextAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitTextAnswer()}
                  placeholder="Tape ta réponse…"
                  disabled={myAnswer !== null}
                  autoFocus
                />
                <button
                  onClick={submitTextAnswer}
                  disabled={!textAnswer.trim() || myAnswer !== null}
                  className="w-full rounded-2xl py-4 font-bold text-lg"
                  style={{
                    background: myAnswer !== null ? 'rgba(99,102,241,0.2)' : '#6366F1',
                    color: '#fff',
                    opacity: !textAnswer.trim() || myAnswer !== null ? 0.5 : 1,
                  }}>
                  {myAnswer !== null ? 'Réponse envoyée ✓' : 'Envoyer'}
                </button>
                {myAnswer !== null && (
                  <p className="text-sm mt-3" style={{ color: '#9090A0' }}>En attente de la révélation…</p>
                )}
              </>
            )}
          </div>
        ) : isEliminated ? (
          // D6 — Spectateur éliminé
          <div className="text-center px-6">
            <div className="flex justify-center mb-3"><Eye size={48} color="#5A5A6E" /></div>
            <p className="text-xl font-bold" style={{ color: '#9090A0' }}>Mode spectateur</p>
            <p className="text-sm mt-1" style={{ color: '#5A5A6E' }}>Tu ne peux plus buzzer, mais tu peux encourager !</p>
          </div>
        ) : (
          // BUZZER : buzz (mode animateur → validation ; auto présentiel → réflexe).
          <BuzzButton armed={armed} winner={winner} iWon={iWon} revealed={revealed} onBuzz={buzz} />
        )}
      </div>

      {/* Confirmation Fin (hôte) */}
      {endConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl p-6 max-w-xs w-full"
            style={{ background: '#15151B', border: '1px solid rgba(239,68,68,0.25)' }}>
            <h3 className="font-semibold mb-1" style={{ color: '#F87171' }}>Terminer la partie ?</h3>
            <p className="text-sm mb-5" style={{ color: '#9090A0' }}>Tous les joueurs verront le classement final.</p>
            <div className="flex gap-2">
              <button onClick={() => { endGame(); setEndConfirm(false) }} className="btn-danger flex-1">Terminer</button>
              <button onClick={() => setEndConfirm(false)} className="btn-ghost flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Correspondance intelligente (MIROIR du serveur, gameHandler.answersMatch) ──
// Permet un feedback IMMÉDIAT à la révélation pour la saisie libre : même algo
// déterministe (casse/accents, ~1 faute / 5 lettres, inclusion contrôlée).
function normalizeAnswer(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function editDistance(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}
function answersMatchClient(playerAnswer, correctAnswer) {
  const p = normalizeAnswer(playerAnswer)
  const c = normalizeAnswer(correctAnswer)
  if (!p || !c || p.length < 3) return false
  if (p === c) return true
  const tol = Math.max(1, Math.floor(Math.min(p.length, c.length) / 5))
  if (editDistance(p, c) <= tol) return true
  const [short, long] = p.length <= c.length ? [p, c] : [c, p]
  if (short.length >= 5 && long.includes(short) && short.length / long.length >= 0.5) return true
  return false
}

// Sélection de réponse (QCM / Vrai-Faux / CHOIX-IMAGES). Le serveur valide et marque.
// - Choix riches (question.choices) → on soumet l'INDEX ; bon choix = revealCorrectIndex.
// - Sinon → choix texte : on soumet la VALEUR texte ; bon choix = revealReponse.
function AnswerPad({ question, myAnswer, revealed, revealReponse, revealCorrectIndex, onAnswer }) {
  const norm = s => String(s ?? '').trim().toLowerCase()
  const rich = Array.isArray(question.choices) && question.choices.length > 0

  const options = rich
    ? question.choices.map((c, i) => ({ value: i, text: c?.text ?? null, mediaUrl: c?.mediaUrl ?? null }))
    : question.type === 'VRAI_FAUX'
      ? [
          { value: 'Vrai', text: <span className="inline-flex items-center gap-2"><Check size={20} color="#22C55E" />Vrai</span> },
          { value: 'Faux', text: <span className="inline-flex items-center gap-2"><X size={20} color="#F87171" />Faux</span> },
        ]
      : (question.choix ?? []).map((c, i) => ({ value: c, text: `${['A', 'B', 'C', 'D', 'E', 'F'][i]}. ${c}` }))

  const hasImages = rich && options.some(o => o.mediaUrl)
  const cols = hasImages || rich || question.type === 'VRAI_FAUX' ? 'grid-cols-2' : 'grid-cols-1'
  const isOptCorrect = (opt) => revealed && (rich ? revealCorrectIndex === opt.value : norm(revealReponse) === norm(opt.value))
  const myCorrect = rich ? myAnswer === revealCorrectIndex : norm(revealReponse) === norm(myAnswer)

  return (
    <div className="w-full max-w-md">
      <p className="text-center text-base font-semibold mb-5" style={{ color: '#ECECF0' }}>{question.enonce}</p>
      <div className={`grid ${cols} gap-3`}>
        {options.map(opt => {
          const chosen = myAnswer === opt.value
          const isCorrect = isOptCorrect(opt)
          const isWrongChosen = revealed && chosen && !isCorrect
          let bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.1)', color = '#ECECF0'
          if (isCorrect) { bg = 'rgba(34,197,94,0.18)'; border = 'rgba(34,197,94,0.6)'; color = '#22C55E' }
          else if (isWrongChosen) { bg = 'rgba(248,113,113,0.15)'; border = 'rgba(248,113,113,0.5)'; color = '#F87171' }
          else if (chosen) { bg = 'rgba(99,102,241,0.22)'; border = 'rgba(99,102,241,0.6)'; color = '#A5B4FC' }
          return (
            <button key={String(opt.value)} disabled={myAnswer !== null || revealed} onClick={() => onAnswer(opt.value)}
              className="rounded-2xl p-3 flex flex-col items-center justify-center gap-2 text-center font-semibold transition-all active:scale-[0.98]"
              style={{ background: bg, border: `2px solid ${border}`, color, minHeight: opt.mediaUrl ? 0 : 64 }}>
              {opt.mediaUrl && (
                <img src={opt.mediaUrl} alt="" className="rounded-lg object-contain"
                  style={{ maxHeight: 90, maxWidth: '100%', background: 'rgba(0,0,0,0.2)' }} />
              )}
              {opt.text && <span className={opt.mediaUrl ? 'text-sm' : 'text-lg'}>{opt.text}</span>}
            </button>
          )
        })}
      </div>
      <p className="text-center text-sm mt-5" style={{ color: '#9090A0' }}>
        {revealed
          ? (myAnswer !== null ? (myCorrect ? 'Bonne réponse !' : 'Raté cette fois…') : 'Pas de réponse')
          : myAnswer !== null ? 'Réponse envoyée ✓ — on attend la suite…' : 'Choisis ta réponse !'}
      </p>
    </div>
  )
}

function BuzzButton({ armed, winner, iWon, revealed, onBuzz }) {
  let label, sub, color, pulse = false
  if (iWon) { label = 'TU AS BUZZÉ !'; sub = 'Plus rapide que tout le monde'; color = '#22C55E' }
  else if (winner) { label = `${winner.prenom} a buzzé`; sub = 'Trop tard cette fois…'; color = '#5A5A6E' }
  else if (revealed) { label = 'Réponse révélée'; sub = 'Regarde l\'écran'; color = '#818CF8' }
  else if (armed) { label = 'BUZZ'; sub = 'Appuie dès que tu sais !'; color = '#6366F1'; pulse = true }
  else { label = 'Prépare-toi…'; sub = 'La prochaine question arrive'; color = '#5A5A6E' }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <button
        onClick={onBuzz}
        disabled={!armed}
        className="relative rounded-full flex items-center justify-center select-none transition-transform active:scale-95"
        style={{
          width: 'min(72vw, 320px)', height: 'min(72vw, 320px)',
          background: armed
            ? `radial-gradient(circle at 50% 35%, ${hex(color, 0.95)}, ${hex(color, 0.6)})`
            : `radial-gradient(circle at 50% 35%, ${hex(color, 0.35)}, ${hex(color, 0.15)})`,
          boxShadow: armed ? `0 0 60px ${hex(color, 0.5)}, inset 0 -8px 24px rgba(0,0,0,0.3)` : 'inset 0 -8px 24px rgba(0,0,0,0.3)',
          border: `2px solid ${hex(color, 0.5)}`,
          cursor: armed ? 'pointer' : 'default',
        }}>
        {pulse && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: hex(color, 0.25) }} />}
        {iWon ? <Check size={84} color="#fff" strokeWidth={2.5} />
          : winner ? <Hand size={72} color="#fff" strokeWidth={2} />
          : <Zap size={88} color="#fff" strokeWidth={2.5} style={{ opacity: armed ? 1 : 0.5 }} />}
      </button>
      <div className="text-center">
        <p className="text-xl font-extrabold tracking-tight" style={{ color: '#ECECF0' }}>{label}</p>
        <p className="text-sm mt-1" style={{ color: '#9090A0' }}>{sub}</p>
      </div>
    </div>
  )
}

function Center({ children }) {
  return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0E0E12' }}>{children}</div>
}
function hex(color, alpha) {
  const c = (color ?? '#6366F1').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
