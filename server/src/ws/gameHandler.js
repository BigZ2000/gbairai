import { prisma } from '../utils/prisma.js'
import { flattenManchesServer } from '../services/gameService.js'
import { broadcast, sendToBuzzer } from './wsServer.js'
import { releaseBuzzersFromGame } from '../services/buzzerService.js'

const autoTimers = new Map()
const revealTimers = new Map()

// ── Exported helpers for parties.js ──────────────────────────────────────────

export function setGameQuestions(partieCode, questions) {
  const state = getGameState(partieCode)
  state.questions = questions
  // La partie affiche immédiatement la première question (index 0) au lancement.
  state.currentQuestion = 0
  state.revealed = false
  state.buzzLocked = false
  state.answers = new Map()
  state.questionShownAt = Date.now()
  initMedia(state, questions?.[0])
}

// ── Synchronisation média : horloge basée sur l'horodatage serveur ───────────
// Le serveur est la source de vérité. Pour chaque question audio/vidéo, il
// mémorise la position de lecture sous forme d'une « horloge » :
//   - baseOffset : position (s) au dernier (re)démarrage de la lecture
//   - startedAt  : instant serveur (ms) de ce (re)démarrage
//   - playing    : lecture en cours ou en pause
// La position courante = baseOffset + (now - startedAt) si en lecture,
// sinon baseOffset. Chaque client se cale sur cette position → drift minimal,
// reprise correcte après reconnexion (vidéo à 23 s reprend ~23 s).

function hasPlayableMedia(q) {
  if (!q) return false
  if (q.type === 'AUDIO' && q.audioUrl) return true
  if (q.type === 'VIDEO' && q.videoUrl) return true
  return false // IMAGE : aucune horloge nécessaire
}

// Initialise (et démarre) l'horloge média pour une question donnée.
function initMedia(state, q) {
  if (hasPlayableMedia(q)) {
    state.media = {
      playing: true,
      baseOffset: q.videoDebut ?? 0,
      startedAt: Date.now(),
      seq: Date.now(), // identifiant de commande : force la resynchro client
    }
  } else {
    state.media = null
  }
}

// Position de lecture courante (secondes) calculée depuis l'horodatage serveur.
function mediaPosition(media) {
  if (!media) return 0
  return media.playing ? media.baseOffset + (Date.now() - media.startedAt) / 1000 : media.baseOffset
}

// Message de synchronisation média (diffusé à tous + dans les snapshots).
export function mediaStateMessage(partieCode) {
  const state = getGameState(partieCode)
  const m = state.media
  return {
    type: 'media_state',
    hasMedia: !!m,
    playing: m ? m.playing : false,
    position: m ? mediaPosition(m) : 0,
    seq: m ? m.seq : 0,
    serverNow: Date.now(),
  }
}

// Message d'affichage de la question courante, enrichi du chronomètre
// (tempsLimite + temps restant calculé depuis l'horodatage serveur). Centralisé
// ici pour que le lancement (parties.js), l'avancement et les snapshots
// produisent exactement le même message → écran public synchronisé.
export function questionDisplayMessage(partieCode) {
  const state = getGameState(partieCode)
  const idx = state.currentQuestion ?? -1
  const q = idx >= 0 ? state.questions?.[idx] : null
  if (!q) {
    return { type: 'question_display', index: idx, question: null, tempsLimite: null, remainingMs: null, serverNow: Date.now() }
  }
  const { reponse, explication, ...qPublic } = q
  const tl = q.tempsLimite ?? null
  const shownAt = state.questionShownAt ?? Date.now()
  return {
    type: 'question_display',
    index: idx,
    question: qPublic,
    tempsLimite: tl,
    remainingMs: tl != null ? Math.max(0, tl * 1000 - (Date.now() - shownAt)) : null,
    serverNow: Date.now(),
  }
}

// ── LED des buzzers matériels ────────────────────────────────────────────────
// Le buzzer physique n'est pas dans une « room » et ne connaît pas le code de la
// partie : le serveur lui POUSSE directement l'état de sa LED via sendToBuzzer.
// États : 'idle' | 'armed' | 'winner' | 'locked' | 'reveal'.
export async function pushLedToBuzzers(partieCode, state, opts = {}) {
  const parts = await prisma.participant.findMany({
    where: { partie: { code: partieCode }, buzzerId: { not: null } },
    select: { id: true, buzzer: { select: { mac: true } } },
  })
  for (const p of parts) {
    const mac = p.buzzer?.mac
    if (!mac) continue
    // Sur un buzz, le gagnant voit 'winner', les autres 'locked'.
    const s = (state === 'winner') ? (p.id === opts.winnerParticipantId ? 'winner' : 'locked') : state
    sendToBuzzer(mac, { type: 'led', state: s, partieCode })
  }
}

