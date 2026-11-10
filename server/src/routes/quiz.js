// ── ROUTES « MES QUIZ » + CRÉATION PAR IA ─────────────────────────────────────
// Un quiz personnel = un Pack PRIVÉ (ownerId) en contenu MANUEL, dont les
// questions sont des Question privées de l'utilisateur. Il se lance par la
// route de pack existante (POST /api/packs/:id/start) : mêmes modes, mêmes
// quotas, même moteur — aucune logique de jeu dupliquée ici.
//
//   GET    /api/quiz                 mes quiz
//   GET    /api/quiz/ia/etat         disponibilité + quota de la création par IA
//   POST   /api/quiz/ia/generer      demande → BROUILLON (rien n'est enregistré)
//   GET    /api/quiz/medias          recherche dans la médiathèque (lecture seule)
//   POST   /api/quiz                 enregistrer un brouillon validé
//   GET    /api/quiz/:id             rouvrir un quiz (forme brouillon)
//   PUT    /api/quiz/:id             remplacer le contenu d'un quiz
//   DELETE /api/quiz/:id             supprimer
import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../utils/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { getLimites, effectivePlan, INF } from '../config/plans.js'
import { getFournisseur, IaRefus, IaIndisponible } from '../services/ai/provider.js'
import { peutGenerer, etatIa, etatPublic, journaliser } from '../services/ai/aiQuota.js'
import {
  CONSIGNES, SCHEMA_QUIZ, LIMITES, construireMessage, mediasCandidats, chercherMedias,
  validerBrouillon, versQuestion, depuisQuestion, mediaPublic,
} from '../services/ai/quizGenerator.js'

const router = Router()

const selectUser = { id: true, plan: true, planExpireAt: true, isAdmin: true, isGuest: true }

// Compte requis (les invités éphémères ne créent pas de quiz).
async function loadUser(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: selectUser })
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  if (user.isGuest) return res.status(403).json({ error: 'Crée un compte pour créer tes propres quiz.', code: 'COMPTE_REQUIS' })
  req.fullUser = user
  next()
}

const packQuiz = {
  include: {
    questions: {
      orderBy: [{ manche: 'asc' }, { ordre: 'asc' }],
      include: { question: { include: { media: true } } },
    },
  },
}

function resume(p, lancements = 0) {
  return {
    id: p.id, nom: p.nom, description: p.description, emoji: p.emoji, couleur: p.couleur,
    origine: p.origine ?? 'MANUEL', nbQuestions: p._count?.questions ?? p.questions?.length ?? 0,
    tempsParQuestion: p.tempsParQuestion, lancements,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

async function monQuiz(req, res) {
  const pack = await prisma.pack.findUnique({ where: { id: req.params.id }, ...packQuiz })
  if (!pack || !pack.ownerId) { res.status(404).json({ error: 'Quiz introuvable' }); return null }
  if (pack.ownerId !== req.userId && !req.fullUser.isAdmin) { res.status(403).json({ error: 'Ce quiz ne t\'appartient pas' }); return null }
  return pack
}

// ── Liste ────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, loadUser, async (req, res) => {
  const packs = await prisma.pack.findMany({
    where: { ownerId: req.userId, statut: 'ACTIF' },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  })
  const counts = packs.length
    ? await prisma.partie.groupBy({ by: ['packId'], where: { packId: { in: packs.map(p => p.id) } }, _count: { _all: true } })
    : []
  const parPack = Object.fromEntries(counts.map(c => [c.packId, c._count._all]))
  const max = getLimites(effectivePlan(req.fullUser)).quizPersoMax
  res.json({
    quiz: packs.map(p => resume(p, parPack[p.id] ?? 0)),
    limite: req.fullUser.isAdmin || max === INF ? null : max,
  })
})

// ── Création par IA ──────────────────────────────────────────────────────────
router.get('/ia/etat', requireAuth, loadUser, async (req, res) => {
  res.json(etatPublic(await etatIa(req.fullUser)))
})

const GenererSchema = z.object({
  demande: z.string().trim().min(10, 'Décris ton quiz en une phrase au moins.').max(600),
  nbQuestions: z.number().int().min(3).max(40).default(10),
  // Matière fournie par l'organisateur (son entreprise, son cours, son événement).
  contexte: z.string().trim().max(6000).optional().default(''),
  utiliserMedias: z.boolean().default(true),
})

// Une seule génération à la fois par compte (évite le double clic et la course
// aux quotas : la ligne de journal n'existe qu'à la fin de l'appel).
const enCours = new Set()

