// Tests unitaires du contrôle des quiz (aucune base, aucun réseau).
//   node --test tests/quizGenerator.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { validerQuestion, validerBrouillon, versQuestion, depuisQuestion, motsCles, construireMessage, SCHEMA_QUIZ } from '../src/services/ai/quizGenerator.js'
import { effectivePlan, getLimites } from '../src/config/plans.js'
import { coutEstimeUsd } from '../src/services/ai/provider.js'
import { quizExemple } from './stubIa.js'

const q = (o) => ({ enonce: 'Quelle est la capitale du Ghana ?', mecanique: 'QCM', choix: ['Accra', 'Lomé', 'Kumasi', 'Abuja'], reponse: 'Accra', explication: 'Accra.', difficulte: 'FACILE', mediaId: null, mediaSuggestion: null, aVerifier: false, ...o })

test('QCM : la bonne réponse doit être une des propositions (casse/accents tolérés)', () => {
  assert.equal(validerQuestion(q({ reponse: ' accra ' })).question.reponse, 'Accra')
  assert.equal(validerQuestion(q({ reponse: 'Ouagadougou' })).ok, false)
  assert.equal(validerQuestion(q({ choix: ['Accra', 'accra', 'Lomé'] })).ok, false) // doublon → 2 choix
  assert.equal(validerQuestion(q({ choix: ['A', 'B', 'C', 'D', 'E', 'F'], reponse: 'F' })).ok, false) // tronqué à 4
})

test('Vrai/Faux : normalisé, sans choix', () => {
  const v = validerQuestion(q({ mecanique: 'VRAI_FAUX', choix: ['x'], reponse: 'VRAI' }))
  assert.deepEqual([v.question.reponse, v.question.choix], ['Vrai', []])
  assert.equal(validerQuestion(q({ mecanique: 'VRAI_FAUX', reponse: 'Peut-être' })).ok, false)
})

test('Réponse libre : bornes imposées par la correspondance du moteur', () => {
  assert.equal(validerQuestion(q({ mecanique: 'REPONSE_LIBRE', choix: [], reponse: 'Or' })).ok, false)
  assert.equal(validerQuestion(q({ mecanique: 'REPONSE_LIBRE', choix: [], reponse: 'x'.repeat(41) })).ok, false)
  assert.equal(validerQuestion(q({ mecanique: 'REPONSE_LIBRE', choix: [], reponse: 'Cacao' })).ok, true)
})

test('Médias : un identifiant hors liste est ignoré, jamais conservé', () => {
  const medias = new Map([['m1', { id: 'm1', type: 'IMAGE', url: '/uploads/a.jpg', titre: 'Drapeau' }]])
  assert.equal(validerQuestion(q({ mediaId: 'inconnu', mediaSuggestion: 'un drapeau' }), { mediasParId: medias }).question.media, null)
  const ok = validerQuestion(q({ mediaId: 'm1', mediaSuggestion: 'un drapeau' }), { mediasParId: medias }).question
  assert.equal(ok.media.id, 'm1')
  assert.equal(ok.mediaSuggestion, null)
})

test('Brouillon : écarte invalides et doublons, plafonne, ne lève jamais', () => {
  const b = validerBrouillon(quizExemple(10), { max: 10 })
  assert.equal(b.questions.length, 10)
  assert.ok(b.rejets.some(r => /propositions/.test(r.raison)))
  assert.ok(b.questions.every(x => x.media === null))
  assert.deepEqual(validerBrouillon(null).questions, [])
  assert.equal(validerBrouillon({ questions: [q(), q()] }).rejets[0].raison, 'Question en double')
})