// Déduit l'état de LED courant d'une partie pour un participant donné
// (utilisé pour resynchroniser un buzzer qui (re)connecte en cours de partie).
function ledStateFromGame(partieCode, participantId) {
  const st = gameStates.get(partieCode)
  if (!st) return 'idle'
  if (st.revealed) return 'reveal'
  if (st.buzzLocked) return st.currentWinnerParticipantId === participantId ? 'winner' : 'locked'
  return (st.currentQuestion != null && st.currentQuestion >= 0) ? 'armed' : 'idle'
}

// Snapshot LED envoyé à un buzzer dès sa (re)connexion s'il est assigné à une
// partie EN_COURS — il retrouve immédiatement le bon état sans rien demander.
export async function sendLedSnapshot(mac) {
  if (!mac) return
  const p = await prisma.participant.findFirst({
    where: { buzzer: { mac }, partie: { status: 'EN_COURS' } },
    include: { partie: { select: { code: true } } },
  })
  if (!p) return
  const state = ledStateFromGame(p.partie.code, p.id)
  sendToBuzzer(mac, { type: 'led', state, partieCode: p.partie.code })
}

// Diffuse le classement « live » (scores à jour) — alimente le tableau des
// scores de l'écran public et de la page de jeu après chaque validation/vote.
async function broadcastParticipants(partieCode) {
  const partie = await prisma.partie.findUnique({ where: { code: partieCode }, select: { id: true } })
  if (!partie) return
  const participants = await prisma.participant.findMany({
    // Le maître du jeu (animateur) n'est pas un joueur → exclu du classement.
    where: { partieId: partie.id, isAnimateur: false },
    orderBy: { score: 'desc' },
    include: { buzzer: { select: { couleur: true, mac: true, status: true, battery: true } } },
  })
  broadcast(partieCode, {
    type: 'participant_update',
    participants: participants.map(p => ({
      id: p.id, userId: p.userId, prenom: p.prenom, score: p.score, rang: p.rang,
      isEliminated: p.isEliminated ?? false,
      buzzer: p.buzzer ? { couleur: p.buzzer.couleur, mac: p.buzzer.mac, status: p.buzzer.status, battery: p.buzzer.battery } : null,
    })),
  })
}

// D6 — Élimine le joueur en dernière position d'une manche (devient spectateur).
// Appelé quand on quitte une manche avec eliminationActive = true.
async function eliminateLastPlayer(partieCode) {
  const partie = await prisma.partie.findUnique({ where: { code: partieCode }, select: { id: true } })
  if (!partie) return
  const players = await prisma.participant.findMany({
    where: { partieId: partie.id, isAnimateur: false, isEliminated: false },
    orderBy: { score: 'asc' },
  })
  if (players.length <= 1) return // ne jamais éliminer le dernier joueur
  const last = players[0]
  await prisma.participant.update({ where: { id: last.id }, data: { isEliminated: true } })
  broadcast(partieCode, {
    type: 'player_eliminated',
    participantId: last.id,
    prenom: last.prenom,
  })
}

// Avance à la question suivante (ou termine la partie). Renvoie true si une
// nouvelle question a été affichée, false si la partie est terminée. Réutilisé
// par le mode auto, le « Suivant » manuel (animateur) et l'enchaînement du vote.
async function goToNextQuestion(partieCode) {
  const state = getGameState(partieCode)

  // D6 — Détecte le changement de manche AVANT d'incrémenter l'index.
  const prevQ = state.questions?.[state.currentQuestion ?? -1]
  const nextIdx = (state.currentQuestion ?? -1) + 1
  const nextQ = state.questions?.[nextIdx]
  // La manche vient de se terminer si eliminationActive et qu'on passe à une
  // nouvelle manche (ou à la fin de la partie).
  if (prevQ?.eliminationActive) {
    const prevManche = prevQ.mancheOrdre
    const nextManche = nextQ?.mancheOrdre ?? null
    if (nextManche === null || nextManche !== prevManche) {
      await eliminateLastPlayer(partieCode)
    }
  }

  state.buzzLocked = false
  state.revealed = false
  state.currentWinnerParticipantId = null
  state.winnerSelectedAnswer = null
  state.answers = new Map() // réponses (mode auto) remises à zéro à chaque question
  state.currentQuestion = nextIdx

  const questions = await loadQuestions(partieCode, state)
  const q = questions[state.currentQuestion]
  if (!q) { await endGameInternal(partieCode); return false }

  state.questionShownAt = Date.now()
  initMedia(state, q)
  broadcast(partieCode, questionDisplayMessage(partieCode))
  broadcast(partieCode, mediaStateMessage(partieCode))
  await pushLedToBuzzers(partieCode, 'armed') // LED buzzers : prêt à buzzer
  return true
}

