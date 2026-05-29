import { prisma } from '../utils/prisma.js'
import { flattenManchesServer } from '../services/gameService.js'

const autoTimers = new Map()
const revealTimers = new Map()

// ── Exported helpers for parties.js ──────────────────────────────────────────

export function setGameQuestions(partieCode, questions) {
  const state = getGameState(partieCode)
  state.questions = questions
  state.currentQuestion = -1
  state.revealed = false
  state.buzzLocked = false
}

// ── Main WS handler ────────────────────────────────────────────────────────

export async function handleGameMessage(ws, msg, { broadcast, sendToUser, sendToBuzzer }) {
  const { type, partieCode, participantId } = msg

  switch (type) {

    case 'buzzer_press': {
      const mac = msg.mac ?? ws._gbairai?.mac
      if (!mac || !partieCode) return

      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie || partie.status !== 'EN_COURS') return

      broadcast(partieCode, { type: 'buzzer_pressed_visual', mac, partieCode })

      const state = getGameState(partieCode)
      if (state.buzzLocked) return

      state.buzzLocked = true
      const participant = await prisma.participant.findFirst({
        where: { partie: { code: partieCode }, buzzer: { mac } },
      })

      broadcast(partieCode, {
        type: 'buzzer_winner',
        mac,
        participantId: participant?.id,
        prenom: participant?.prenom ?? 'Inconnu',
      })

      if (partie.modeAuto) {
        const timer = setTimeout(() => {
          broadcast(partieCode, { type: 'auto_next_question', countdown: 3 })
          state.buzzLocked = false
          clearGameState(partieCode)
        }, partie.timerBuzz * 1000)
        autoTimers.set(partieCode, timer)
      }
      break
    }

    case 'start_game_collective': {
      const participant = await prisma.participant.findFirst({
        where: { id: participantId, partie: { code: partieCode } },
      })
      if (!participant) return

      await prisma.partie.update({ where: { code: partieCode }, data: { status: 'EN_COURS' } })
      broadcast(partieCode, { type: 'game_started', partieCode })
      break
    }

    case 'submit_vote': {
      const { questionIndex, valide } = msg
      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie?.modeVote) return

      const participant = await prisma.participant.findFirst({
        where: { id: participantId, partie: { code: partieCode } },
      })
      if (!participant) return

      await prisma.vote.upsert({
        where: { partieId_questionIndex_participantId: { partieId: partie.id, questionIndex, participantId: participant.id } },
        create: { partieId: partie.id, questionIndex, participantId: participant.id, valide },
        update: { valide },
      })

      const allParticipants = await prisma.participant.count({ where: { partieId: partie.id } })
      const votes = await prisma.vote.findMany({ where: { partieId: partie.id, questionIndex } })
      const pour = votes.filter(v => v.valide).length
      const contre = votes.filter(v => !v.valide).length

      broadcast(partieCode, { type: 'vote_update', questionIndex, pour, contre, total: votes.length })

      if (votes.length >= allParticipants) {
        const resultValid = pour > contre
        broadcast(partieCode, { type: 'vote_result', valide: resultValid, pour, contre, total: votes.length })
      }
      break
    }

    case 'validate_answer': {
      const { valide, scoreIncrement } = msg
      broadcast(partieCode, { type: 'answer_validated', valide, scoreIncrement: scoreIncrement ?? 1 })

      if (valide && participantId) {
        await prisma.participant.update({
          where: { id: participantId },
          data: { score: { increment: scoreIncrement ?? 1 } },
        })
      }
      const state = getGameState(partieCode)
      state.buzzLocked = false
      break
    }

    // Advance to next question — sends question_display (no reponse)
    case 'next_question': {
      const state = getGameState(partieCode)
      state.buzzLocked = false
      state.revealed = false
      state.currentQuestion = (state.currentQuestion ?? -1) + 1

      const questions = await loadQuestions(partieCode, state)
      const q = questions[state.currentQuestion]

      if (q) {
        const { reponse, explication, ...qPublic } = q
        broadcast(partieCode, { type: 'question_display', index: state.currentQuestion, question: qPublic })
      } else {
        broadcast(partieCode, { type: 'question_display', index: state.currentQuestion, question: null })
      }
      break
    }

    // Reveal the answer — sends question_reveal (with reponse)
    case 'reveal_question': {
      const state = getGameState(partieCode)
      if (state.revealed) return
      state.revealed = true

      const questions = await loadQuestions(partieCode, state)
      const q = questions[state.currentQuestion]
      if (!q) return

      broadcast(partieCode, {
        type: 'question_reveal',
        index: state.currentQuestion,
        reponse: q.reponse,
        explication: q.explication ?? null,
      })
      break
    }

    case 'end_game': {
      clearAutoTimer(partieCode)
      clearRevealTimer(partieCode)
      clearGameState(partieCode)
      await prisma.partie.update({ where: { code: partieCode }, data: { status: 'TERMINEE' } })
      broadcast(partieCode, { type: 'game_ended', partieCode })
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

const gameStates = new Map()

function getGameState(partieCode) {
  if (!gameStates.has(partieCode)) {
    gameStates.set(partieCode, { buzzLocked: false, currentQuestion: -1, questions: null, revealed: false })
  }
  return gameStates.get(partieCode)
}

function clearGameState(partieCode) {
  gameStates.delete(partieCode)
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
