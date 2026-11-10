import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import LaunchSheet from '../components/LaunchSheet.jsx'
import {
  Wand2, Sparkles, Loader2, Plus, Trash2, ArrowUp, ArrowDown, Check, X, Image as ImageIcon, Music, Video,
  AlertTriangle, Crown, PencilLine, Play, Save, ChevronDown, Search, ArrowLeft, Building2,
} from 'lucide-react'

// Studio de quiz : de l'idée au jeu en trois écrans.
//   demande  → une phrase (et, si besoin, un peu de matière : entreprise, cours…)
//   création → l'IA prépare un brouillon ; RIEN n'est enregistré
//   relecture→ on corrige ce qu'on veut, on enregistre, on joue
// Le même écran de relecture sert à écrire un quiz à la main et à rouvrir un quiz.
const BROUILLON = 'gbairai_brouillon_quiz'
const MECA = { QCM: 'Choix multiples', VRAI_FAUX: 'Vrai / Faux', REPONSE_LIBRE: 'Réponse libre' }
const TAILLES = [5, 10, 15, 20, 30, 40]
const EXEMPLES = [
  { icon: '🎶', l: 'Musique ivoirienne', t: 'Un quiz de 15 questions sur la musique ivoirienne, du zouglou au coupé-décalé' },
  { icon: '🤝', l: 'Team building', t: 'Un quiz pour un team building de 20 collaborateurs sur la cohésion d\'équipe et la culture générale' },
  { icon: '⚽', l: 'Les Éléphants', t: 'Un concours sur l\'histoire des Éléphants et de la CAN' },
  { icon: '🍻', l: 'Soirée maquis', t: 'Une soirée quiz au maquis : culture générale, facile et drôle' },
  { icon: '🎓', l: 'Révision de 3e', t: 'Révision pour des élèves de 3e sur l\'histoire de la Côte d\'Ivoire' },
]
const ETAPES = ['Je lis ta demande…', 'Je cherche les bons angles…', 'J\'écris les questions…', 'Je vérifie les réponses…', 'Je mets tout en ordre…']

const vide = () => ({ enonce: '', mecanique: 'QCM', choix: ['', '', '', ''], reponse: '', explication: '', difficulte: 'MOYEN', media: null, mediaSuggestion: null, aVerifier: false })