// Snapshot envoyé à un seul client (à la connexion / reconnexion / changement
// d'onglet). On réutilise les évènements existants (question_display /
// question_reveal / media_state) pour que les pages se resynchronisent sans
// code dédié. La partie EN_ATTENTE / TERMINEE est gérée via REST côté client.
export async function sendSnapshot(ws, partieCode) {
  if (!partieCode) return
  const partie = await prisma.partie.findUnique({
    where: { code: partieCode },
    select: { status: true },
  })
  if (!partie || partie.status !== 'EN_COURS') return

  const state = getGameState(partieCode)
  const questions = await loadQuestions(partieCode, state)
  const idx = state.currentQuestion ?? -1
  const q = idx >= 0 ? questions[idx] : null

  const sendOne = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)) }

  if (q) {
    sendOne(questionDisplayMessage(partieCode))
    if (state.revealed) {
      sendOne({ type: 'question_reveal', index: idx, reponse: q.reponse, explication: q.explication ?? null })
    }
  }
  sendOne(mediaStateMessage(partieCode))
  // Resynchronise aussi le tableau des scores à la (re)connexion.
  await broadcastParticipants(partieCode)
}

// ── Moteur du mode automatique (piloté par le serveur) ───────────────────────
// En mode auto, le serveur gère seul le rythme : il révèle la réponse à
// l'expiration du minuteur de chaque question, marque une courte pause, puis
// passe automatiquement à la question suivante (ou termine la partie).

// Démarre le minuteur de révélation pour la question courante.
// Appelé par parties.js juste après le 1er question_display, puis en interne.
export async function startAutoQuestion(partieCode) {
  await scheduleReveal(partieCode)
}

// Planifie la révélation automatique en fonction du tempsLimite de la question.
async function scheduleReveal(partieCode) {
  const state = getGameState(partieCode)
  const questions = await loadQuestions(partieCode, state)
  const q = questions[state.currentQuestion]
  if (!q) return

  state.questionShownAt = Date.now()
  state.revealed = false
  state.buzzLocked = false

  const tempsLimite = q.tempsLimite ?? 30
  clearAutoTimer(partieCode)
  const t = setTimeout(() => { doReveal(partieCode).catch(() => {}) }, tempsLimite * 1000)
  autoTimers.set(partieCode, t)
}