router.post('/ia/generer', requireAuth, loadUser, async (req, res) => {
  const parsed = GenererSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide', code: 'DEMANDE_INVALIDE' })
  }
  const user = req.fullUser
  if (enCours.has(user.id)) {
    return res.status(409).json({ error: 'Une création est déjà en cours.', code: 'IA_EN_COURS' })
  }
  enCours.add(user.id)
  try {
    const droit = await peutGenerer(user)
    if (!droit.allowed) {
      return res.status(droit.status).json({ error: droit.reason, code: droit.code, etat: etatPublic(droit.etat) })
    }
    const { demande, contexte, utiliserMedias } = parsed.data
    const nbQuestions = Math.min(parsed.data.nbQuestions, droit.etat.questionsMax)
    const fournisseur = getFournisseur()

    // Médias que le modèle a le droit de citer : ceux-là, et aucun autre.
    const medias = utiliserMedias ? await mediasCandidats(`${demande} ${contexte.slice(0, 400)}`) : []
    const mediasParId = new Map(medias.map(m => [m.id, m]))

    const journal = { userId: user.id, fournisseur: fournisseur.nom, modele: fournisseur.modele, demande }
    let rep
    try {
      rep = await fournisseur.generer({
        consignes: CONSIGNES,
        message: construireMessage({ demande, nbQuestions, contexte, medias }),
        schema: SCHEMA_QUIZ,
      })
    } catch (e) {
      if (e instanceof IaRefus) {
        await journaliser({ ...journal, statut: 'refus', erreur: e.message, conso: e.conso })
        return res.status(422).json({ error: 'Cette demande n\'a pas pu être traitée : reformule-la.', code: 'IA_REFUS' })
      }
      const reessayable = e instanceof IaIndisponible && e.reessayable
      console.warn('[ia] génération indisponible :', e?.message)
      await journaliser({ ...journal, statut: 'erreur', erreur: e?.message, conso: e?.conso })
      return res.status(reessayable ? 503 : 502).json({
        error: `La création par IA ne répond pas pour le moment${reessayable ? ' : réessaie dans un instant' : ''}.`,
        code: 'IA_INDISPONIBLE',
      })
    }

    const brouillon = validerBrouillon(rep.sortie, { mediasParId, max: nbQuestions })
    // Moins de 3 questions jouables : on ne livre pas un quiz bancal, et la
    // tentative n'est pas décomptée du quota (statut 'invalide').
    if (brouillon.questions.length < 3) {
      await journaliser({ ...journal, modele: rep.modele, statut: 'invalide', erreur: `${brouillon.rejets.length} question(s) rejetée(s)`, conso: rep })
      return res.status(502).json({ error: 'Le quiz généré n\'était pas exploitable. Réessaie, ou précise ta demande.', code: 'IA_INVALIDE' })
    }
    await journaliser({ ...journal, modele: rep.modele, statut: 'ok', conso: rep, nbQuestions: brouillon.questions.length })

    const etat = etatPublic(await etatIa(user))
    res.json({
      brouillon: {
        titre: brouillon.titre, description: brouillon.description, emoji: brouillon.emoji,
        questions: brouillon.questions, origine: 'IA',
      },
      ecartees: brouillon.rejets.length,
      demandees: nbQuestions,
      etat,
      avertissement: 'Quiz proposé par une IA : relis les questions avant de jouer, surtout celles marquées « à vérifier ».',
    })
  } finally {
    enCours.delete(user.id)
  }
})

// ── Médiathèque (lecture seule, pour remplacer / ajouter un média) ───────────
router.get('/medias', requireAuth, loadUser, async (req, res) => {
  const q = String(req.query.q ?? '').slice(0, 100)
  const type = typeof req.query.type === 'string' ? req.query.type : null
  const medias = await chercherMedias({ q, type, limit: 24 })
  res.json({ medias: medias.map(mediaPublic) })
})

// ── Enregistrement ───────────────────────────────────────────────────────────
const QuizSchema = z.object({
  titre: z.string().trim().min(1, 'Donne un titre à ton quiz.').max(LIMITES.titreMax),
  description: z.string().trim().max(LIMITES.descriptionMax).optional().default(''),
  emoji: z.string().max(8).optional().default('🎯'),
  origine: z.enum(['IA', 'MANUEL']).optional().default('MANUEL'),
  tempsParQuestion: z.number().int().min(10).max(120).optional().default(30),
  questions: z.array(z.any()).min(1, 'Ajoute au moins une question.').max(60),
})

// Rejoue le contrôle du moteur sur ce que le client envoie et résout les médias
// en base : un identifiant inconnu est simplement ignoré.
async function controler(body) {
  const parsed = QuizSchema.safeParse(body)
  if (!parsed.success) return { erreur: parsed.error.issues[0]?.message ?? 'Quiz invalide' }
  const ids = [...new Set(parsed.data.questions.map(q => q?.media?.id ?? q?.mediaId).filter(x => typeof x === 'string'))]
  const medias = ids.length ? await prisma.media.findMany({ where: { id: { in: ids } } }) : []
  const mediasParId = new Map(medias.map(m => [m.id, m]))
  const b = validerBrouillon({ ...parsed.data, questions: parsed.data.questions }, { mediasParId, max: 60 })
  if (b.rejets.length) {
    const r = b.rejets[0]
    return { erreur: `Question ${r.index + 1} : ${r.raison}.`, index: r.index }
  }
  return { quiz: { ...parsed.data, titre: b.titre, description: b.description, emoji: b.emoji, questions: b.questions }, mediasParId }
}

