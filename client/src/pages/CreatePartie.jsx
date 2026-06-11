import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  ChevronLeft, ChevronRight, Mic2, Timer, Users, Plus, Trash2,
  Loader2, AlertCircle, Check, Layers, User,
  Rocket, Globe, UserMinus, Heart, AlertTriangle, TrendingUp,
} from 'lucide-react'

const MODES = [
  { value: 'solo',      icon: User,    label: 'Solo',           desc: "Joue seul pour t'entraîner. Tout s'affiche sur ton écran, réponses vérifiées automatiquement." },
  { value: 'auto',      icon: Timer,   label: 'Automatique',    desc: 'La partie avance toute seule au minuteur. Idéal en groupe pour démarrer vite. (Buzzer en présentiel = jeu de réflexe : le 1er qui buzze marque.)', recommande: true },
  { value: 'animateur', icon: Mic2,    label: 'Avec animateur', desc: 'Vous présentez et validez chaque réponse. Vous animez — vous n\'apparaissez pas au classement.' },
  { value: 'vote',      icon: Users,   label: 'Vote collectif', desc: 'Les joueurs votent ensemble pour valider (min. 3 joueurs).' },
]

const THEMES_DEFAUT = [
  'MELANGE', 'Histoire & Politique CI', 'Géographie CI', 'Musique & Culture CI',
  'Sport CI', 'Gastronomie CI', 'Institutions CI', 'Biodiversité CI',
  'Économie CI', 'Littérature & Art CI', 'Actualités Afrique',
]

const DIFFS = [
  { value: 'MIXTE',    label: 'Mixte' },
  { value: 'FACILE',   label: 'Facile' },
  { value: 'MOYEN',    label: 'Moyen' },
  { value: 'DIFFICILE',label: 'Difficile' },
]

function defaultManche(i) {
  return {
    id: Date.now() + i, nom: `Manche ${i + 1}`, theme: 'MELANGE', difficulte: 'MIXTE',
    nbQuestions: 10, pointsParQ: 100, tempsLimite: 30,
    malusEnabled: false, malusPenalite: 50, multiplicateurPoints: 1.0, eliminationActive: false,
  }
}