// Normalise une réponse pour comparaison (casse / espaces / accents).
function normalizeAnswer(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// A5 — correspondance intelligente : la réponse est juste si elle est identique
// à la réponse attendue, ou si l'une contient l'autre (insensible casse/accents).
// Garde-fou min 3 caractères : évite que "a" (présente dans tout) soit acceptée.
function answersMatch(playerAnswer, correctAnswer) {
  const p = normalizeAnswer(playerAnswer)
  const c = normalizeAnswer(correctAnswer)
  if (!p || !c || p.length < 3) return false
  return p === c || p.includes(c) || c.includes(p)
}

function questionAChoix(q) {
  return q?.type === 'QCM' || q?.type === 'VRAI_FAUX' || (Array.isArray(q?.choix) && q.choix.length > 0)
}

// ── Comptabilisation des points en MODE AUTOMATIQUE ──────────────────────────
// Aucun animateur ne valide : le score est déterminé par les données.
//  • Question à choix (QCM / Vrai-Faux) : chaque joueur ayant choisi la bonne
//    réponse marque des points, pondérés par la rapidité (modèle Kahoot).
//  • Question ouverte (BUZZER) : la bonne réponse ne peut pas être jugée
//    automatiquement → le plus rapide à buzzer marque (jeu de réflexe).
// Barème UNIFIÉ (même échelle pour tous les modes) : 50 % garantis pour une
// bonne réponse + 50 % selon la rapidité. `ms` = temps de réponse/buzz.
export function questionPoints(q, ms) {
  const base = q?.pointsParQ ?? q?.points ?? 100
  const mult = q?.multiplicateurPoints ?? 1.0  // D9.1: barème croissant par manche
  const limitMs = (q?.tempsLimite ?? 30) * 1000
  const speed = Math.max(0, Math.min(1, 1 - (ms ?? limitMs) / limitMs))
  return Math.round(base * mult * (0.5 + 0.5 * speed))
}

async function scoreAutoQuestion(partieCode) {
  const state = getGameState(partieCode)
  const q = state.questions?.[state.currentQuestion]
  if (!q) return
  const updates = []

  if (questionAChoix(q)) {
    // Questions à choix (QCM/VF) : comparaison exacte sur le texte du choix.
    const correct = normalizeAnswer(q.reponse)
    for (const [pid, a] of state.answers) {
      if (normalizeAnswer(a.answer) === correct) {
        updates.push({ participantId: pid, pts: questionPoints(q, a.ms) })
      }
    }
  } else {
    // A4/A5 — Question BUZZER en mode distanciel : saisie libre, matching intelligent.
    // (En présentiel, les questions BUZZER ne sont pas scorées automatiquement.)
    const partie = await prisma.partie.findUnique({ where: { code: partieCode }, select: { modeDistanciel: true } })
    if (partie?.modeDistanciel) {
      for (const [pid, a] of state.answers) {
        if (answersMatch(a.answer, q.reponse)) {
          updates.push({ participantId: pid, pts: questionPoints(q, a.ms) })
        }
      }
    }
  }

  for (const u of updates) {
    await prisma.participant.update({ where: { id: u.participantId }, data: { score: { increment: u.pts } } }).catch(() => {})
    recordEvent(partieCode, {
      type: 'answer', questionIndex: state.currentQuestion,
      questionId: q.id ?? null, participantId: u.participantId, valide: true,
    })
  }
  if (updates.length) await broadcastParticipants(partieCode)
}

// Révèle la réponse de la question courante puis programme l'avancement.
async function doReveal(partieCode) {
  clearAutoTimer(partieCode)
  const state = getGameState(partieCode)
  if (state.revealed) return
  state.revealed = true

  const questions = await loadQuestions(partieCode, state)
  const q = questions[state.currentQuestion]
  if (!q) return

  // Attribue les points AVANT de révéler (les scores arrivent avec la réponse).
  await scoreAutoQuestion(partieCode)

  broadcast(partieCode, {
    type: 'question_reveal',
    index: state.currentQuestion,
    reponse: q.reponse,
    explication: q.explication ?? null,
  })
  await pushLedToBuzzers(partieCode, 'reveal')
  recordEvent(partieCode, {
    type: 'reveal',
    questionIndex: state.currentQuestion,
    questionId: q.id ?? null,
  })

  scheduleAdvance(partieCode)
}

// Petite pause après la révélation avant de passer à la question suivante.
function scheduleAdvance(partieCode) {
  clearRevealTimer(partieCode)
  broadcast(partieCode, { type: 'auto_next_question', countdown: 3 })
  const t = setTimeout(() => { advanceAuto(partieCode).catch(() => {}) }, 3000)
  revealTimers.set(partieCode, t)
}

// Avance à la question suivante (ou termine la partie s'il n'y en a plus),
// puis relance le minuteur de révélation auto.
async function advanceAuto(partieCode) {
  clearRevealTimer(partieCode)
  if (await goToNextQuestion(partieCode)) {
    await scheduleReveal(partieCode)
  }
}

// Persiste un évènement de jeu (buzz / réponse) pour l'historique et les stats.
async function recordEvent(partieCode, data) {
  try {
    const partie = await prisma.partie.findUnique({ where: { code: partieCode }, select: { id: true } })
    if (!partie) return
    await prisma.gameEvent.create({ data: { partieId: partie.id, ...data } })
  } catch { /* journalisation best-effort */ }
}

// ── Traitement unifié du BUZZ (téléphone OU matériel) ────────────────────────
// Un seul évènement d'entrée `buzz`, deux sources résolues vers UN participant :
//   • source 'web'    → identifié par participantId (buzzer virtuel WEB-<id>)
//   • source 'device' → identifié par la MAC (matériel ESP32), traduite ici en
//                        participant côté serveur. Le matériel n'a aucune notion
//                        de joueur : toute la logique métier raisonne en
//                        « participant », pas en « mac » (zéro dette hardware).
async function handleBuzz({ ws, partieCode, participantId, mac, source }, broadcast) {
  const resolvedSource = source ?? (participantId ? 'web' : 'device')
  // Identifiant d'affichage des pastilles : mac réelle (matériel) ou virtuelle.
  const displayMac = resolvedSource === 'web'
    ? (participantId ? `WEB-${participantId}` : null)
    : (mac ?? ws?._gbairai?.mac ?? '').toUpperCase() || null
  if (!displayMac) return
  if (resolvedSource === 'web' && !participantId) return

  // Le matériel n'a pas besoin de connaître le code de la partie : on le résout
  // depuis l'assignation du buzzer (la partie EN_COURS qui utilise cette mac).
  let pc = partieCode
  if (resolvedSource === 'device' && !pc) {
    const m = await prisma.participant.findFirst({
      where: { buzzer: { mac: displayMac }, partie: { status: 'EN_COURS' } },
      include: { partie: { select: { code: true } } },
    })
    pc = m?.partie?.code ?? null
  }
  if (!pc) return

  const partie = await prisma.partie.findUnique({ where: { code: pc } })
  if (!partie || partie.status !== 'EN_COURS') return

  const state = getGameState(pc)
  // Réponse révélée → question close : aucun buzz (ni traité ni affiché).
  if (state.revealed) return

  const q = state.questions?.[state.currentQuestion]
  // Mécanique pilotée par le TYPE de question (et non plus par le mode) :
  //  • Question à choix (QCM/VF) → on RÉPOND (sélection simultanée), jamais de buzz.
  //  • Mode auto + distanciel + BUZZER → on SAISIT le texte, pas de buzz.
  //  • Sinon (BUZZER présentiel auto, ou tous modes animateur/vote) → buzz autorisé.
  if (questionAChoix(q)) return
  if (partie.modeAuto && partie.modeDistanciel) return

  broadcast(pc, { type: 'buzzer_pressed_visual', mac: displayMac, partieCode: pc })

  // Un seul gagnant par question : les pressions suivantes clignotent mais ne
  // changent pas le gagnant tant que la question n'a pas avancé.
  if (state.buzzLocked) return
  state.buzzLocked = true

  // Résolution vers un PARTICIPANT (cœur de l'unification).
  const participant = resolvedSource === 'web'
    ? await prisma.participant.findFirst({ where: { id: participantId, partie: { code: pc } } })
    : await prisma.participant.findFirst({ where: { partie: { code: pc }, buzzer: { mac: displayMac } } })

  // D6 — Un joueur éliminé ne peut plus buzzer (il est spectateur).
  if (participant?.isEliminated) {
    state.buzzLocked = false // déverrouiller pour les autres
    return
  }
  state.currentWinnerParticipantId = participant?.id ?? null

  const responseMs = state.questionShownAt ? Date.now() - state.questionShownAt : null
  state.winnerResponseMs = responseMs // sert au barème unifié (validation / vote)
  recordEvent(pc, {
    type: 'buzz',
    questionIndex: state.currentQuestion ?? 0,
    questionId: state.questions?.[state.currentQuestion]?.id ?? null,
    participantId: participant?.id ?? null,
    responseMs,
  })

  broadcast(pc, {
    type: 'buzzer_winner',
    mac: displayMac,
    participantId: participant?.id,
    prenom: participant?.prenom ?? 'Inconnu',
    responseMs,
  })
  await pushLedToBuzzers(pc, 'winner', { winnerParticipantId: participant?.id })

  // MODE AUTO + BUZZER PRÉSENTIEL = RÉFLEXE : le 1er à buzzer marque immédiatement
  // (pas de juge), puis révélation + avancement automatiques (rythme serveur).
  if (partie.modeAuto && !partie.modeDistanciel && participant?.id) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { score: { increment: questionPoints(q, responseMs) } },
    }).catch(() => {})
    await broadcastParticipants(pc)
    clearAutoTimer(pc)
    await doReveal(pc) // révèle + programme l'avancement
  }
}

