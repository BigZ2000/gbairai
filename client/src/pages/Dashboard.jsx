import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  ArrowRight, Sliders, Wifi, WifiOff, Radio, AlertCircle,
  Loader2, Play, X, Zap, Target, Trophy, Clock, Gamepad2, Sparkles,
  Search, Star, Flame, Clock3, ThumbsUp, SlidersHorizontal, Lock, Crown, Gauge,
} from 'lucide-react'

const GAMEMODES = [
  { id: 'animateur', label: 'Animateur', emoji: '🎤', desc: 'Tu présentes et valides les réponses.', icon: Target },
  { id: 'auto',      label: 'Automatique', emoji: '🤖', desc: 'Le jeu se déroule tout seul.', icon: Zap },
  { id: 'vote',      label: 'Vote collectif', emoji: '🗳️', desc: 'Tout le monde vote la bonne réponse.', icon: Trophy },
]

const DIFFICULTES = [['FACILE', 'Facile'], ['MOYEN', 'Moyen'], ['DIFFICILE', 'Difficile'], ['MIXTE', 'Mixte']]
const DUREES = [['RAPIDE', 'Rapide'], ['STANDARD', 'Standard'], ['LONGUE', 'Longue']]

export default function Dashboard() {
  const { user, apiFetch } = useAuth()
  const navigate = useNavigate()

  const [packs, setPacks] = useState([])
  const [signatures, setSignatures] = useState([])
  const [parties, setParties] = useState([])
  const [buzzers, setBuzzers] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState(null)
  const [launching, setLaunching] = useState(null)
  const [animateurJoue, setAnimateurJoue] = useState(false)
  const [modeDistanciel, setModeDistanciel] = useState(false) // D5/A4 : jeu en ligne
  const [quota, setQuota] = useState(null)
  const [paywall, setPaywall] = useState(null) // { reason, requiredPlan } | null

  // Recherche & filtres
  const [search, setSearch] = useState('')
  const [fCat, setFCat] = useState('')
  const [fDiff, setFDiff] = useState('')
  const [fDuree, setFDuree] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch('/packs').then(r => r?.json()).catch(() => ({})),
      apiFetch('/parties').then(r => r?.json()).catch(() => []),
      apiFetch('/buzzers').then(r => r?.json()).catch(() => []),
      apiFetch('/billing/me').then(r => r?.json()).catch(() => null),
    ]).then(([cat, p, b, q]) => {
      setPacks(cat?.packs ?? [])
      setSignatures(cat?.signatures ?? [])
      setParties(Array.isArray(p) ? p : [])
      setBuzzers(Array.isArray(b) ? b : [])
      setQuota(q)
    }).finally(() => setLoading(false))
  }, [])

  const enCours = parties.filter(p => p.status === 'EN_ATTENTE' || p.status === 'EN_COURS')

  // Catalogue complet (packs + signatures) pour recherche/filtres.
  const catalogue = useMemo(() => [...packs, ...signatures], [packs, signatures])

  // Liste des catégories présentes dans les données (pour le filtre).
  const categories = useMemo(() => {
    const set = new Set()
    catalogue.forEach(p => { if (p.categorie) set.add(p.categorie) })
    return [...set].sort()
  }, [catalogue])

  const hasFilter = search.trim() || fCat || fDiff || fDuree

  // Résultats filtrés (quand recherche/filtre actif).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalogue.filter(p => {
      if (fCat && p.categorie !== fCat) return false
      if (fDiff && p.difficulte !== fDiff) return false
      if (fDuree && p.duree !== fDuree) return false
      if (q) {
        const hay = [p.nom, p.description, p.categorie, ...(p.tags ?? [])].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => b.priorite - a.priorite)
  }, [catalogue, search, fCat, fDiff, fDuree])

  // Sections curatées (quand aucun filtre).
  const vedettes   = useMemo(() => packs.filter(p => p.vedette).sort((a, b) => b.priorite - a.priorite), [packs])
  const nouveautes = useMemo(() => [...packs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8), [packs])
  const populaires = useMemo(() => packs.filter(p => p.lancements > 0).sort((a, b) => b.lancements - a.lancements).slice(0, 8), [packs])
  const recommandes = useMemo(() => packs.filter(p => !p.vedette).sort((a, b) => b.priorite - a.priorite).slice(0, 8), [packs])

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

  // Ouvre la modale de lancement OU le paywall si le pack est verrouillé.
  function pickPack(pack) {
    if (pack.verrouille) {
      setPaywall({ reason: `Ce pack nécessite un abonnement ${pack.requiredPlan === 'PRO' ? 'Pro' : pack.requiredPlan}.`, requiredPlan: pack.requiredPlan })
      return
    }
    setSelectedPack(pack)
  }

  async function launchPack(packId, gameMode) {
    setLaunching(packId)
    try {
      const res = await apiFetch(`/packs/${packId}/start`, { method: 'POST', body: { gameMode, animateurJoue: gameMode === 'animateur' ? animateurJoue : false, modeDistanciel } })
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}))
        setLaunching(null); setSelectedPack(null)
        // 403 = accès refusé (plan) ; 402 = quota atteint.
        setPaywall({
          reason: err?.error ?? 'Action indisponible.',
          requiredPlan: err?.requiredPlan ?? (err?.code === 'QUOTA_PARTIES' ? 'PRO' : null),
          quota: err?.code === 'QUOTA_PARTIES',
        })
        return
      }
      const partie = await res.json()
      navigate(`/parties/${partie.code}/attente`)
    } catch {
      setLaunching(null)
    }
  }

  const greeting = new Date().getHours() < 12 ? 'Bonjour' : 'Bonsoir'
  const displayName = user?.username ? `@${user.username}` : user?.prenom
  const onlineBuzzers = buzzers.filter(b => b.status !== 'OFFLINE').length

  return (
    <Layout maxWidth="max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>{greeting} 👋</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{displayName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg"
            style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
            {onlineBuzzers > 0 ? <Wifi size={13} style={{ color: '#22C55E' }} /> : <WifiOff size={13} style={{ color: 'var(--text-dim)' }} />}
            <span className="text-xs font-medium" style={{ color: onlineBuzzers > 0 ? '#22C55E' : 'var(--text-dim)' }}>
              {onlineBuzzers}/{buzzers.length} buzzer{buzzers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Link to="/parties/new" className="btn-secondary btn-lg gap-2">
            <Sliders size={15} />
            <span className="hidden sm:inline">Partie personnalisée</span>
          </Link>
        </div>
      </div>

      {/* Join bar */}
      <form onSubmit={handleJoin} className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="On t'a donné un code ? Rejoins une partie — ex : QUIZ42"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
            maxLength={8}
            className="input font-mono tracking-widest uppercase"
          />
          {joinError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-sm absolute" style={{ color: '#F87171' }}>
              <AlertCircle size={13} />{joinError}
            </div>
          )}
        </div>
        <button type="submit" disabled={joinLoading || !joinCode.trim()} className="btn-primary btn-lg shrink-0">
          {joinLoading ? <Loader2 size={15} className="animate-spin" /> : <>Rejoindre <ArrowRight size={14} /></>}
        </button>
      </form>

      {/* Bandeau quotas / plan */}
      {quota && <QuotaBanner quota={quota} />}

      {/* Reprendre */}
      {enCours.length > 0 && (
        <section className="mb-9">
          <SectionTitle icon={Gamepad2} title="Reprendre" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enCours.map(p => (
              <Link key={p.id} to={`/parties/${p.code}/${p.status === 'EN_COURS' ? 'jeu' : 'attente'}`}
                className="card card-hover p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{p.nom}</p>
                  <p className="text-2xs mt-0.5 font-mono" style={{ color: 'var(--text-dim)' }}>
                    {p.code} · {p.participants?.length ?? 0} joueur{(p.participants?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={p.status === 'EN_COURS' ? 'badge-active' : 'badge-wait'}>
                  {p.status === 'EN_COURS' ? <><Zap size={9} />En cours</> : <><Clock size={9} />Attente</>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recherche + filtres */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un pack… (football, musique, Abidjan…)"
            className="input w-full pl-10" />
          {hasFilter && (
            <button onClick={() => { setSearch(''); setFCat(''); setFDiff(''); setFDuree('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost btn-sm gap-1 text-2xs">
              <X size={12} />Réinitialiser
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <SlidersHorizontal size={14} style={{ color: 'var(--text-dim)' }} />
          <FilterChips value={fCat} onChange={setFCat} options={categories.map(c => [c, c])} placeholder="Catégorie" />
          <FilterChips value={fDiff} onChange={setFDiff} options={DIFFICULTES} placeholder="Difficulté" />
          <FilterChips value={fDuree} onChange={setFDuree} options={DUREES} placeholder="Durée" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      ) : hasFilter ? (
        /* Résultats de recherche / filtres */
        <section className="mb-9">
          <SectionTitle icon={Search} title={`Résultats (${filtered.length})`} />
          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <Search size={24} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Aucun pack ne correspond à ta recherche.</p>
            </div>
          ) : (
            <PackGrid packs={filtered} launching={launching} onPick={pickPack} />
          )}
        </section>
      ) : (
        <>
          {/* Vedettes */}
          {vedettes.length > 0 && (
            <Section icon={Star} title="À la une" subtitle="Nos packs vedettes du moment."
              packs={vedettes} launching={launching} onPick={pickPack} highlight />
          )}
          {/* Signature */}
          {signatures.length > 0 && (
            <section className="mb-9">
              <SectionTitle icon={Trophy} title="Signature Gbairai" subtitle="Prêtes à jouer en un clic." />
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {signatures.map(sig => (
                  <button key={sig.id} onClick={() => pickPack(sig)} disabled={launching === sig.id}
                    className="group relative shrink-0 w-56 text-left rounded-2xl p-4 h-28 flex flex-col justify-between overflow-hidden transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${hex(sig.couleur, 0.2)} 0%, rgba(20,20,24,0.7) 75%)`,
                      border: `1px solid ${hex(sig.couleur, 0.3)}`,
                    }}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{sig.emoji}</span>
                      {launching === sig.id
                        ? <Loader2 size={15} className="animate-spin" style={{ color: sig.couleur }} />
                        : <Play size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: sig.couleur }} />}
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>{sig.nom}</p>
                      <p className="text-2xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{sig.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
          {/* Tous les packs */}
          <Section icon={Sparkles} title="Choisis un pack et joue" subtitle="Les questions sont générées automatiquement."
            packs={packs} launching={launching} onPick={pickPack} />
          {/* Populaires */}
          {populaires.length > 0 && (
            <Section icon={Flame} title="Les plus joués" packs={populaires} launching={launching} onPick={pickPack} />
          )}
          {/* Nouveautés */}
          {nouveautes.length > 0 && (
            <Section icon={Clock3} title="Dernières nouveautés" packs={nouveautes} launching={launching} onPick={pickPack} />
          )}
          {/* Recommandés */}
          {recommandes.length > 0 && (
            <Section icon={ThumbsUp} title="Recommandés pour toi" packs={recommandes} launching={launching} onPick={pickPack} />
          )}
        </>
      )}

      {/* Buzzers */}
      <section className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Radio} title="Mes buzzers" inline />
          <div className="flex items-center gap-3">
            <Link to="/buzzer" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Comment ça marche ?</Link>
            <Link to="/compte" className="text-xs font-medium" style={{ color: '#818CF8' }}>Gérer →</Link>
          </div>
        </div>
        {buzzers.length === 0 ? (
          <div className="card p-6 text-center">
            <Radio size={24} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />
            <p className="text-sm mb-3" style={{ color: 'var(--text-dim)' }}>Aucun buzzer appairé.</p>
            <Link to="/compte" className="btn-secondary btn-sm">Ajouter un buzzer</Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {buzzers.map(b => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.status === 'OFFLINE' ? 'var(--text-dim)' : b.status === 'IN_GAME' ? '#F59E0B' : '#22C55E' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{b.nom ?? b.mac.slice(-5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mode picker modal */}
      {selectedPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => !launching && setSelectedPack(null)}>
          <div className="card p-6 max-w-md w-full animate-scaleIn" onClick={e => e.stopPropagation()}
            style={{ border: `1px solid ${hex(selectedPack.couleur, 0.3)}` }}>
            <div className="flex items-start justify-between mb-1">
              <span className="text-4xl">{selectedPack.emoji}</span>
              <button onClick={() => setSelectedPack(null)} className="btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <h3 className="text-xl font-bold mt-2" style={{ color: 'var(--text)' }}>{selectedPack.nom}</h3>
            <p className="text-sm mt-1 mb-1.5" style={{ color: 'var(--text-muted)' }}>{selectedPack.description}</p>
            <p className="text-2xs mb-4" style={{ color: 'var(--text-dim)' }}>
              {selectedPack.nbManches} manche{selectedPack.nbManches > 1 ? 's' : ''} · {selectedPack.nbManches * selectedPack.nbQuestions} questions · {selectedPack.tempsParQuestion}s/question
            </p>

            {/* Mode animateur : l'hôte peut choisir d'être Maître du jeu (défaut)
                ou de jouer aussi (compté au classement). */}
            <button onClick={() => setAnimateurJoue(v => !v)}
              className="flex items-center gap-2 mb-3 text-left">
              <span className="w-9 h-5 rounded-full relative transition-all shrink-0"
                style={{ background: animateurJoue ? '#6366F1' : 'rgba(255,255,255,0.12)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: animateurJoue ? '18px' : '2px' }} />
              </span>
              <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                {animateurJoue ? 'Je joue aussi (compté au score)' : 'Je suis Maître du jeu (hors classement)'}
                <span className="block" style={{ color: 'var(--text-dim)' }}>Mode Animateur uniquement</span>
              </span>
            </button>

            {/* D5/A4 — Mode distanciel */}
            <button onClick={() => setModeDistanciel(v => !v)}
              className="flex items-center gap-2 mb-3 text-left">
              <span className="w-9 h-5 rounded-full relative transition-all shrink-0"
                style={{ background: modeDistanciel ? '#0EA5E9' : 'rgba(255,255,255,0.12)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: modeDistanciel ? '18px' : '2px' }} />
              </span>
              <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                {modeDistanciel ? '🌐 Jeu à distance activé' : '🌐 Jeu à distance désactivé'}
                <span className="block" style={{ color: 'var(--text-dim)' }}>Médias + saisie sur téléphone</span>
              </span>
            </button>

            <p className="label mb-2">Choisis le mode de jeu</p>
            <div className="space-y-2">
              {GAMEMODES.map(m => {
                const Icon = m.icon
                const recommended = selectedPack.modeRecommande === m.id
                return (
                  <button key={m.id} disabled={!!launching}
                    onClick={() => launchPack(selectedPack.id, m.id)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left"
                    style={{
                      background: 'var(--hover-overlay)',
                      border: `1px solid ${recommended ? hex(selectedPack.couleur, 0.4) : 'var(--border)'}`,
                    }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: hex(selectedPack.couleur, 0.15) }}>
                      <Icon size={16} style={{ color: selectedPack.couleur }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                        {m.emoji} {m.label}
                        {recommended && <span className="text-2xs px-1.5 py-0.5 rounded-full" style={{ background: hex(selectedPack.couleur, 0.15), color: selectedPack.couleur }}>Recommandé</span>}
                      </p>
                      <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{m.desc}</p>
                    </div>
                    {launching === selectedPack.id
                      ? <Loader2 size={16} className="animate-spin" style={{ color: selectedPack.couleur }} />
                      : <ArrowRight size={15} style={{ color: 'var(--text-dim)' }} />}
                  </button>
                )
              })}
            </div>

            {/* Notation du pack */}
            <PackRating pack={selectedPack} apiFetch={apiFetch} />
          </div>
        </div>
      )}

      {/* Paywall */}
      {paywall && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setPaywall(null)}>
          <div className="card p-6 max-w-sm w-full text-center animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(99,102,241,0.12)' }}>
              {paywall.quota ? <Gauge size={26} style={{ color: '#818CF8' }} /> : <Lock size={24} style={{ color: '#818CF8' }} />}
            </div>
            <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--text)' }}>
              {paywall.quota ? 'Limite atteinte' : 'Pack réservé'}
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>{paywall.reason}</p>
            <div className="flex flex-col gap-2">
              <Link to="/abonnement" className="btn-primary w-full gap-2">
                <Crown size={15} />{paywall.quota ? 'Passer à PRO' : 'Découvrir les offres'}
              </Link>
              <button onClick={() => setPaywall(null)} className="btn-ghost w-full">Plus tard</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// Bandeau plan + quotas. Visibilité discrète mais claire (point 7 du brief).
function QuotaBanner({ quota }) {
  const org = quota.organisation
  const illimite = quota.limites.partiesParMois == null
  const used = quota.usage.partiesCeMois
  const max = quota.limites.partiesParMois
  const pct = illimite ? 0 : Math.min(100, Math.round((used / max) * 100))
  const presduMax = !illimite && used / max >= 0.8
  const renouvellement = org?.expireAt ?? quota.expireAt

  return (
    <div className="card p-4 mb-7 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: quota.plan === 'FREE' ? 'rgba(144,144,160,0.15)' : 'rgba(99,102,241,0.15)' }}>
          <Crown size={16} style={{ color: quota.plan === 'FREE' ? 'var(--text-muted)' : '#818CF8' }} />
        </div>
        <div>
          {org ? (
            <>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{org.nom}</p>
              <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Plan Organisation {org.sieges} utilisateurs</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Plan {quota.planNom}</p>
              <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                Joueurs max : {quota.limites.joueursMax ?? '∞'}
                {renouvellement && <> · renouvellement le {new Date(renouvellement).toLocaleDateString('fr-FR')}</>}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {org ? (
          <>
            <div className="flex items-center justify-between text-2xs mb-1">
              <span style={{ color: 'var(--text-muted)' }}>Utilisateurs actifs</span>
              <span style={{ color: 'var(--text-muted)' }}>{org.siegesUtilises} / {org.sieges}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hover-overlay)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((org.siegesUtilises / org.sieges) * 100)}%`, background: '#38BDF8' }} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-2xs mb-1">
              <span style={{ color: 'var(--text-muted)' }}>Parties ce mois</span>
              <span style={{ color: presduMax ? '#F59E0B' : 'var(--text-muted)' }}>{illimite ? `${used} · illimité` : `${used} / ${max}`}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hover-overlay)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: illimite ? '100%' : `${pct}%`, background: illimite ? '#22C55E' : presduMax ? '#F59E0B' : '#6366F1' }} />
            </div>
          </>
        )}
      </div>
      {org ? (
        <Link to="/organisation" className="btn-secondary btn-sm gap-1.5 shrink-0"><Crown size={13} />Mon Organisation</Link>
      ) : quota.plan === 'FREE' ? (
        <Link to="/abonnement" className="btn-primary btn-sm gap-1.5 shrink-0"><Crown size={13} />Passer à PRO</Link>
      ) : null}
    </div>
  )
}

// Notation inline d'un pack (étoiles cliquables).
function PackRating({ pack, apiFetch }) {
  const [data, setData] = useState(null)
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    apiFetch(`/packs/${pack.id}/ratings`).then(r => r?.json()).then(d => { if (alive) setData(d) }).catch(() => {})
    return () => { alive = false }
  }, [pack.id])

  async function rate(note) {
    setSaving(true)
    const res = await apiFetch(`/packs/${pack.id}/ratings`, { method: 'POST', body: { note } })
    if (res?.ok) {
      const agg = await res.json()
      setData(d => ({ ...(d ?? {}), ...agg, mien: { ...(d?.mien ?? {}), note } }))
    }
    setSaving(false)
  }

  const mien = data?.mien?.note ?? 0
  return (
    <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
      <div>
        <p className="text-2xs mb-0.5" style={{ color: 'var(--text-dim)' }}>
          {data?.nbAvis ? <>⭐ {data.noteMoyenne} / 5 · {data.nbAvis} avis</> : 'Aucun avis — sois le premier !'}
        </p>
        <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Ta note :</p>
      </div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} disabled={saving} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => rate(n)}>
            <Star size={18} style={{ color: '#EAB308', fill: (hover || mien) >= n ? '#EAB308' : 'transparent' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// Section avec grille de packs.
function Section({ icon, title, subtitle, packs, launching, onPick, highlight }) {
  if (!packs?.length) return null
  return (
    <section className="mb-9">
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />
      <PackGrid packs={packs} launching={launching} onPick={onPick} highlight={highlight} />
    </section>
  )
}

function PackGrid({ packs, launching, onPick, highlight }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {packs.map(pack => (
        <button key={pack.id} onClick={() => onPick(pack)}
          className="group relative text-left rounded-2xl p-4 h-32 flex flex-col justify-between overflow-hidden transition-all"
          style={{
            background: `linear-gradient(135deg, ${hex(pack.couleur, highlight ? 0.22 : 0.16)} 0%, rgba(20,20,24,0.6) 70%)`,
            border: `1px solid ${hex(pack.couleur, highlight ? 0.35 : 0.25)}`,
          }}>
          <div className="absolute -right-4 -top-3 text-6xl opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all">
            {pack.emoji}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-3xl">{pack.emoji}</span>
            <div className="flex items-center gap-1.5 relative z-10">
              {pack.tier && pack.tier !== 'GRATUIT' && (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                  style={{ background: 'rgba(99,102,241,0.18)', color: '#A5B4FC' }}>
                  {pack.verrouille && <Lock size={9} />}{pack.tier === 'PREMIUM' ? 'PRO' : pack.tier}
                </span>
              )}
              {pack.vedette && <Star size={13} style={{ color: '#EAB308', fill: '#EAB308' }} />}
            </div>
          </div>
          <div className="relative z-10">
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>{pack.nom}</p>
            <p className="text-2xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{pack.description}</p>
            {pack.nbAvis > 0 && (
              <p className="text-2xs mt-1 flex items-center gap-1" style={{ color: '#EAB308' }}>
                <Star size={9} style={{ fill: '#EAB308' }} />{pack.noteMoyenne} <span style={{ color: 'var(--text-dim)' }}>({pack.nbAvis})</span>
              </p>
            )}
          </div>
          {launching === pack.id && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(14,14,18,0.6)' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: pack.couleur }} />
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// Filtre à choix unique sous forme de menu déroulant compact.
function FilterChips({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs font-medium rounded-lg px-2.5 py-1.5 cursor-pointer outline-none"
      style={{
        background: value ? 'rgba(99,102,241,0.15)' : 'var(--hover-overlay)',
        color: value ? '#818CF8' : 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}>
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function SectionTitle({ icon: Icon, title, subtitle, inline }) {
  return (
    <div className={inline ? '' : 'mb-3'}>
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color: '#818CF8' }} />
        <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>{title}</h2>
      </div>
      {subtitle && <p className="text-xs mt-0.5 ml-6" style={{ color: 'var(--text-dim)' }}>{subtitle}</p>}
    </div>
  )
}

// Convertit un hex "#RRGGBB" en rgba avec alpha.
function hex(color, alpha) {
  const c = (color ?? '#6366F1').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
