import { prisma } from '../utils/prisma.js'

// Timers actifs par partieCode
const autoTimers = new Map()

export async function handleGameMessage(ws, msg, { broadcast, sendToUser, sendToBuzzer }) {
  const { type, partieCode, participantId } = msg

  switch (type) {

    // Buzzer physique ou virtuel pressé
    case 'buzzer_press': {
      const mac = msg.mac ?? ws._gbairai?.mac
      if (!mac || !partieCode) return

      const partie = await prisma.partie.findUnique({ where: { code: partieCode } })
      if (!partie || partie.status !== 'EN_COURS') return

      // Broadcast visuel immédiat (<100ms)
      broadcast(partieCode, { type: 'buzzer_pressed_visual', mac, partieCode })

      // Traitement arbitrage premier arrivé (voir gameState)
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

      // En mode auto : réinitialiser après timerBuzz secondes
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

    // Lancement collectif (mode sans animateur)
    case 'start_game_collective': {
      const participant = await prisma.participant.findFirst({
        where: { id: participantId, partie: { code: partieCode } },
      })
      if (!participant) return

      await prisma.partie.update({ where: { code: partieCode }, data: { status: 'EN_COURS' } })
      broadcast(partieCode, { type: 'game_started', partieCode })
      break
    }

    // Vote collectif sur une réponse
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

      // Résultat si tout le monde a voté ou après timerVote (géré côté client)
      if (votes.length >= allParticipants) {
        const resultValid = pour > contre
        broadcast(partieCode, { type: 'vote_result', valide: resultValid, pour, contre, total: votes.length })
      }
      break
    }

    // Animateur valide/invalide une réponse (mode avec animateur)
    case 'validate_answer': {
      const { valide, scoreIncrement } = msg
      broadcast(partieCode, { type: 'answer_validated', valide, scoreIncrement: scoreIncrement ?? 1 })

      if (valide && participantId) {
        await prisma.participant.update({
          where: { id: participantId },
          data: { score: { increment: scoreIncrement ?? 1 } },
        })
      }
      // Déverrouiller pour la prochaine question
      const state = getGameState(partieCode)
      state.buzzLocked = false
      break
    }

    // Question suivante (animateur ou auto)
    case 'next_question': {
      const state = getGameState(partieCode)
      state.buzzLocked = false
      state.currentQuestion = (state.currentQuestion ?? 0) + 1
      broadcast(partieCode, { type: 'question_changed', index: state.currentQuestion })
      break
    }

    // Fin de partie
    case 'end_game': {
      clearAutoTimer(partieCode)
      clearGameState(partieCode)
      await prisma.partie.update({ where: { code: partieCode }, data: { status: 'TERMINEE' } })
      broadcast(partieCode, { type: 'game_ended', partieCode })
      break
    }

    // Assignation buzzer (depuis l'interface animateur)
    case 'assign_buzzer': {
      const { buzzerId } = msg
      await prisma.participant.update({
        where: { id: participantId },
        data: { buzzerId },
      })
      const buzzer = await prisma.buzzer.findUnique({ where: { id: buzzerId } })
      broadcast(partieCode, {
        type: 'buzzer_assigned',
        buzzerId,
        participantId,
        prenom: (await prisma.participant.findUnique({ where: { id: participantId } }))?.prenom,
      })
      break
    }

    // Retrait assignation buzzer
    case 'unassign_buzzer': {
      await prisma.participant.update({
        where: { id: participantId },
        data: { buzzerId: null },
      })
      broadcast(partieCode, { type: 'unassign_buzzer', participantId })
      break
    }
  }
}

// État léger en mémoire par partie (hors DB)
const gameStates = new Map()

function getGameState(partieCode) {
  if (!gameStates.has(partieCode)) {
    gameStates.set(partieCode, { buzzLocked: false, currentQuestion: 0 })
  }
  return gameStates.get(partieCode)
}

function clearGameState(partieCode) {
  gameStates.delete(partieCode)
}

function clearAutoTimer(partieCode) {
  const timer = autoTimers.get(partieCode)
  if (timer) { clearTimeout(timer); autoTimers.delete(partieCode) }
}