export default function CreatePartie() {
  const { apiFetch } = useAuth()
  const navigate    = useNavigate()

  const [step, setStep] = useState(1)
  // Défauts « plug & play » : mode AUTO (le plus utilisé) + réponses masquées
  // jusqu'à la révélation (recommandé pour toutes les parties auto).
  const [form, setForm] = useState({ nom: '', mode: 'auto', timerBuzz: 10, timerVote: 15, nbManches: 1, masquerReponses: true, modeDistanciel: false, eliminationActive: false, viesParJoueur: 0 })
  const [manches, setManches] = useState([defaultManche(0)])
  const [categories, setCategories] = useState([])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch('/categories').then(r => r?.json()).then(d => {
      if (Array.isArray(d)) setCategories(d.map(c => c.nom))
    })
  }, [])

  const allThemes = [...new Set([...THEMES_DEFAUT, ...categories])]

  function setNbManches(n) {
    const nb = Math.max(1, Math.min(10, n))
    setManches(prev => {
      const next = [...prev]
      while (next.length < nb) next.push(defaultManche(next.length))
      return next.slice(0, nb)
    })
    setForm(f => ({ ...f, nbManches: nb }))
  }

  function updateManche(idx, field, value) {
    setManches(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }

  async function handleCreate() {
    setError('')
    setLoading(true)
    try {
      // 1. Create the partie.
      // « Solo » est un préréglage : mode auto + distanciel (énoncé/médias sur
      // l'écran du joueur, réponses ouvertes vérifiées par correspondance).
      const isSolo = form.mode === 'solo'
      const body = {
        nom: form.nom.trim(),
        mode: isSolo ? 'auto' : form.mode,
        masquerReponses: form.mode === 'animateur' ? form.masquerReponses : false,
        modeDistanciel: isSolo ? true : !!form.modeDistanciel,
        eliminationActive: isSolo ? false : !!form.eliminationActive,
        viesParJoueur: isSolo ? 0 : (Number(form.viesParJoueur) || 0),
      }
      const res = await apiFetch('/parties', { method: 'POST', body })
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}))
        setError(err?.error ?? 'Erreur lors de la création')
        return
      }
      const partie = await res.json()

      // 2. Create manches
      for (const m of manches) {
        await apiFetch(`/parties/${partie.id}/manches`, {
          method: 'POST',
          body: {
            nom: m.nom,
            theme: m.theme,
            difficulte: m.difficulte,
            nbQuestions: m.nbQuestions,
            pointsParQ: m.pointsParQ,
            tempsLimite: m.tempsLimite,
            malusEnabled: !!m.malusEnabled,
            malusPenalite: Number(m.malusPenalite) || 50,
            multiplicateurPoints: Number(m.multiplicateurPoints) || 1.0,
            eliminationActive: !!m.eliminationActive,
          },
        })
      }

      navigate(`/parties/${partie.code}/attente`)
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { n: 1, label: 'Paramètres' },
    { n: 2, label: 'Manches' },
    { n: 3, label: 'Confirmation' },
  ]

  return (
    <Layout>
      {/* Colonne CENTRÉE (mx-auto) + en-tête harmonisé avec les autres pages. */}
      <div className="max-w-lg mx-auto w-full">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="btn-ghost btn-sm mb-4 -ml-2">
          <ChevronLeft size={15} />Retour
        </button>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Nouvelle partie
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {step === 1 ? 'Donne un nom, choisis un mode — et c\'est parti.' : step === 2 ? 'Personnalise tes manches.' : 'Vérifie et lance.'}
          </p>
        </div>

        {/* Le stepper n'apparaît qu'en mode AVANCÉ (étapes 2-3). Le chemin par
            défaut est la création rapide en 1 écran (plug & play) : afficher
            3 étapes qu'on ne traverse pas créait une fausse attente. */}
        {step > 1 && (
          <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                    style={{
                      background: step > s.n ? '#22C55E' : step === s.n ? '#6366F1' : 'var(--border)',
                      color: step >= s.n ? '#fff' : 'var(--text-dim)',
                    }}>
                    {step > s.n ? <Check size={12} /> : s.n}
                  </div>
                  <span className="text-sm hidden sm:block" style={{ color: step === s.n ? 'var(--text)' : 'var(--text-dim)' }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px" style={{ background: step > s.n ? '#22C55E' : 'var(--border)' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Étape 1 : Paramètres ── */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeUp">
            <div className="card p-5">
              <label className="label">Nom de la partie</label>
              <input
                type="text" required maxLength={100}
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Quiz du vendredi soir"
                className="input text-base font-medium"
              />
            </div>

            <div className="card p-5">
              <p className="label mb-3">Mode de jeu</p>
              <div className="space-y-2">
                {MODES.map(m => {
                  const Icon = m.icon
                  const sel = form.mode === m.value
                  return (
                    <label key={m.value}
                      className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all"
                      style={{
                        background: sel ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${sel ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                      }}>
                      <input type="radio" name="mode" value={m.value} checked={sel}
                        onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                        className="mt-0.5 accent-indigo-500" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon size={14} style={{ color: sel ? '#818CF8' : 'var(--text-dim)' }} />
                          <p className="text-sm font-semibold" style={{ color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{m.label}</p>
                          {m.recommande && (
                            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}>Recommandé</span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{m.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Jeu à distance + élimination (party-level). En Solo, ces options
                sont implicites (distanciel forcé, pas d'élimination) → masquées. */}
            {form.mode !== 'solo' && (
              <div className="card p-4 space-y-2">
                <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-2"><Globe size={15} style={{ color: '#0EA5E9' }} className="shrink-0" />Jeu à distance (médias + saisie sur téléphone)</span>
                  <input type="checkbox" checked={!!form.modeDistanciel}
                    onChange={e => setForm(f => ({ ...f, modeDistanciel: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-2"><UserMinus size={15} style={{ color: '#EF4444' }} className="shrink-0" />Élimination progressive (active par manche ci-après)</span>
                  <input type="checkbox" checked={!!form.eliminationActive}
                    onChange={e => setForm(f => ({ ...f, eliminationActive: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-2"><Heart size={15} style={{ color: '#F87171' }} className="shrink-0" />Vies par joueur (0 = désactivé · −1 par mauvaise réponse)</span>
                  <input type="number" min={0} max={10} value={form.viesParJoueur}
                    onChange={e => setForm(f => ({ ...f, viesParJoueur: Number(e.target.value) }))}
                    className="input text-center w-16 py-1" />
                </label>
              </div>
            )}

            {/* Affichage des réponses côté animateur (#1). Permet de choisir si
                l'animateur dispose d'un écran de régie privé (réponses visibles
                à l'avance) ou s'il projette directement son écran et découvre la
                réponse en même temps que le public. */}
            {form.mode === 'animateur' && (
              <div className="card p-5">
                <p className="label mb-3">Affichage des réponses côté animateur</p>
                <div className="space-y-2">
                  {[
                    { value: false, label: 'Voir les réponses avant révélation',
                      desc: 'Vous disposez d\'un écran de régie privé : les réponses s\'affichent à l\'avance pour vous. À utiliser quand l\'écran public est séparé de votre écran.' },
                    { value: true, label: 'Masquer les réponses jusqu\'à la révélation',
                      desc: 'Vous projetez directement votre écran : aucune réponse n\'apparaît avant la révélation, vous la découvrez avec le public.' },
                  ].map(opt => {
                    const sel = !!form.masquerReponses === opt.value
                    return (
                      <label key={String(opt.value)}
                        className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all"
                        style={{
                          background: sel ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${sel ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                        }}>
                        <input type="radio" name="masquerReponses" checked={sel}
                          onChange={() => setForm(f => ({ ...f, masquerReponses: opt.value }))}
                          className="mt-0.5 accent-indigo-500" />
                        <div>
                          <p className="text-sm font-semibold mb-0.5" style={{ color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{opt.label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{opt.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Le rythme réel est gouverné par le « Temps (s) » de chaque manche
                (étape avancée). Les anciens réglages timerBuzz/timerVote n'étaient
                pas utilisés par le moteur → retirés pour éviter toute confusion. */}

            <div className="card p-5">
              <label className="label">Nombre de manches</label>
              <div className="flex items-center gap-3 mt-2">
                <button type="button" onClick={() => setNbManches(form.nbManches - 1)}
                  className="btn-ghost btn-sm w-9 h-9 flex items-center justify-center font-bold text-lg">−</button>
                <span className="text-2xl font-bold w-10 text-center" style={{ color: 'var(--text)' }}>{form.nbManches}</span>
                <button type="button" onClick={() => setNbManches(form.nbManches + 1)}
                  className="btn-ghost btn-sm w-9 h-9 flex items-center justify-center font-bold text-lg">+</button>
              </div>
            </div>

            {/* Création RAPIDE (défaut plug & play) : crée directement la partie
                avec les manches aux réglages standards → salle d'attente. */}
            <button onClick={handleCreate} disabled={!form.nom.trim() || loading}
              className="btn-primary w-full btn-xl gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Rocket size={16} />Créer la partie <ChevronRight size={16} /></>}
            </button>
            <p className="text-2xs text-center -mt-2" style={{ color: 'var(--text-dim)' }}>
              Prêt à jouer tout de suite : {form.nbManches} manche{form.nbManches > 1 ? 's' : ''} · 10 questions/manche · 30 s · thème mélangé
            </p>
            <button onClick={() => { if (form.nom.trim()) setStep(2) }}
              disabled={!form.nom.trim()}
              className="btn-secondary w-full gap-2">
              <Layers size={15} />Personnaliser les manches (thèmes, difficulté, points…)
            </button>
          </div>
        )}

        {/* ── Étape 2 : Manches ── */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeUp">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Les questions seront tirées aléatoirement depuis la bibliothèque selon les critères de chaque manche.
            </p>

            {manches.map((m, i) => (
              <div key={m.id} className="card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={14} style={{ color: '#6366F1' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Manche {i + 1}</span>
                </div>

                <div>
                  <label className="label">Nom de la manche</label>
                  <input type="text" value={m.nom} maxLength={100}
                    onChange={e => updateManche(i, 'nom', e.target.value)}
                    className="input text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Thème</label>
                    <select value={m.theme} onChange={e => updateManche(i, 'theme', e.target.value)}
                      className="input text-sm">
                      {allThemes.map(t => (
                        <option key={t} value={t}>{t === 'MELANGE' ? 'Mélange' : t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Difficulté</label>
                    <select value={m.difficulte} onChange={e => updateManche(i, 'difficulte', e.target.value)}
                      className="input text-sm">
                      {DIFFS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Questions</label>
                    <input type="number" min={1} max={50} value={m.nbQuestions}
                      onChange={e => updateManche(i, 'nbQuestions', Number(e.target.value))}
                      className="input text-center font-bold" />
                  </div>
                  <div>
                    <label className="label">Points/Q</label>
                    <input type="number" min={1} max={10000} value={m.pointsParQ}
                      onChange={e => updateManche(i, 'pointsParQ', Number(e.target.value))}
                      className="input text-center font-bold" />
                  </div>
                  <div>
                    <label className="label">Temps (s)</label>
                    <input type="number" min={5} max={300} value={m.tempsLimite}
                      onChange={e => updateManche(i, 'tempsLimite', Number(e.target.value))}
                      className="input text-center font-bold" />
                  </div>
                </div>

                {/* Mécaniques avancées (manches inspirées des jeux TV) */}
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-2xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Mécaniques (optionnel)</p>
                  <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-2"><AlertTriangle size={14} style={{ color: '#F59E0B' }} className="shrink-0" />Manche à risque (malus si mauvaise réponse)</span>
                    <input type="checkbox" checked={!!m.malusEnabled}
                      onChange={e => updateManche(i, 'malusEnabled', e.target.checked)} />
                  </label>
                  {m.malusEnabled && (
                    <div className="flex items-center gap-2 text-sm pl-4" style={{ color: 'var(--text-dim)' }}>
                      Pénalité
                      <input type="number" min={0} max={100} value={m.malusPenalite}
                        onChange={e => updateManche(i, 'malusPenalite', Number(e.target.value))}
                        className="input text-center w-16 py-1" /> %
                    </div>
                  )}
                  <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-2"><TrendingUp size={14} style={{ color: '#EAB308' }} className="shrink-0" />Multiplicateur de points (×)</span>
                    <input type="number" min={0.5} max={5} step={0.5} value={m.multiplicateurPoints}
                      onChange={e => updateManche(i, 'multiplicateurPoints', Number(e.target.value))}
                      className="input text-center w-16 py-1" />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-2"><UserMinus size={14} style={{ color: '#EF4444' }} className="shrink-0" />Élimination du dernier en fin de manche</span>
                    <input type="checkbox" checked={!!m.eliminationActive}
                      onChange={e => updateManche(i, 'eliminationActive', e.target.checked)} />
                  </label>
                </div>
              </div>
            ))}

            <button onClick={() => setStep(3)} className="btn-primary w-full btn-xl gap-2">
              Voir le récapitulatif <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Étape 3 : Confirmation ── */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeUp">
            <div className="card p-5 space-y-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Récapitulatif</h2>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Nom</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{form.nom}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Mode</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{MODES.find(m => m.value === form.mode)?.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Manches</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{manches.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Questions totales</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{manches.reduce((s, m) => s + m.nbQuestions, 0)}</span>
              </div>
            </div>

            {manches.map((m, i) => (
              <div key={m.id} className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div>
                  <span className="text-xs font-bold mr-2" style={{ color: '#818CF8' }}>M{i + 1}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.nom}</span>
                </div>
                <div className="flex gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                  <span>{m.theme === 'MELANGE' ? 'Mélange' : m.theme}</span>
                  <span>{m.difficulte === 'MIXTE' ? 'Mixte' : m.difficulte.toLowerCase()}</span>
                  <span>{m.nbQuestions} q.</span>
                </div>
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} />{error}
              </div>
            )}

            <button onClick={handleCreate} disabled={loading} className="btn-primary w-full btn-xl gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {loading ? 'Création en cours…' : 'Créer la partie'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
