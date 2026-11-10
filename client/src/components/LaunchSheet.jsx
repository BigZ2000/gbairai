import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { X, Play, Users, Loader2, Smartphone, MonitorPlay, ChevronDown, Star, Pencil, ArrowLeft } from 'lucide-react'

// Feuille de lancement d'un pack ou d'un quiz personnel.
// Deux décisions au plus, en langage courant :
//   1. seul ou à plusieurs ?            (seul → la partie démarre aussitôt)
//   2. à plusieurs : où sont les joueurs ? (chacun son téléphone / même salle)
// « Qui anime ? » est replié : le réglage conseillé du pack s'applique par défaut.
// Le vocabulaire technique (auto, distanciel, animateur…) reste côté serveur.
const ANIMATIONS = [
  { id: 'auto',      label: 'Le jeu s\'anime tout seul', desc: 'Chrono, réponses et scores automatiques.' },
  { id: 'animateur', label: 'J\'anime la partie',         desc: 'Tu lis les questions et valides les réponses au buzzer.' },
  { id: 'vote',      label: 'La salle vote',              desc: 'Les joueurs jugent la réponse du plus rapide (3 joueurs minimum).' },
]

export default function LaunchSheet({ pack, onClose, onBlocked, editable = false }) {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [etape, setEtape] = useState('choix')        // 'choix' | 'groupe'
  const [surPlace, setSurPlace] = useState(false)    // false = chacun son téléphone
  const [animation, setAnimation] = useState(pack.modeRecommande ?? 'auto')
  const [jeJoue, setJeJoue] = useState(false)
  const [reglages, setReglages] = useState(false)
  const [busy, setBusy] = useState(null)             // 'solo' | 'groupe' | null
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const nbQuestions = (pack.nbManches ?? 1) * (pack.nbQuestions ?? 0)
  const minutes = Math.max(2, Math.round(nbQuestions * ((pack.tempsParQuestion ?? 30) + 8) / 60))

  async function lancer({ solo }) {
    setBusy(solo ? 'solo' : 'groupe'); setErreur('')
    try {
      const body = solo
        ? { gameMode: 'auto', modeDistanciel: true, solo: true }
        : { gameMode: animation, modeDistanciel: !surPlace, animateurJoue: animation === 'animateur' ? jeJoue : false }
      const res = await apiFetch(`/packs/${pack.id}/start`, { method: 'POST', body })
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}))
        // 403 = pack réservé à une offre ; 402 = quota mensuel atteint.
        if (res?.status === 402 || res?.status === 403) { onBlocked?.(err); return }
        setErreur(err?.error ?? 'Impossible de lancer la partie.'); return
      }
      const partie = await res.json()
      if (solo) {
        // Seul : on saute la salle d'attente, la partie démarre tout de suite.
        const s = await apiFetch(`/parties/${partie.id}/start`, { method: 'POST', body: {} })
        if (!s?.ok) {
          const e = await s?.json().catch(() => ({}))
          setErreur(e?.error ?? 'Lancement impossible.'); return
        }
        navigate(`/parties/${partie.code}/jeu`)
      } else {
        navigate(`/parties/${partie.code}/attente`)
      }
    } catch {
      setErreur('Connexion perdue. Réessaie.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(43,26,16,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={`Lancer ${pack.nom}`}>
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl animate-slideUp sm:animate-pop"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
        {/* En-tête coloré */}
        <div className="relative px-5 pt-5 pb-4 rounded-t-3xl" style={{ background: tint(pack.couleur, 0.14) }}>
          <div className="flex items-start justify-between gap-3">
            {etape === 'groupe' ? (
              <button onClick={() => setEtape('choix')} className="btn-ghost btn-sm -ml-2" aria-label="Retour"><ArrowLeft size={16} /></button>
            ) : (
              <span className="text-5xl leading-none" aria-hidden="true">{pack.emoji ?? '🎯'}</span>
            )}
            <button onClick={onClose} disabled={!!busy} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)' }} aria-label="Fermer"><X size={16} /></button>
          </div>
          <h3 className="text-xl font-extrabold mt-3" style={{ color: 'var(--text)' }}>{pack.nom}</h3>
          {etape === 'choix' && pack.description && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{pack.description}</p>
          )}
          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>
            {nbQuestions} question{nbQuestions > 1 ? 's' : ''} · environ {minutes} min
          </p>
        </div>

        <div className="p-5">
          {erreur && (
            <p className="text-sm mb-3 px-3 py-2 rounded-xl" role="alert"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#C0392B' }}>{erreur}</p>
          )}

          {etape === 'choix' ? (
            <>
              <button onClick={() => lancer({ solo: true })} disabled={!!busy} className="btn-primary btn-xl w-full">
                {busy === 'solo' ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                Jouer seul, tout de suite
              </button>
              <button onClick={() => setEtape('groupe')} disabled={!!busy} className="btn-secondary btn-xl w-full mt-3">
                <Users size={18} />Jouer à plusieurs
              </button>
              <p className="text-2xs text-center mt-3" style={{ color: 'var(--text-dim)' }}>
                Seul : gratuit et illimité. À plusieurs : tes invités rejoignent avec un code, sans compte.
              </p>
              {editable && (
                <Link to={`/quiz/${pack.id}`} className="btn-ghost w-full mt-2 gap-1.5"><Pencil size={14} />Modifier ce quiz</Link>
              )}
              {/* Notation : packs du catalogue uniquement (un quiz personnel n'a pas de `slug` public). */}
              {pack.slug && <PackRating pack={pack} apiFetch={apiFetch} />}
            </>
          ) : (
            <>
              <p className="label">Où sont les joueurs ?</p>
              <div className="grid grid-cols-2 gap-2">
                <Choix actif={!surPlace} onClick={() => setSurPlace(false)} icon={Smartphone}
                  titre="Chacun son téléphone" desc="À distance ou autour de la table : tout s'affiche sur les téléphones." />
                <Choix actif={surPlace} onClick={() => setSurPlace(true)} icon={MonitorPlay}
                  titre="Un grand écran" desc="Salle, maquis, séminaire : les questions sur l'écran, on répond au téléphone ou au buzzer." />
              </div>

              <button onClick={() => setReglages(v => !v)} aria-expanded={reglages}
                className="flex items-center justify-between w-full mt-4 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                <span>Qui anime ? <span style={{ color: 'var(--text)' }}>{ANIMATIONS.find(a => a.id === animation)?.label}</span></span>
                <ChevronDown size={16} style={{ transform: reglages ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>
              {reglages && (
                <div className="mt-2 space-y-2 animate-fadeUp">
                  {ANIMATIONS.map(a => (
                    <button key={a.id} onClick={() => setAnimation(a.id)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl transition-colors"
                      style={{
                        background: animation === a.id ? 'var(--brand-soft)' : 'var(--input-bg)',
                        border: `1.5px solid ${animation === a.id ? 'var(--brand)' : 'transparent'}`,
                      }}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {a.label}
                        {pack.modeRecommande === a.id && <span className="badge-indigo ml-2">Conseillé</span>}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.desc}</p>
                    </button>
                  ))}
                  {animation === 'animateur' && (
                    <label className="flex items-center gap-2 text-sm px-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox" className="check" checked={jeJoue} onChange={e => setJeJoue(e.target.checked)} />
                      Je joue aussi (je compte au classement)
                    </label>
                  )}
                </div>
              )}

              <button onClick={() => lancer({ solo: false })} disabled={!!busy} className="btn-primary btn-xl w-full mt-5">
                {busy === 'groupe' ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                Ouvrir la salle et inviter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Choix({ actif, onClick, icon: Icon, titre, desc }) {
  return (
    <button onClick={onClick} aria-pressed={actif} className="text-left p-3 rounded-2xl transition-colors"
      style={{ background: actif ? 'var(--brand-soft)' : 'var(--input-bg)', border: `1.5px solid ${actif ? 'var(--brand)' : 'transparent'}` }}>
      <Icon size={20} style={{ color: actif ? 'var(--brand-text)' : 'var(--text-muted)' }} />
      <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--text)' }}>{titre}</p>
      <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
    </button>
  )
}

// Notation d'un pack du catalogue (étoiles cliquables).
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
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {data?.nbAvis ? <>{data.noteMoyenne} / 5 · {data.nbAvis} avis</> : 'Tu as aimé ? Note ce pack'}
      </p>
      <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} disabled={saving} onMouseEnter={() => setHover(n)} onClick={() => rate(n)} aria-label={`Noter ${n} sur 5`}>
            <Star size={20} style={{ color: 'var(--mango)', fill: (hover || mien) >= n ? 'var(--mango)' : 'transparent' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// "#RRGGBB" → rgba avec alpha (couleur d'accent propre à chaque pack).
export function tint(color, alpha) {
  const c = (/^#[0-9a-f]{6}$/i.test(color ?? '') ? color : '#F26A1B').slice(1)
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${alpha})`
}
