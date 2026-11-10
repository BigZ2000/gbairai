import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import LaunchSheet, { tint } from '../components/LaunchSheet.jsx'
import {
  ArrowRight, AlertCircle, Loader2, Play, X, Zap, Clock, Search, Star, Lock, Crown,
  Gauge, Wand2, Sparkles, Radio, Plus, SlidersHorizontal, Building2,
} from 'lucide-react'

// Accueil : tout ce qu'on vient faire tient en trois gestes, dans cet ordre.
//   1. rejoindre une partie (un code)      2. créer son quiz (une phrase)
//   3. choisir un pack prêt à jouer (un clic)
// Le reste (quotas, buzzers, réglages) est présent mais ne réclame pas l'attention.
const IDEES = [
  'Un quiz de 15 questions sur la musique ivoirienne',
  'Un team building pour 20 collègues sur la cohésion d\'équipe',
  'Culture générale pour une soirée au maquis',
]

export default function Dashboard() {
  const { user, apiFetch } = useAuth()
  const navigate = useNavigate()

  const [packs, setPacks] = useState([])
  const [signatures, setSignatures] = useState([])
  const [parties, setParties] = useState([])
  const [buzzers, setBuzzers] = useState([])
  const [mesQuiz, setMesQuiz] = useState([])
  const [ia, setIa] = useState(null)
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [idee, setIdee] = useState('')

  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')           // '' = tout
  const [selected, setSelected] = useState(null) // { pack, editable }
  const [paywall, setPaywall] = useState(null)

  useEffect(() => {
    const json = (p, fallback) => apiFetch(p).then(r => (r?.ok ? r.json() : fallback)).catch(() => fallback)
    Promise.all([
      json('/packs', {}), json('/parties', []), json('/buzzers', []),
      json('/billing/me', null), json('/quiz', { quiz: [] }), json('/quiz/ia/etat', null),
    ]).then(([c, p, b, q, mq, etat]) => {
      setPacks(c?.packs ?? []); setSignatures(c?.signatures ?? [])
      setParties(Array.isArray(p) ? p : []); setBuzzers(Array.isArray(b) ? b : [])
      setQuota(q); setMesQuiz(mq?.quiz ?? []); setIa(etat)
    }).finally(() => setLoading(false))
  }, [])

  const enCours = parties.filter(p => p.status === 'EN_ATTENTE' || p.status === 'EN_COURS')
  const catalogue = useMemo(() => [...packs, ...signatures].sort((a, b) => b.priorite - a.priorite), [packs, signatures])
  const categories = useMemo(() => [...new Set(catalogue.map(p => p.categorie).filter(Boolean))].sort(), [catalogue])
  const vedettes = useMemo(() => catalogue.filter(p => p.vedette || p.signature).slice(0, 8), [catalogue])

  const filtre = search.trim() || cat
  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalogue.filter(p => {
      if (cat && p.categorie !== cat) return false
      if (!q) return true
      return [p.nom, p.description, p.categorie, ...(p.tags ?? [])].join(' ').toLowerCase().includes(q)
    })
  }, [catalogue, search, cat])

  async function handleJoin(e) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinError(''); setJoinLoading(true)
    try {
      const checkRes = await apiFetch(`/parties/check/${code}`)
      if (!checkRes?.ok) {
        const err = await checkRes?.json().catch(() => ({}))
        setJoinError(err?.error ?? 'Code invalide'); return
      }
      const info = await checkRes.json()
      const joinRes = await apiFetch('/parties/join', { method: 'POST', body: { code } })
      if (!joinRes?.ok) {
        const err = await joinRes?.json().catch(() => ({}))
        setJoinError(err?.error ?? 'Impossible de rejoindre'); return
      }
      navigate(info.status === 'EN_COURS' ? `/parties/${code}/jeu` : `/parties/${code}/attente`)
    } catch {
      setJoinError('Erreur de connexion')
    } finally {
      setJoinLoading(false)
    }
  }

  function pickPack(pack) {
    if (pack.verrouille) {
      setPaywall({ reason: `Ce pack fait partie de l'offre ${pack.requiredPlan === 'PRO' ? 'Premium' : pack.requiredPlan === 'ECOLE' ? 'École' : 'Organisation'}.` })
      return
    }
    setSelected({ pack, editable: false })
  }

  function onBlocked(err) {
    setSelected(null)
    setPaywall({ reason: err?.error ?? 'Action indisponible.', quota: err?.code === 'QUOTA_PARTIES' })
  }

  function creer(e) {
    e?.preventDefault()
    navigate('/quiz/nouveau', { state: { demande: idee.trim() } })
  }

  const prenom = user?.prenom || (user?.username ? `@${user.username}` : '')
  const heure = new Date().getHours()
  const salut = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <Layout maxWidth="max-w-6xl">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-5" style={{ color: 'var(--text)' }}>
        {salut}{prenom ? `, ${prenom}` : ''} <span aria-hidden="true">👋</span>
      </h1>

      {/* 1 + 2 — Rejoindre / Créer */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
        <form onSubmit={handleJoin} className="card p-4 sm:p-5 md:col-span-2 flex flex-col min-w-0">
          <p className="font-display font-bold text-base flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Zap size={17} style={{ color: 'var(--brand)' }} />Tu as un code ?
          </p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>Rejoins la partie d'un ami ou d'un animateur.</p>
          <div className="flex gap-2 mt-auto">
            <input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" aria-label="Code de la partie"
              placeholder="QUIZ42" value={joinCode} maxLength={8}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
              className={`input min-w-0 font-mono text-lg tracking-[0.25em] uppercase text-center ${joinError ? 'input-error' : ''}`} />
            <button type="submit" disabled={joinLoading || !joinCode.trim()} className="btn-primary btn-lg shrink-0">
              {joinLoading ? <Loader2 size={16} className="animate-spin" /> : <>Rejoindre<ArrowRight size={15} /></>}
            </button>
          </div>
          {joinError && (
            <p className="flex items-center gap-1.5 mt-2 text-sm" role="alert" style={{ color: '#C0392B' }}>
              <AlertCircle size={14} />{joinError}
            </p>
          )}
        </form>

        <form onSubmit={creer} className="panel-ink md:col-span-3 p-4 sm:p-5 flex flex-col min-w-0" style={{ borderRadius: 18 }}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold text-base flex items-center gap-2">
              <Wand2 size={17} style={{ color: 'var(--mango)' }} />Crée ton quiz en une phrase
            </p>
            <IaBadge ia={ia} />
          </div>
          <p className="text-xs mt-0.5 mb-3" style={{ opacity: 0.75 }}>
            Dis ce que tu veux, l'IA prépare les questions. Tu relis, tu joues.
          </p>
          <div className="flex gap-2 mt-auto">
            <input value={idee} onChange={e => setIdee(e.target.value)} maxLength={300} aria-label="Décris ton quiz"
              placeholder="Un quiz sur le football ivoirien…"
              className="flex-1 min-w-0 text-sm px-3.5 rounded-xl focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'inherit', border: '1px solid rgba(255,255,255,0.18)', height: 44 }} />
            <button type="submit" className="btn-primary btn-lg shrink-0"><Sparkles size={15} /><span className="hidden sm:inline">Créer</span></button>
          </div>
          <div className="scroll-x mt-2.5">
            {IDEES.map(t => (
              <button key={t} type="button" onClick={() => navigate('/quiz/nouveau', { state: { demande: t } })}
                className="text-2xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'inherit' }}>{t}</button>
            ))}
          </div>
        </form>
      </div>

      {/* Reprendre */}
      {enCours.length > 0 && (
        <section className="mb-8">
          <Titre>Reprendre</Titre>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enCours.map(p => (
              <Link key={p.id} to={`/parties/${p.code}/${p.status === 'EN_COURS' ? 'jeu' : 'attente'}`}
                className="card card-hover p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{p.nom}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    <span className="font-mono">{p.code}</span> · {p.participants?.length ?? 0} joueur{(p.participants?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={p.status === 'EN_COURS' ? 'badge-active' : 'badge-wait'}>
                  {p.status === 'EN_COURS' ? <><Zap size={10} />En cours</> : <><Clock size={10} />En attente</>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Mes quiz */}
      {mesQuiz.length > 0 && (
        <section className="mb-8">
          <Titre action={<Link to="/quiz/nouveau" className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--brand-text)' }}><Plus size={14} />Nouveau</Link>}>
            Mes quiz
          </Titre>
          <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            {mesQuiz.map(q => (
              <button key={q.id} onClick={() => setSelected({ pack: q, editable: true })}
                className="card card-hover shrink-0 w-60 p-4 text-left">
                <div className="flex items-start justify-between">
                  <span className="text-3xl" aria-hidden="true">{q.emoji ?? '🎯'}</span>
                  {q.origine === 'IA' && <span className="badge-ia"><Sparkles size={9} />IA</span>}
                </div>
                <p className="font-bold text-sm mt-2 line-clamp-2" style={{ color: 'var(--text)' }}>{q.nom}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                  {q.nbQuestions} question{q.nbQuestions > 1 ? 's' : ''}{q.lancements > 0 ? ` · joué ${q.lancements} fois` : ''}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3 — Catalogue */}
      <section className="mb-8">
        <Titre action={<Link to="/parties/new" className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><SlidersHorizontal size={14} />Sur mesure</Link>}>
          Prêts à jouer
        </Titre>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Rechercher un pack"
            placeholder="Football, musique, drapeaux, Abidjan…" className="input pl-10 pr-10" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full"
              style={{ color: 'var(--text-muted)' }} aria-label="Effacer la recherche"><X size={15} /></button>
          )}
        </div>
        <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
          <button onClick={() => setCat('')} className={`chip ${cat === '' ? 'chip-on' : ''}`}>Tout</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`chip ${cat === c ? 'chip-on' : ''}`}>{c}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-36" style={{ borderRadius: 18 }} />)}
          </div>
        ) : (
          <>
            {!filtre && vedettes.length > 0 && (
              <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 pb-1">
                {vedettes.map(p => <PackVedette key={p.id} pack={p} onPick={pickPack} />)}
              </div>
            )}
            {visibles.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun pack pour cette recherche.</p>
                <button onClick={() => navigate('/quiz/nouveau', { state: { demande: search.trim() } })} className="btn-primary mt-3">
                  <Wand2 size={15} />Créer ce quiz avec l'IA
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibles.map(p => <PackCard key={p.id} pack={p} onPick={pickPack} />)}
              </div>
            )}
          </>
        )}
      </section>

      {/* Bas de page : état du compte, sans bruit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quota && <QuotaCard quota={quota} />}
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--brand-soft)' }}>
            <Radio size={18} style={{ color: 'var(--brand-text)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {buzzers.length === 0 ? 'Buzzers physiques' : `${buzzers.filter(b => b.status !== 'OFFLINE').length} / ${buzzers.length} buzzer${buzzers.length > 1 ? 's' : ''} en ligne`}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {buzzers.length === 0 ? 'Le téléphone suffit. Les vrais buzzers, c\'est pour le spectacle.' : 'Ils se connectent tout seuls à ta prochaine partie.'}
            </p>
          </div>
          <Link to={buzzers.length === 0 ? '/buzzer' : '/compte'} state={{ tab: 'buzzers' }} className="btn-secondary btn-sm shrink-0">
            {buzzers.length === 0 ? 'Découvrir' : 'Gérer'}
          </Link>
        </div>
      </div>

      {selected && (
        <LaunchSheet pack={selected.pack} editable={selected.editable}
          onClose={() => setSelected(null)} onBlocked={onBlocked} />
      )}

      {paywall && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" role="dialog" aria-modal="true"
          style={{ background: 'rgba(43,26,16,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setPaywall(null)}>
          <div className="card p-6 max-w-sm w-full text-center animate-pop" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(255,194,61,0.28)' }}>
              {paywall.quota ? <Gauge size={26} style={{ color: '#C98A00' }} /> : <Lock size={24} style={{ color: '#C98A00' }} />}
            </div>
            <h3 className="text-lg font-extrabold mb-1.5" style={{ color: 'var(--text)' }}>
              {paywall.quota ? 'Tu as fait le plein ce mois-ci 🎉' : 'Réservé à une offre'}
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{paywall.reason}</p>
            <div className="flex flex-col gap-2">
              <Link to="/abonnement" className="btn-primary w-full"><Crown size={15} />Voir les offres</Link>
              <button onClick={() => setPaywall(null)} className="btn-ghost w-full">
                {paywall.quota ? 'Continuer en solo (illimité)' : 'Plus tard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Titre({ children, action }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{children}</h2>
      {action}
    </div>
  )
}

// Ce que l'utilisateur peut attendre de l'IA, dit honnêtement selon son état réel.
function IaBadge({ ia }) {
  if (!ia) return null
  const style = { background: 'rgba(255,194,61,0.95)', color: '#2B1A10' }
  let texte
  if (!ia.disponible) texte = 'Bientôt'
  else if (ia.mode === 'illimite') texte = 'Illimité'
  else if (ia.mode === 'essai') texte = ia.restantes > 0 ? `${ia.restantes} essai offert` : 'Premium'
  else texte = `${ia.restantes} ce mois`
  return <span className="badge shrink-0" style={style}><Crown size={10} />{texte}</span>
}

function PackCard({ pack, onPick }) {
  const n = (pack.nbManches ?? 1) * (pack.nbQuestions ?? 0)
  return (
    <button onClick={() => onPick(pack)} className="card card-hover text-left overflow-hidden flex flex-col">
      <div className="h-20 flex items-center justify-center relative" style={{ background: tint(pack.couleur, 0.16) }}>
        <span className="text-4xl" aria-hidden="true">{pack.emoji ?? '🎯'}</span>
        {pack.verrouille && (
          <span className="absolute top-2 right-2 badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
            <Lock size={9} />{pack.tier === 'PREMIUM' || pack.tier === 'EVENEMENT' ? 'Premium' : pack.tier === 'ECOLE' ? 'École' : 'Pro'}
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="font-bold text-sm leading-snug" style={{ color: 'var(--text)' }}>{pack.nom}</p>
        <p className="text-xs mt-1 line-clamp-2 flex-1" style={{ color: 'var(--text-muted)' }}>{pack.description}</p>
        <p className="text-2xs font-semibold mt-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
          <span>{n} questions</span>
          {pack.nbAvis > 0 && <span className="flex items-center gap-0.5"><Star size={10} style={{ color: 'var(--mango)', fill: 'var(--mango)' }} />{pack.noteMoyenne}</span>}
        </p>
      </div>
    </button>
  )
}

function PackVedette({ pack, onPick }) {
  return (
    <button onClick={() => onPick(pack)}
      className="shrink-0 w-64 sm:w-72 h-32 p-4 text-left flex flex-col justify-between relative overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: pack.couleur ?? 'var(--brand)', borderRadius: 18, color: '#fff' }}>
      <span className="absolute -right-3 -bottom-5 text-8xl opacity-25 select-none" aria-hidden="true">{pack.emoji}</span>
      <span className="badge self-start" style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}>
        {pack.signature ? 'Signature' : 'À la une'}
      </span>
      <div className="relative">
        <p className="font-display font-extrabold text-lg leading-tight">{pack.nom}</p>
        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ opacity: 0.9 }}><Play size={11} fill="currentColor" />Jouer</p>
      </div>
    </button>
  )
}

// Plan + parties à plusieurs du mois. Le solo n'est jamais décompté.
function QuotaCard({ quota }) {
  const org = quota.organisation
  const illimite = quota.limites.partiesParMois == null
  const used = quota.usage.partiesCeMois
  const max = quota.limites.partiesParMois
  const pct = org ? Math.round((org.siegesUtilises / Math.max(1, org.sieges)) * 100) : illimite ? 100 : Math.min(100, Math.round((used / max) * 100))
  const proche = !org && !illimite && used / max >= 0.8
  const Icon = org ? Building2 : Crown
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,194,61,0.28)' }}>
        <Icon size={18} style={{ color: '#C98A00' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
          {org ? org.nom : quota.plan === 'FREE' ? 'Offre gratuite' : `Offre ${quota.plan === 'PRO' ? 'Premium' : quota.planNom}`}
        </p>
        <p className="text-xs" style={{ color: proche ? '#C0392B' : 'var(--text-muted)' }}>
          {org ? `${org.siegesUtilises} / ${org.sieges} membres`
            : illimite ? 'Parties à plusieurs illimitées'
            : `${used} / ${max} parties à plusieurs ce mois · solo illimité`}
        </p>
        <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--hover-overlay)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: proche ? '#E67E22' : 'var(--leaf)' }} />
        </div>
      </div>
      <Link to={org ? '/organisation' : '/abonnement'} className="btn-secondary btn-sm shrink-0">{org ? 'Gérer' : 'Offres'}</Link>
    </div>
  )
}