export default function QuizStudio() {
  const { id } = useParams()
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [ecran, setEcran] = useState(id ? 'chargement' : 'demande')
  const [ia, setIa] = useState(null)
  const [demande, setDemande] = useState(location.state?.demande ?? '')
  const [nb, setNb] = useState(10)
  const [contexte, setContexte] = useState('')
  const [avecContexte, setAvecContexte] = useState(false)
  const [erreur, setErreur] = useState(null)   // { message, code }
  const [etape, setEtape] = useState(0)

  const [quiz, setQuiz] = useState(null)       // { titre, description, emoji, origine, questions[] }
  const [ouverte, setOuverte] = useState(null) // index de la question en cours d'édition
  const [info, setInfo] = useState('')
  const [saving, setSaving] = useState(null)   // 'save' | 'play'
  const [erreurSave, setErreurSave] = useState(null)
  const [lancer, setLancer] = useState(null)   // résumé du quiz enregistré → feuille de lancement
  const [mediaPour, setMediaPour] = useState(null)

  // État de l'IA + reprise d'un brouillon non enregistré (une génération coûte
  // un crédit : on ne la perd pas sur un rechargement de page).
  useEffect(() => {
    apiFetch('/quiz/ia/etat').then(r => (r?.ok ? r.json() : null)).then(setIa).catch(() => {})
    if (id) {
      apiFetch(`/quiz/${id}`).then(async r => {
        if (!r?.ok) { navigate('/dashboard', { replace: true }); return }
        const q = await r.json()
        setQuiz({ titre: q.titre, description: q.description ?? '', emoji: q.emoji ?? '🎯', origine: q.origine, questions: q.questions })
        setEcran('relecture')
      })
      return
    }
    try {
      const b = JSON.parse(sessionStorage.getItem(BROUILLON) ?? 'null')
      if (b?.questions?.length && !location.state?.demande) { setQuiz(b); setEcran('relecture'); setInfo('Brouillon retrouvé : il n\'est pas encore enregistré.') }
    } catch { /* stockage indisponible : on repart d'une page blanche */ }
  }, [id])

  const enregistre = useRef(false) // une fois enregistré, ce n'est plus un brouillon
  useEffect(() => {
    if (id || !quiz || enregistre.current) return
    try { sessionStorage.setItem(BROUILLON, JSON.stringify(quiz)) } catch { /* idem */ }
  }, [quiz, id])

  useEffect(() => {
    if (ecran !== 'creation') return
    setEtape(0)
    const t = setInterval(() => setEtape(e => Math.min(e + 1, ETAPES.length - 1)), 6000)
    return () => clearInterval(t)
  }, [ecran])

  const max = ia?.questionsMax ?? 10
  const tailles = TAILLES.filter(t => t <= max)
  const epuise = ia && ia.disponible && ia.restantes !== null && ia.restantes <= 0
  const peutGenerer = ia?.disponible && !epuise

  async function generer(e) {
    e?.preventDefault()
    if (demande.trim().length < 10) { setErreur({ message: 'Décris ton quiz en quelques mots de plus.' }); return }
    setErreur(null); setEcran('creation')
    const res = await apiFetch('/quiz/ia/generer', {
      method: 'POST',
      body: { demande: demande.trim(), nbQuestions: Math.min(nb, max), contexte: avecContexte ? contexte : '' },
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) {
      if (data?.etat) setIa(data.etat)
      setErreur({ message: data?.error ?? 'La création n\'a pas abouti. Réessaie dans un instant.', code: data?.code })
      setEcran('demande'); return
    }
    setIa(data.etat)
    setQuiz(data.brouillon)
    setInfo(data.ecartees > 0
      ? `${data.brouillon.questions.length} questions prêtes. ${data.ecartees} proposition${data.ecartees > 1 ? 's' : ''} non conforme${data.ecartees > 1 ? 's' : ''} écartée${data.ecartees > 1 ? 's' : ''} automatiquement.`
      : `${data.brouillon.questions.length} questions prêtes. Relis-les avant de jouer.`)
    setOuverte(null); setEcran('relecture')
  }

  function aLaMain() {
    setQuiz({ titre: '', description: '', emoji: '🎯', origine: 'MANUEL', questions: [vide()] })
    setOuverte(0); setInfo(''); setEcran('relecture')
  }

  const majQ = (i, patch) => setQuiz(q => ({ ...q, questions: q.questions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  const suppr = (i) => { setQuiz(q => ({ ...q, questions: q.questions.filter((_, j) => j !== i) })); setOuverte(null) }
  const bouger = (i, d) => setQuiz(q => {
    const a = [...q.questions]; const j = i + d
    if (j < 0 || j >= a.length) return q
    ;[a[i], a[j]] = [a[j], a[i]]
    return { ...q, questions: a }
  })
  const ajouter = () => { setQuiz(q => ({ ...q, questions: [...q.questions, vide()] })); setOuverte(quiz.questions.length) }

  async function enregistrer(puisJouer) {
    setErreurSave(null)
    if (!quiz.titre.trim()) { setErreurSave({ message: 'Donne un titre à ton quiz.' }); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSaving(puisJouer ? 'play' : 'save')
    const body = { ...quiz, questions: quiz.questions.map(q => ({ ...q, choix: q.mecanique === 'QCM' ? q.choix.filter(c => c.trim()) : [] })) }
    const res = await apiFetch(id ? `/quiz/${id}` : '/quiz', { method: id ? 'PUT' : 'POST', body }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setSaving(null)
    if (!res?.ok) {
      setErreurSave({ message: data?.error ?? 'Enregistrement impossible.', code: data?.code })
      if (Number.isInteger(data?.index)) setOuverte(data.index)
      return
    }
    enregistre.current = true
    try { sessionStorage.removeItem(BROUILLON) } catch { /* rien */ }
    if (puisJouer) setLancer(data)
    else navigate('/dashboard')
  }

  // ── Écran 1 : la demande ───────────────────────────────────────────────────
  if (ecran === 'demande') {
    return (
      <Layout maxWidth="max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text)' }}>Quel quiz veux-tu ?</h1>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Écris-le comme tu le dirais à un ami. Tu pourras tout corriger ensuite.
        </p>

        {ia && !ia.disponible && (
          <Bandeau icon={AlertTriangle}>
            La création par IA n'est pas encore activée sur cette plateforme. Tu peux déjà écrire ton quiz à la main.
          </Bandeau>
        )}
        {epuise && (
          <div className="card p-5 mb-4 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(255,194,61,0.3)' }}>
              <Crown size={22} style={{ color: '#C98A00' }} />
            </div>
            <p className="font-display font-bold" style={{ color: 'var(--text)' }}>
              {ia.mode === 'essai' ? 'Tu as utilisé ton essai offert' : 'Quota du mois atteint'}
            </p>
            <p className="text-sm mt-1 mb-3" style={{ color: 'var(--text-muted)' }}>
              {ia.mode === 'essai'
                ? 'Avec Premium, crée jusqu\'à 30 quiz par mois avec l\'IA, jusqu\'à 30 questions chacun.'
                : `Tes ${ia.quota} créations par IA reviennent le 1er du mois.`}
            </p>
            {ia.mode === 'essai' && <Link to="/abonnement" className="btn-primary"><Crown size={15} />Découvrir Premium</Link>}
          </div>
        )}

        <form onSubmit={generer} className="card p-4 sm:p-5">
          <textarea value={demande} onChange={e => setDemande(e.target.value)} rows={3} maxLength={600} autoFocus
            aria-label="Décris ton quiz" disabled={!peutGenerer}
            placeholder="Ex. : un quiz de 15 questions sur l'actualité musicale ivoirienne"
            className="input text-base resize-none" style={{ lineHeight: 1.5 }} />

          <div className="scroll-x mt-3 -mx-1 px-1">
            {EXEMPLES.map(x => (
              <button key={x.t} type="button" disabled={!peutGenerer} onClick={() => setDemande(x.t)} className="chip text-xs"
                title={x.t}><span aria-hidden="true">{x.icon}</span>{x.l}</button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Questions</span>
            {tailles.map(t => (
              <button key={t} type="button" onClick={() => setNb(t)} className={`chip ${nb === t ? 'chip-on' : ''}`} style={{ padding: '0.3rem 0.75rem' }}>{t}</button>
            ))}
            {ia?.mode === 'essai' && <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>Jusqu'à 30 avec Premium</span>}
          </div>

          <button type="button" onClick={() => setAvecContexte(v => !v)} aria-expanded={avecContexte}
            className="flex items-center gap-2 mt-4 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Building2 size={15} />Un quiz sur ton entreprise, ton école, ton événement ?
            <ChevronDown size={15} style={{ transform: avecContexte ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {avecContexte && (
            <div className="mt-2 animate-fadeUp">
              <textarea value={contexte} onChange={e => setContexte(e.target.value)} rows={5} maxLength={6000}
                aria-label="Informations à utiliser pour le quiz"
                placeholder="Colle ici ce que les questions doivent couvrir : histoire de l'entreprise, valeurs, produits, chiffres clés, programme du cours…"
                className="input text-sm resize-y" />
              <p className="text-2xs mt-1" style={{ color: 'var(--text-dim)' }}>
                Ce texte est envoyé à notre fournisseur d'IA pour écrire les questions. N'y mets pas de données personnelles ou confidentielles.
              </p>
            </div>
          )}

          {erreur && (
            <p className="text-sm mt-3 px-3 py-2 rounded-xl flex items-start gap-2" role="alert" style={{ background: 'rgba(239,68,68,0.1)', color: '#C0392B' }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />{erreur.message}
            </p>
          )}

          <button type="submit" disabled={!peutGenerer || demande.trim().length < 3} className="btn-primary btn-xl w-full mt-4">
            <Sparkles size={18} />Créer mon quiz
          </button>
          {ia?.disponible && !epuise && ia.restantes !== null && (
            <p className="text-2xs text-center mt-2" style={{ color: 'var(--text-dim)' }}>
              {ia.mode === 'essai' ? `${ia.restantes} création offerte pour essayer` : `${ia.restantes} création${ia.restantes > 1 ? 's' : ''} restante${ia.restantes > 1 ? 's' : ''} ce mois-ci`}
            </p>
          )}
        </form>

        <button onClick={aLaMain} className="btn-ghost w-full mt-3"><PencilLine size={15} />Écrire mes questions moi-même</button>
      </Layout>
    )
  }

  // ── Écran 2 : la création ──────────────────────────────────────────────────
  if (ecran === 'creation' || ecran === 'chargement') {
    return (
      <Layout maxWidth="max-w-2xl">
        <div className="flex flex-col items-center text-center py-16" role="status" aria-live="polite">
          <div className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse_glow" style={{ background: 'var(--brand-soft)' }}>
            <Wand2 size={34} style={{ color: 'var(--brand)' }} />
          </div>
          {ecran === 'creation' ? (
            <>
              <h1 className="text-xl font-extrabold mt-5" style={{ color: 'var(--text)' }}>{ETAPES[etape]}</h1>
              <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                Compte une petite minute. Reste sur cette page : ton quiz arrive.
              </p>
              <p className="text-xs mt-4 px-3 py-2 rounded-xl max-w-sm line-clamp-3" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }}>« {demande.trim()} »</p>
            </>
          ) : <Loader2 size={20} className="animate-spin mt-5" style={{ color: 'var(--text-dim)' }} />}
        </div>
      </Layout>
    )
  }

  // ── Écran 3 : la relecture ─────────────────────────────────────────────────
  const aVerifier = quiz.questions.filter(q => q.aVerifier).length
  return (
    <Layout maxWidth="max-w-2xl">
      <button onClick={() => (id ? navigate('/dashboard') : (setEcran('demande'), setQuiz(null), sessionStorage.removeItem(BROUILLON)))}
        className="btn-ghost btn-sm -ml-2 mb-2"><ArrowLeft size={14} />{id ? 'Retour' : 'Recommencer'}</button>

      <div className="card p-4 mb-3">
        <div className="flex gap-3">
          <input value={quiz.emoji} onChange={e => setQuiz(q => ({ ...q, emoji: [...e.target.value].slice(-2).join('') }))}
            aria-label="Emoji du quiz" className="input text-2xl text-center shrink-0" style={{ width: 58, padding: '0.35rem' }} />
          <input value={quiz.titre} onChange={e => setQuiz(q => ({ ...q, titre: e.target.value }))} maxLength={80}
            aria-label="Titre du quiz" placeholder="Titre du quiz" className="input font-display text-lg font-bold" />
        </div>
        <input value={quiz.description} onChange={e => setQuiz(q => ({ ...q, description: e.target.value }))} maxLength={200}
          aria-label="Description" placeholder="Une phrase pour donner envie (facultatif)" className="input text-sm mt-2" />
      </div>

      {info && <Bandeau icon={quiz.origine === 'IA' ? Sparkles : Check}>{info}</Bandeau>}
      {aVerifier > 0 && (
        <Bandeau icon={AlertTriangle} ton="alerte">
          {aVerifier} question{aVerifier > 1 ? 's' : ''} à vérifier : l'IA n'est pas sûre du fait, ou il a pu changer récemment.
        </Bandeau>
      )}
      {erreurSave && (
        <p className="text-sm mb-3 px-3 py-2 rounded-xl flex items-start gap-2" role="alert" style={{ background: 'rgba(239,68,68,0.1)', color: '#C0392B' }}>
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{erreurSave.message} {erreurSave.code === 'QUIZ_LIMITE' && <Link to="/abonnement" className="underline font-semibold">Voir Premium</Link>}</span>
        </p>
      )}

      <ol className="space-y-2">
        {quiz.questions.map((q, i) => (
          <li key={i} className="card overflow-hidden" style={q.aVerifier ? { borderColor: 'rgba(230,126,34,0.6)' } : undefined}>
            {ouverte === i ? (
              <Editeur q={q} n={i + 1} total={quiz.questions.length}
                onChange={p => majQ(i, p)} onClose={() => setOuverte(null)} onDelete={() => suppr(i)}
                onMove={d => { bouger(i, d); setOuverte(i + d) }} onMedia={() => setMediaPour(i)} />
            ) : (
              <button onClick={() => setOuverte(i)} className="w-full text-left p-3.5 flex gap-3 items-start" aria-label={`Modifier la question ${i + 1}`}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-text)' }}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: q.enonce ? 'var(--text)' : 'var(--text-dim)' }}>
                    {q.enonce || 'Nouvelle question…'}
                  </span>
                  <span className="flex items-center gap-2 flex-wrap mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="badge-done">{MECA[q.mecanique]}</span>
                    {q.reponse && <span className="flex items-center gap-1"><Check size={12} style={{ color: 'var(--leaf)' }} />{q.reponse}</span>}
                    {q.media && <MediaIcone type={q.media.type} />}
                    {q.aVerifier && <span className="flex items-center gap-1 font-semibold" style={{ color: '#D35400' }}><AlertTriangle size={12} />À vérifier</span>}
                  </span>
                </span>
                {q.media?.type === 'IMAGE' && <img src={q.media.thumbUrl ?? q.media.url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
              </button>
            )}
          </li>
        ))}
      </ol>

      <button onClick={ajouter} className="btn-secondary w-full mt-3"><Plus size={15} />Ajouter une question</button>

      {/* Actions — toujours sous le pouce */}
      <div className="sticky bottom-20 md:bottom-4 mt-5 p-2 flex gap-2 z-30"
        style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(92,52,20,0.18)' }}>
        <button onClick={() => enregistrer(false)} disabled={!!saving || quiz.questions.length === 0} className="btn-secondary btn-lg flex-1">
          {saving === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Enregistrer
        </button>
        <button onClick={() => enregistrer(true)} disabled={!!saving || quiz.questions.length === 0} className="btn-primary btn-lg flex-[1.4]">
          {saving === 'play' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}Enregistrer et jouer
        </button>
      </div>

      {mediaPour !== null && (
        <ChoixMedia apiFetch={apiFetch} suggestion={quiz.questions[mediaPour]?.mediaSuggestion}
          onClose={() => setMediaPour(null)}
          onPick={m => { majQ(mediaPour, { media: m, mediaSuggestion: null }); setMediaPour(null) }} />
      )}
      {lancer && <LaunchSheet pack={lancer} onClose={() => navigate('/dashboard')} onBlocked={() => navigate('/dashboard')} editable={false} />}
    </Layout>
  )
}

function Bandeau({ icon: Icon, children, ton }) {
  const alerte = ton === 'alerte'
  return (
    <p className="text-sm mb-3 px-3.5 py-2.5 rounded-xl flex items-start gap-2"
      style={{ background: alerte ? 'rgba(230,126,34,0.12)' : 'rgba(255,194,61,0.2)', color: 'var(--text)' }}>
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: alerte ? '#D35400' : '#C98A00' }} />{children}
    </p>
  )
}

function MediaIcone({ type }) {
  const I = type === 'AUDIO' ? Music : type === 'VIDEO' ? Video : ImageIcon
  return <span className="flex items-center gap-1"><I size={12} />{type === 'AUDIO' ? 'Son' : type === 'VIDEO' ? 'Vidéo' : 'Image'}</span>
}

// Édition d'une question : le strict nécessaire, rien à apprendre.
function Editeur({ q, n, total, onChange, onClose, onDelete, onMove, onMedia }) {
  const setChoix = (i, v) => {
    const base = [...q.choix, '', '', '', ''].slice(0, 4)
    const choix = base.map((c, j) => (j === i ? v : c))
    // La bonne réponse suit le texte du choix qu'on est en train de corriger.
    onChange({ choix, ...(base[i] !== '' && q.reponse === base[i] ? { reponse: v } : {}) })
  }
  const changerMeca = (m) => {
    if (m === q.mecanique) return
    if (m === 'QCM') onChange({ mecanique: m, choix: q.choix?.length ? q.choix : ['', '', '', ''], reponse: '' })
    else if (m === 'VRAI_FAUX') onChange({ mecanique: m, choix: [], reponse: 'Vrai' })
    else onChange({ mecanique: m, choix: [], reponse: q.mecanique === 'QCM' ? q.reponse : '' })
  }
  const choix = q.mecanique === 'QCM' ? [...q.choix, '', '', '', ''].slice(0, 4) : []

  return (
    <div className="p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: 'var(--brand-text)' }}>Question {n}</span>
        <div className="flex items-center gap-0.5">
          <IconBtn label="Monter" disabled={n === 1} onClick={() => onMove(-1)}><ArrowUp size={15} /></IconBtn>
          <IconBtn label="Descendre" disabled={n === total} onClick={() => onMove(1)}><ArrowDown size={15} /></IconBtn>
          <IconBtn label="Supprimer la question" onClick={onDelete} danger><Trash2 size={15} /></IconBtn>
          <IconBtn label="Replier" onClick={onClose}><Check size={16} /></IconBtn>
        </div>
      </div>

      <textarea value={q.enonce} onChange={e => onChange({ enonce: e.target.value })} rows={2} maxLength={300}
        aria-label="Énoncé" placeholder="Écris ta question…" className="input text-sm resize-none" />

      <div className="scroll-x mt-2">
        {Object.entries(MECA).map(([k, l]) => (
          <button key={k} onClick={() => changerMeca(k)} className={`chip text-xs ${q.mecanique === k ? 'chip-on' : ''}`} style={{ padding: '0.3rem 0.7rem' }}>{l}</button>
        ))}
      </div>

      {q.mecanique === 'QCM' && (
        <div className="mt-2 space-y-1.5">
          {choix.map((c, i) => {
            const bonne = c.trim() !== '' && c === q.reponse
            return (
              <div key={i} className="flex items-center gap-2">
                <button onClick={() => c.trim() && onChange({ choix, reponse: c })} aria-label={`Marquer « ${c || `choix ${i + 1}`} » comme bonne réponse`} aria-pressed={bonne}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: bonne ? 'var(--leaf)' : 'var(--input-bg)', color: bonne ? '#fff' : 'var(--text-dim)', border: `1.5px solid ${bonne ? 'var(--leaf)' : 'var(--border-strong)'}` }}>
                  <Check size={15} />
                </button>
                <input value={c} onChange={e => setChoix(i, e.target.value)} maxLength={80} aria-label={`Proposition ${i + 1}`}
                  placeholder={`Proposition ${i + 1}${i > 2 ? ' (facultative)' : ''}`} className="input text-sm" />
              </div>
            )
          })}
          <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Coche la bonne réponse.</p>
        </div>
      )}
      {q.mecanique === 'VRAI_FAUX' && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {['Vrai', 'Faux'].map(v => (
            <button key={v} onClick={() => onChange({ reponse: v })} aria-pressed={q.reponse === v} className="py-2.5 rounded-xl text-sm font-bold"
              style={{ background: q.reponse === v ? 'var(--leaf)' : 'var(--input-bg)', color: q.reponse === v ? '#fff' : 'var(--text-muted)' }}>{v}</button>
          ))}
        </div>
      )}
      {q.mecanique === 'REPONSE_LIBRE' && (
        <div className="mt-2">
          <input value={q.reponse} onChange={e => onChange({ reponse: e.target.value })} maxLength={40} aria-label="Bonne réponse"
            placeholder="La bonne réponse (courte : 1 à 4 mots)" className="input text-sm" />
          <p className="text-2xs mt-1" style={{ color: 'var(--text-dim)' }}>Dite au buzzer, ou tapée par les joueurs (les petites fautes sont tolérées).</p>
        </div>
      )}

      <input value={q.explication ?? ''} onChange={e => onChange({ explication: e.target.value })} maxLength={400}
        aria-label="Explication" placeholder="Le saviez-vous ? (affiché après la réponse — facultatif)" className="input text-sm mt-2" />

      {/* Média : indépendant du type de question */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {q.media ? (
          <>
            {q.media.type === 'IMAGE'
              ? <img src={q.media.thumbUrl ?? q.media.url} alt="" className="w-14 h-14 rounded-lg object-cover" />
              : <span className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: 'var(--input-bg)' }}><MediaIcone type={q.media.type} /></span>}
            <button onClick={onMedia} className="btn-secondary btn-sm">Changer</button>
            <button onClick={() => onChange({ media: null })} className="btn-ghost btn-sm">Retirer</button>
          </>
        ) : (
          <button onClick={onMedia} className="btn-secondary btn-sm"><ImageIcon size={13} />Ajouter une image, un son, une vidéo</button>
        )}
        {!q.media && q.mediaSuggestion && (
          <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>Idée de l'IA : {q.mediaSuggestion}</span>
        )}
      </div>

      {q.aVerifier && (
        <label className="flex items-center gap-2 mt-3 text-xs font-semibold" style={{ color: '#D35400' }}>
          <input type="checkbox" className="check" onChange={() => onChange({ aVerifier: false })} />J'ai vérifié cette question
        </label>
      )}
    </div>
  )
}

function IconBtn({ children, label, onClick, disabled, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30"
      style={{ color: danger ? '#C0392B' : 'var(--text-muted)' }}>{children}</button>
  )
}

// Recherche dans la médiathèque Gbairai (lecture seule).
function ChoixMedia({ apiFetch, suggestion, onPick, onClose }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [medias, setMedias] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const p = new URLSearchParams({ q, ...(type ? { type } : {}) })
      apiFetch(`/quiz/medias?${p}`).then(r => (r?.ok ? r.json() : { medias: [] })).then(d => setMedias(d.medias ?? []))
    }, 250)
    return () => clearTimeout(timer.current)
  }, [q, type])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Choisir un média"
      style={{ background: 'rgba(43,26,16,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl animate-slideUp sm:animate-pop"
        style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Médiathèque</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }} aria-label="Fermer"><X size={16} /></button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Chercher : drapeau, attiéké, Ghana…" aria-label="Rechercher un média" className="input pl-9" />
          </div>
          <div className="scroll-x mt-2">
            {[['', 'Tout'], ['IMAGE', 'Images'], ['AUDIO', 'Sons'], ['VIDEO', 'Vidéos']].map(([v, l]) => (
              <button key={v} onClick={() => setType(v)} className={`chip text-xs ${type === v ? 'chip-on' : ''}`} style={{ padding: '0.3rem 0.7rem' }}>{l}</button>
            ))}
          </div>
          {suggestion && <p className="text-2xs mt-2" style={{ color: 'var(--text-muted)' }}>Idée de l'IA : {suggestion}</p>}
        </div>
        <div className="p-4 pt-2 overflow-y-auto">
          {medias === null ? (
            <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-dim)' }} /></div>
          ) : medias.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Rien dans la médiathèque pour cette recherche. La question reste jouable sans média.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {medias.map(m => (
                <button key={m.id} onClick={() => onPick(m)} className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--input-bg)' }}>
                  {m.type === 'IMAGE' || m.thumbUrl
                    ? <img src={m.thumbUrl ?? m.url} alt={m.titre ?? ''} loading="lazy" className="w-full aspect-square object-cover" />
                    : <span className="w-full aspect-square flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><MediaIcone type={m.type} /></span>}
                  <span className="block text-2xs px-1.5 py-1 truncate" style={{ color: 'var(--text-muted)' }}>{m.titre ?? '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