test('Le média ne fixe pas la mécanique (image/audio/vidéo × QCM/VF/libre)', () => {
  const img = { id: 'i', type: 'IMAGE', url: '/uploads/i.jpg' }
  const son = { id: 's', type: 'AUDIO', url: '/uploads/s.mp3' }
  const vid = { id: 'v', type: 'VIDEO', url: '/uploads/v.mp4' }
  const qcm = validerQuestion(q()).question
  const vf = validerQuestion(q({ mecanique: 'VRAI_FAUX', choix: [], reponse: 'Faux' })).question
  const libre = validerQuestion(q({ mecanique: 'REPONSE_LIBRE', choix: [], reponse: 'Accra' })).question

  assert.deepEqual([versQuestion(qcm).type, versQuestion(vf).type, versQuestion(libre).type], ['QCM', 'VRAI_FAUX', 'BUZZER'])
  const a = versQuestion(vf, img); assert.deepEqual([a.type, a.mediaUrl, a.mediaId], ['VRAI_FAUX', '/uploads/i.jpg', 'i'])
  const b = versQuestion(qcm, son); assert.deepEqual([b.type, b.audioUrl, b.choix.length], ['AUDIO', '/uploads/s.mp3', 4])
  const c = versQuestion(vf, vid); assert.deepEqual([c.type, c.videoUrl, c.choix], ['VIDEO', '/uploads/v.mp4', ['Vrai', 'Faux']])
  const d = versQuestion(libre, son); assert.deepEqual([d.type, d.choix], ['AUDIO', []])

  // Aller-retour : la mécanique est retrouvée à la réouverture.
  for (const [src, media] of [[qcm, son], [vf, vid], [libre, son], [vf, img], [qcm, null]]) {
    assert.equal(depuisQuestion({ ...versQuestion(src, media), media }).mecanique, src.mecanique)
  }
})

test('Mots-clés et message : la demande et le contexte sont balisés', () => {
  assert.deepEqual(motsCles('Crée-moi un quiz de 15 questions sur les drapeaux africains'), ['drapeaux', 'africains'])
  const m = construireMessage({ demande: 'Quiz drapeaux', nbQuestions: 5, contexte: 'Notre société…', medias: [{ id: 'm1', type: 'IMAGE', titre: 'Ghana', tags: ['drapeaux'] }] })
  assert.match(m, /<demande>\nQuiz drapeaux\n<\/demande>/)
  assert.match(m, /<contexte>/)
  assert.match(m, /- id=m1 \| IMAGE \| Ghana/)
  assert.match(construireMessage({ demande: 'x', nbQuestions: 3 }), /aucun média disponible/)
})

test('Schéma de sortie : objets fermés, tous les champs requis', () => {
  const item = SCHEMA_QUIZ.properties.questions.items
  assert.equal(SCHEMA_QUIZ.additionalProperties, false)
  assert.equal(item.additionalProperties, false)
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort())
})

test('Plans : échéance dépassée → FREE ; limites IA par plan', () => {
  const hier = new Date(Date.now() - 864e5), demain = new Date(Date.now() + 864e5)
  assert.equal(effectivePlan({ plan: 'PRO', planExpireAt: hier }), 'FREE')
  assert.equal(effectivePlan({ plan: 'PRO', planExpireAt: demain }), 'PRO')
  assert.equal(effectivePlan({ plan: 'ENTREPRISE', planExpireAt: null }), 'ENTREPRISE')
  assert.equal(effectivePlan({}), 'FREE')
  assert.deepEqual([getLimites('FREE').iaGenerationsParMois, getLimites('FREE').iaEssai], [0, 1])
  assert.ok(getLimites('PRO').iaGenerationsParMois > 0 && getLimites('ENTREPRISE').iaGenerationsParMois > getLimites('PRO').iaGenerationsParMois)
})

test('Coût estimé', () => {
  assert.ok(Math.abs(coutEstimeUsd('claude-opus-5-5', 1e6, 1e6) - 24) < 1e-9)
  assert.ok(Math.abs(coutEstimeUsd('claude-haiku-5-5', 1e6, 1e6) - 0.6) < 1e-9)
})

test('Correspondance des réponses libres : fautes de frappe tolérées, sans laxisme', async () => {
  const { answersMatch } = await import('../src/ws/gameHandler.js')
  assert.equal(answersMatch('cacoa', 'Cacao'), true)          // inversion = 1 faute
  assert.equal(answersMatch('Yamousoukro', 'Yamoussoukro'), true)
  assert.equal(answersMatch("cote d'ivoire", "Côte d'Ivoire"), true)
  assert.equal(answersMatch('mali', 'malien'), false)
  assert.equal(answersMatch('cafe', 'cacao'), false)
  assert.equal(answersMatch('ab', 'abc'), false)
})