async function creerQuestions(tx, userId, quiz, mediasParId) {
  const ids = []
  for (const q of quiz.questions) {
    const created = await tx.question.create({
      data: {
        ...versQuestion(q, q.media ? mediasParId.get(q.media.id) : null),
        tempsLimite: quiz.tempsParQuestion,
        publique: false,            // jamais tirée par les packs du catalogue
        createdById: userId,
        tags: ['quiz-perso'],
        source: quiz.origine === 'IA' ? 'IA (relu par l\'auteur)' : null,
      },
      select: { id: true },
    })
    ids.push(created.id)
  }
  return ids
}

// Supprime les questions privées devenues orphelines, sauf celles déjà jouées
// (référencées par une partie : l'historique doit rester lisible).
async function purgerQuestions(tx, userId, questionIds) {
  if (!questionIds.length) return
  await tx.question.deleteMany({
    where: {
      id: { in: questionIds }, createdById: userId, publique: false,
      mancheQuestions: { none: {} }, packQuestions: { none: {} },
    },
  })
}

router.post('/', requireAuth, loadUser, async (req, res) => {
  const user = req.fullUser
  const max = getLimites(effectivePlan(user)).quizPersoMax
  if (!user.isAdmin && max !== INF) {
    const n = await prisma.pack.count({ where: { ownerId: user.id, statut: 'ACTIF' } })
    if (n >= max) {
      return res.status(402).json({
        error: `Tu as atteint la limite de ${max} quiz enregistrés. Supprime-en un, ou passe en Premium pour en garder autant que tu veux.`,
        code: 'QUIZ_LIMITE', limite: max,
      })
    }
  }
  const c = await controler(req.body)
  if (c.erreur) return res.status(400).json({ error: c.erreur, code: 'QUIZ_INVALIDE', index: c.index })
  const { quiz, mediasParId } = c

  const pack = await prisma.$transaction(async (tx) => {
    const ids = await creerQuestions(tx, user.id, quiz, mediasParId)
    return tx.pack.create({
      data: {
        slug: `perso-${crypto.randomBytes(9).toString('hex')}`,
        nom: quiz.titre, description: quiz.description, emoji: quiz.emoji,
        couleur: '#F26A1B', categorie: 'Mes quiz',
        ownerId: user.id, origine: quiz.origine,
        contentMode: 'MANUEL', nbManches: 1, nbQuestions: ids.length,
        tempsParQuestion: quiz.tempsParQuestion,
        modeRecommande: 'auto', modeDistanciel: true,
        tier: 'GRATUIT', priorite: 0,
        questions: { create: ids.map((questionId, i) => ({ questionId, manche: 1, ordre: i })) },
      },
      include: { _count: { select: { questions: true } } },
    })
  })
  res.status(201).json(resume(pack))
})

router.get('/:id', requireAuth, loadUser, async (req, res) => {
  const pack = await monQuiz(req, res)
  if (!pack) return
  res.json({
    ...resume(pack),
    titre: pack.nom,
    questions: pack.questions.map(pq => depuisQuestion(pq.question)),
  })
})

router.put('/:id', requireAuth, loadUser, async (req, res) => {
  const pack = await monQuiz(req, res)
  if (!pack) return
  const c = await controler({ ...req.body, origine: pack.origine ?? 'MANUEL' })
  if (c.erreur) return res.status(400).json({ error: c.erreur, code: 'QUIZ_INVALIDE', index: c.index })
  const { quiz, mediasParId } = c
  const anciennes = pack.questions.map(pq => pq.questionId)

  const maj = await prisma.$transaction(async (tx) => {
    const ids = await creerQuestions(tx, pack.ownerId, quiz, mediasParId)
    await tx.packQuestion.deleteMany({ where: { packId: pack.id } })
    await tx.packQuestion.createMany({ data: ids.map((questionId, i) => ({ packId: pack.id, questionId, manche: 1, ordre: i })) })
    await purgerQuestions(tx, pack.ownerId, anciennes)
    return tx.pack.update({
      where: { id: pack.id },
      data: {
        nom: quiz.titre, description: quiz.description, emoji: quiz.emoji,
        nbQuestions: ids.length, tempsParQuestion: quiz.tempsParQuestion,
      },
      include: { _count: { select: { questions: true } } },
    })
  })
  res.json(resume(maj))
})

router.delete('/:id', requireAuth, loadUser, async (req, res) => {
  const pack = await monQuiz(req, res)
  if (!pack) return
  const anciennes = pack.questions.map(pq => pq.questionId)
  await prisma.$transaction(async (tx) => {
    await tx.pack.delete({ where: { id: pack.id } }) // cascade : PackQuestion
    await purgerQuestions(tx, pack.ownerId, anciennes)
  })
  res.json({ ok: true })
})

export default router