// ── Main WS handler ────────────────────────────────────────────────────────

export async function handleGameMessage(ws, msg, { broadcast, sendToUser, sendToBuzzer }) {
  const { type, partieCode, participantId } = msg

  switch (type) {

    // Évènement de buzz unifié. `buzzer_press` est conservé comme ALIAS
    // déprécié (rétrocompatibilité) — même traitement.
    case 'buzz':
    case 'buzzer_press': {
      await handleBuzz({ ws, partieCode, participantId, mac: msg.mac, source: msg.source }, broadcast)
      break
    }

    // NB : le lancement de TOUTES les parties (animateur, auto, vote) passe
    // désormais par la route REST POST /start, qui tire les questions, fixe le
    // statut EN_COURS, diffuse game_started + la 1re question et démarre le
    // moteur auto le cas échéant. L'ancien message 'start_game_collective' ne
    // lançait jamais le moteur (questions jamais tirées) → bug des modes
    // auto/vote. Il est donc supprimé.

    // Réponse SIMULTANÉE d'un joueur (sélection QCM/VF, ou saisie texte en
    // distanciel). Acceptée dans TOUS les modes pour les questions à choix —
    // c'est ainsi que « tout le monde répond et marque » (mode animateur inclus).
    case 'submit_answer': {
      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie || partie.status !== 'EN_COURS') return
      const state = getGameState(partieCode)
      if (state.revealed) return
      const q = state.questions?.[state.currentQuestion]
      // Accepte : questions à choix (tous modes) OU saisie texte BUZZER en auto+distanciel.
      const accepte = questionAChoix(q) || (partie.modeAuto && partie.modeDistanciel)
      if (!accepte) return
      if (!participantId || state.answers.has(participantId)) return // 1 réponse verrouillée

      // Un joueur éliminé ne répond plus (D6).
      const me = await prisma.participant.findUnique({ where: { id: participantId }, select: { isEliminated: true } })
      if (me?.isEliminated) return

      const ms = state.questionShownAt ? Date.now() - state.questionShownAt : null
      state.answers.set(participantId, { answer: msg.answer, ms })

      // Total des RÉPONDANTS attendus : joueurs actifs (hors maître, hors éliminés).
      const total = await prisma.participant.count({
        where: { partieId: partie.id, isAnimateur: false, isEliminated: false },
      })
      broadcast(partieCode, { type: 'answers_update', count: state.answers.size, total })

      // Auto-révélation uniquement en mode AUTO (l'animateur garde la main sinon).
      if (partie.modeAuto && state.answers.size >= total && total > 0) {
        clearAutoTimer(partieCode); doReveal(partieCode)
      }
      break
    }

    case 'submit_vote': {
      const { questionIndex, valide } = msg
      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie?.modeVote) return

      // Pas d'auto-vote : le joueur qui a buzzé ne peut pas voter sur sa propre réponse.
      if (participantId && participantId === getGameState(partieCode).currentWinnerParticipantId) return

      const participant = await prisma.participant.findFirst({
        where: { id: participantId, partie: { code: partieCode } },
      })
      if (!participant) return

      await prisma.vote.upsert({
        where: { partieId_questionIndex_participantId: { partieId: partie.id, questionIndex, participantId: participant.id } },
        create: { partieId: partie.id, questionIndex, participantId: participant.id, valide },
        update: { valide },
      })

      // Votants attendus = tous les JOUEURS sauf le buzzeur (qui ne vote pas sa
      // propre réponse) et sauf le maître du jeu (hors classement).
      const winnerId = getGameState(partieCode).currentWinnerParticipantId
      const expectedVoters = await prisma.participant.count({
        where: { partieId: partie.id, isAnimateur: false, id: winnerId ? { not: winnerId } : undefined },
      })
      const votes = await prisma.vote.findMany({ where: { partieId: partie.id, questionIndex } })
      const pour = votes.filter(v => v.valide).length
      const contre = votes.filter(v => !v.valide).length

      broadcast(partieCode, { type: 'vote_update', questionIndex, pour, contre, total: votes.length })

      // Une fois que tout le monde a voté, le serveur tranche : il révèle la
      // réponse, attribue les points au joueur qui avait buzzé si le vote est
      // favorable, met à jour les scores, puis enchaîne automatiquement.
      const state = getGameState(partieCode)
      if (votes.length >= expectedVoters && !state.revealed && questionIndex === state.currentQuestion) {
        state.revealed = true
        const resultValid = pour > contre

        const questions = await loadQuestions(partieCode, state)
        const q = questions[state.currentQuestion]

        // Le buzzeur marque les points de la question (barème unifié) si la
        // salle valide sa réponse.
        if (resultValid && state.currentWinnerParticipantId) {
          await prisma.participant.update({
            where: { id: state.currentWinnerParticipantId },
            data: { score: { increment: questionPoints(q, state.winnerResponseMs) } },
          })
        }
        // Les VOTANTS ont un enjeu : ceux qui ont voté avec la majorité (le bon
        // jugement collectif) gagnent un petit bonus de consensus.
        const base = q?.pointsParQ ?? q?.points ?? 100
        const consensusPts = Math.round(base * 0.3)
        const goodVoters = votes
          .filter(v => v.valide === resultValid && v.participantId !== state.currentWinnerParticipantId)
          .map(v => v.participantId)
        if (goodVoters.length) {
          await prisma.participant.updateMany({
            where: { id: { in: goodVoters } },
            data: { score: { increment: consensusPts } },
          })
        }
        recordEvent(partieCode, {
          type: 'answer',
          questionIndex: state.currentQuestion,
          questionId: q?.id ?? null,
          participantId: state.currentWinnerParticipantId ?? null,
          valide: resultValid,
        })

        broadcast(partieCode, {
          type: 'question_reveal',
          index: state.currentQuestion,
          reponse: q?.reponse ?? null,
          explication: q?.explication ?? null,
        })
        broadcast(partieCode, { type: 'vote_result', valide: resultValid, pour, contre, total: votes.length })
        await broadcastParticipants(partieCode)

        // Enchaînement automatique vers la question suivante (rythme serveur).
        clearRevealTimer(partieCode)
        broadcast(partieCode, { type: 'auto_next_question', countdown: 4 })
        const t = setTimeout(() => { goToNextQuestion(partieCode).catch(() => {}) }, 4000)
        revealTimers.set(partieCode, t)
      }
      break
    }

    case 'validate_answer': {
      const { valide } = msg
      const state = getGameState(partieCode)
      const q = state.questions?.[state.currentQuestion]
      const pts = questionPoints(q, state.winnerResponseMs)
      broadcast(partieCode, { type: 'answer_validated', valide, points: valide ? pts : 0 })

      if (valide && participantId) {
        await prisma.participant.update({
          where: { id: participantId },
          data: { score: { increment: pts } },
        })
        await broadcastParticipants(partieCode)
      } else if (!valide && participantId && q?.malusEnabled) {
        // D3/D8 — Malus activé sur cette manche : mauvaise réponse = points retirés.
        const penalty = Math.round(pts * ((q.malusPenalite ?? 50) / 100))
        if (penalty > 0) {
          await prisma.participant.update({
            where: { id: participantId },
            data: { score: { decrement: penalty } },
          })
          await broadcastParticipants(partieCode)
        }
      }

      recordEvent(partieCode, {
        type: 'answer',
        questionIndex: state.currentQuestion ?? 0,
        questionId: q?.id ?? null,
        participantId: participantId ?? null,
        valide: !!valide,
      })

      if (valide) {
        // A1 — Bonne réponse : révèle automatiquement si pas encore fait → les
        // joueurs voient toujours la réponse avant de passer à la suivante.
        state.buzzLocked = true
        if (!state.revealed && q) {
          state.revealed = true
          broadcast(partieCode, {
            type: 'question_reveal',
            index: state.currentQuestion,
            reponse: q.reponse,
            explication: q.explication ?? null,
          })
          await pushLedToBuzzers(partieCode, 'reveal')
        }
      } else if (state.revealed) {
        state.buzzLocked = true
      } else {
        // Mauvaise réponse → rouvre le buzz (« vol »).
        state.buzzLocked = false
        state.currentWinnerParticipantId = null
        state.winnerSelectedAnswer = null
        broadcast(partieCode, { type: 'buzz_reopened' })
        await pushLedToBuzzers(partieCode, 'armed')
      }
      break
    }

    // D2 — Le buzzeur sélectionne sa réponse sur son téléphone (QCM/VF en mode
    // animateur). Le serveur envoie la sélection + si elle est correcte (A2) →
    // l'animateur valide avec toute l'information (👍 / 👎 reste son choix).
    case 'submit_selected_answer': {
      const state = getGameState(partieCode)
      if (!state.buzzLocked || participantId !== state.currentWinnerParticipantId) return
      state.winnerSelectedAnswer = msg.answer
      const q = state.questions?.[state.currentQuestion]
      const isCorrect = q ? answersMatch(msg.answer, q.reponse) : false
      broadcast(partieCode, {
        type: 'winner_answer_selected',
        participantId,
        answer: msg.answer,
        isCorrect,
      })
      break
    }

    // « Suivant » manuel (animateur). Réutilise l'avancement centralisé, qui
    // diffuse question_display (avec chronomètre) + media_state, ou termine la
    // partie s'il n'y a plus de question.
    case 'next_question': {
      await goToNextQuestion(partieCode)
      break
    }

    // ── Contrôle média par l'animateur (play / pause / replay / seek) ────────
    // L'animateur est le maître de séance : ses actions resynchronisent tous
    // les écrans. En mode auto, le serveur pilote seul → contrôle manuel ignoré.
    case 'media_control': {
      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie || partie.status !== 'EN_COURS') return
      if (partie.modeAuto) return
      // Si un animateur est désigné, lui seul peut piloter le média.
      if (partie.animateurId && partie.animateurId !== ws._gbairai?.userId) return

      const state = getGameState(partieCode)
      const m = state.media
      if (!m) return

      const { action, position } = msg
      if (action === 'pause') {
        if (m.playing) { m.baseOffset = mediaPosition(m); m.playing = false }
      } else if (action === 'play') {
        if (!m.playing) { m.startedAt = Date.now(); m.playing = true }
      } else if (action === 'replay') {
        const questions = await loadQuestions(partieCode, state)
        const q = questions[state.currentQuestion]
        m.baseOffset = q?.videoDebut ?? 0
        m.startedAt = Date.now()
        m.playing = true
      } else if (action === 'seek') {
        m.baseOffset = Math.max(0, Number(position) || 0)
        m.startedAt = Date.now()
      } else {
        return
      }
      m.seq = Date.now()
      broadcast(partieCode, mediaStateMessage(partieCode))
      break
    }

    // Resynchronisation à la demande (reconnexion / retour d'onglet).
    case 'request_state': {
      await sendSnapshot(ws, partieCode)
      break
    }

    // Révélation manuelle (animateur). Pour les questions à choix, on attribue
    // d'abord les points à TOUS ceux qui ont bien répondu (réponse simultanée),
    // puis on révèle. Pour les questions BUZZER, la validation s'est déjà faite
    // via validate_answer → scoreAutoQuestion ne fait rien (cohérent).
    case 'reveal_question': {
      const state = getGameState(partieCode)
      if (state.revealed) return

      await scoreAutoQuestion(partieCode) // score les sélections QCM/VF (mode animateur)

      state.revealed = true
      state.buzzLocked = true

      const questions = await loadQuestions(partieCode, state)
      const q = questions[state.currentQuestion]
      if (!q) return

      broadcast(partieCode, {
        type: 'question_reveal',
        index: state.currentQuestion,
        reponse: q.reponse,
        explication: q.explication ?? null,
      })
      await pushLedToBuzzers(partieCode, 'reveal')
      break
    }

    case 'end_game': {
      await endGameInternal(partieCode)
      break
    }

    case 'assign_buzzer': {
      const { buzzerId } = msg
      await prisma.participant.update({ where: { id: participantId }, data: { buzzerId } })
      const p = await prisma.participant.findUnique({ where: { id: participantId } })
      broadcast(partieCode, { type: 'buzzer_assigned', buzzerId, participantId, prenom: p?.prenom })
      break
    }

    case 'unassign_buzzer': {
      await prisma.participant.update({ where: { id: participantId }, data: { buzzerId: null } })
      broadcast(partieCode, { type: 'unassign_buzzer', participantId })
      break
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Termine la partie : statut TERMINEE, calcul/persistance des rangs, diffusion
// du classement final. Réutilisé par le case 'end_game' et le moteur auto.
async function endGameInternal(partieCode) {
  clearAutoTimer(partieCode)
  clearRevealTimer(partieCode)
  // La partie peut avoir été supprimée/annulée pendant qu'un minuteur auto était
  // en attente : on vérifie son existence et on ne lève jamais d'exception
  // (sinon un setTimeout non capturé ferait planter le serveur).
  const partie = await prisma.partie.findUnique({ where: { code: partieCode }, select: { id: true, status: true } })
  if (!partie || partie.status === 'TERMINEE' || partie.status === 'ANNULEE') {
    clearGameState(partieCode)
    return
  }
  await prisma.partie.update({
    where: { id: partie.id },
    data: { status: 'TERMINEE', endedAt: new Date() },
  })

  // Classement final (podium) — joueurs uniquement (le maître du jeu est exclu).
  const participants = await prisma.participant.findMany({
    where: { partieId: partie.id, isAnimateur: false },
    orderBy: { score: 'desc' },
    include: { buzzer: { select: { couleur: true } } },
  })
  // Persiste le rang final de chaque participant (pour l'historique/les stats).
  await Promise.all(participants.map((p, i) =>
    prisma.participant.update({ where: { id: p.id }, data: { rang: i + 1 } })
  ))
  const classement = participants.map((p, i) => ({
    id: p.id,
    prenom: p.prenom,
    score: p.score,
    couleur: p.buzzer?.couleur ?? '#6366F1',
    rang: i + 1,
  }))

  broadcast(partieCode, { type: 'game_ended', partieCode, classement })
  await pushLedToBuzzers(partieCode, 'idle') // LED buzzers : repos en fin de partie
  await releaseBuzzersFromGame(partie.id)   // statut IN_GAME → ONLINE
  clearGameState(partieCode)
}

const gameStates = new Map()

function getGameState(partieCode) {
  if (!gameStates.has(partieCode)) {
    gameStates.set(partieCode, { buzzLocked: false, currentQuestion: -1, questions: null, revealed: false, media: null, answers: new Map() })
  }
  const s = gameStates.get(partieCode)
  if (!s.answers) s.answers = new Map() // robustesse (états créés avant cet ajout)
  return s
}

function clearGameState(partieCode) {
  gameStates.delete(partieCode)
}

// Progression « live » d'une partie en cours (pour l'historique restreint) :
// index de la question courante + état de révélation. Ne divulgue aucun contenu.
export function getLiveProgress(partieCode) {
  const s = gameStates.get(partieCode)
  if (!s) return null
  return { currentIndex: s.currentQuestion ?? -1, revealed: !!s.revealed }
}

// Load questions from cache or DB
async function loadQuestions(partieCode, state) {
  if (state.questions) return state.questions

  const partie = await prisma.partie.findUnique({
    where: { code: partieCode },
    include: {
      manches: {
        orderBy: { ordre: 'asc' },
        include: {
          mancheQuestions: {
            orderBy: { ordre: 'asc' },
            include: { question: true },
          },
        },
      },
    },
  })
  state.questions = flattenManchesServer(partie?.manches ?? [])
  return state.questions
}

function clearAutoTimer(partieCode) {
  const t = autoTimers.get(partieCode)
  if (t) { clearTimeout(t); autoTimers.delete(partieCode) }
}

function clearRevealTimer(partieCode) {
  const t = revealTimers.get(partieCode)
  if (t) { clearTimeout(t); revealTimers.delete(partieCode) }
}
