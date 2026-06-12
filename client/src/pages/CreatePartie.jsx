import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  ChevronLeft, ChevronRight, ChevronDown, Mic2, Timer, Users, Plus, Trash2,
  Loader2, AlertCircle, Check, Layers, User, Settings2,
  Rocket, Globe, UserMinus, Heart, AlertTriangle, TrendingUp,
} from 'lucide-react'

// ──────────────────────────────────────────────────────────────────────────────
// Workflow « plug & play » en 2 écrans :
//   1. ESSENTIEL  — nom + mode + CTA immédiat. Les options pointues (distanciel,
//      élimination, vies, régie animateur) sont REPLIÉES (progressive disclosure).
//   2. MANCHES    — uniquement si « Personnaliser » : cartes ajoutables/supprimables,
//      thèmes = catégories réelles de la base (avec nb de questions), filtre par
//      TYPE de question, récap + création directe (pas d'écran de confirmation).
// ──────────────────────────────────────────────────────────────────────────────

const MODES = [
  { value: 'solo',      icon: User,    label: 'Solo',           desc: "Joue seul pour t'entraîner. Tout s'affiche sur ton écran, réponses vérifiées automatiquement." },
  { value: 'auto',      icon: Timer,   label: 'Automatique',    desc: 'La partie avance toute seule au minuteur. Idéal en groupe pour démarrer vite. (Buzzer en présentiel = jeu de réflexe : le 1er qui buzze marque.)', recommande: true },
  { value: 'animateur', icon: Mic2,    label: 'Avec animateur', desc: 'Vous présentez et validez chaque réponse. Vous animez — vous n\'apparaissez pas au classement.' },
  { value: 'vote',      icon: Users,   label: 'Vote collectif', desc: 'Les joueurs votent ensemble pour valider (min. 3 joueurs).' },
]

const DIFFS = [
  { value: 'MIXTE',    label: 'Mixte' },
  { value: 'FACILE',   label: 'Facile' },
  { value: 'MOYEN',    label: 'Moyen' },
  { value: 'DIFFICILE',label: 'Difficile' },
]

// Types de questions filtrables par manche (vide = tous).
const QUESTION_TYPES = [
  { value: 'QCM',       label: 'QCM' },
  { value: 'VRAI_FAUX', label: 'Vrai / Faux' },
  { value: 'BUZZER',    label: 'Réponse libre' },
  { value: 'IMAGE',     label: 'Image' },
  { value: 'AUDIO',     label: 'Audio' },
  { value: 'VIDEO',     label: 'Vidéo' },
]

function defaultManche(i) {
  return {
    id: Date.now() + i, nom: `Manche ${i + 1}`, theme: 'MELANGE', difficulte: 'MIXTE',
    nbQuestions: 10, pointsParQ: 100, tempsLimite: 30, typesAutorises: [],
    malusEnabled: false, malusPenalite: 50, multiplicateurPoints: 1.0, eliminationActive: false,
  }
}

export default function CreatePartie() {
  const { apiFetch } = useAuth()
  const navigate    = useNavigate()

  const [step, setStep] = useState(1)
  // Défauts « plug & play » : mode AUTO + réponses masquées (régie animateur).
  const [form, setForm] = useState({ nom: '', mode: 'auto', masquerReponses: true, modeDistanciel: false, eliminationActive: false, viesParJoueur: 0 })
  const [showOptions, setShowOptions] = useState(false)
  const [manches, setManches] = useState([defaultManche(0)])
  const [categories, setCategories] = useState([]) // [{ nom, count }] — la base est la seule source
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch('/categories').then(r => r?.json()).then(d => {
      if (Array.isArray(d)) {
        setCategories(d.map(c => ({ nom: c.nom, count: c._count?.questions ?? 0 }))
          .sort((a, b) => b.count - a.count))
      }
    })
  }, [])

  function addManche() {
    if (manches.length >= 10) return
    setManches(prev => [...prev, defaultManche(prev.length)])
  }
  function removeManche(idx) {
    setManches(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }
  function updateManche(idx, field, value) {
    setManches(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }
  function toggleType(idx, type) {
    setManches(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const cur = m.typesAutorises ?? []
      return { ...m, typesAutorises: cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type] }
    }))
  }

  async function handleCreate() {
    setError('')
    setLoading(true)
    try {
      // « Solo » est un préréglage : mode auto + distanciel.
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
            typesAutorises: m.typesAutorises ?? [],
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

  // Récap dynamique (écran Manches) : total questions + durée estimée
  // (~tempsLimite + 5 s de révélation/transition par question).
  const totalQuestions = manches.reduce((s, m) => s + (Number(m.nbQuestions) || 0), 0)
  const dureeMin = Math.max(1, Math.round(manches.reduce((s, m) => s + (Number(m.nbQuestions) || 0) * ((Number(m.tempsLimite) || 30) + 5), 0) / 60))

  return (
    <Layout>
      <div className="max-w-lg mx-auto w-full">
        <button onClick={() => step > 1 ? setStep(1) : navigate(-1)}
          className="btn-ghost btn-sm mb-4 -ml-2">
          <ChevronLeft size={15} />Retour
        </button>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            {step === 1 ? 'Nouvelle partie' : 'Tes manches'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {step === 1
              ? 'Donne un nom, choisis un mode — et c\'est parti.'
              : 'Thème, types de questions, difficulté… puis crée directement.'}
          </p>
        </div>

        {/* ── Écran 1 : ESSENTIEL ── */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeUp">
            <div className="card p-5">
              <label className="label">Nom de la partie</label>
              <input
                type="text" required maxLength={100} autoFocus
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

            {/* CTA PRINCIPAL — tout de suite après le mode (zéro friction). */}
            <button onClick={handleCreate} disabled={!form.nom.trim() || loading}
              className="btn-primary w-full btn-xl gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Rocket size={16} />Créer la partie <ChevronRight size={16} /></>}
            </button>
            <p className="text-2xs text-center -mt-2" style={{ color: 'var(--text-dim)' }}>
              Prêt à jouer tout de suite : 1 manche · 10 questions · 30 s · tous thèmes
            </p>

            <button onClick={() => { if (form.nom.trim()) setStep(2) }}
              disabled={!form.nom.trim()}
              className="btn-secondary w-full gap-2">
              <Layers size={15} />Personnaliser les manches (thèmes, types, difficulté…)
            </button>

            {/* Options avancées — REPLIÉES par défaut (progressive disclosure). */}
            {form.mode !== 'solo' && (
              <div className="card overflow-hidden">
                <button type="button" onClick={() => setShowOptions(v => !v)}
                  className="w-full flex items-center justify-between p-4 text-sm"
                  style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-2"><Settings2 size={15} />Options avancées</span>
                  <ChevronDown size={15} className="transition-transform" style={{ transform: showOptions ? 'rotate(180deg)' : 'none' }} />
                </button>
                {showOptions && (
                  <div className="px-4 pb-4 space-y-3 animate-fadeUp">
                    <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-2"><Globe size={15} style={{ color: '#0EA5E9' }} className="shrink-0" />Jeu à distance (médias + saisie sur téléphone)</span>
                      <input type="checkbox" checked={!!form.modeDistanciel}
                        onChange={e => setForm(f => ({ ...f, modeDistanciel: e.target.checked }))} />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-2"><UserMinus size={15} style={{ color: '#EF4444' }} className="shrink-0" />Élimination progressive (par manche)</span>
                      <input type="checkbox" checked={!!form.eliminationActive}
                        onChange={e => setForm(f => ({ ...f, eliminationActive: e.target.checked }))} />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-2"><Heart size={15} style={{ color: '#F87171' }} className="shrink-0" />Vies par joueur (0 = désactivé)</span>
                      <input type="number" min={0} max={10} value={form.viesParJoueur}
                        onChange={e => setForm(f => ({ ...f, viesParJoueur: Number(e.target.value) }))}
                        className="input text-center w-16 py-1" />
                    </label>

                    {form.mode === 'animateur' && (
                      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-2xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>Affichage des réponses (animateur)</p>
                        {[
                          { value: true, label: 'Masquer jusqu\'à la révélation', desc: 'Vous projetez votre écran : vous découvrez la réponse avec le public.' },
                          { value: false, label: 'Voir les réponses à l\'avance', desc: 'Écran de régie privé, séparé de l\'écran public.' },
                        ].map(opt => (
                          <label key={String(opt.value)} className="flex items-start gap-2.5 py-1.5 cursor-pointer">
                            <input type="radio" name="masquerReponses" checked={!!form.masquerReponses === opt.value}
                              onChange={() => setForm(f => ({ ...f, masquerReponses: opt.value }))}
                              className="mt-0.5 accent-indigo-500" />
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {opt.label}
                              <span className="block text-2xs" style={{ color: 'var(--text-dim)' }}>{opt.desc}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} />{error}
              </div>
            )}
          </div>
        )}

        {/* ── Écran 2 : MANCHES (avancé) ── */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeUp">
            {manches.map((m, i) => (
              <div key={m.id} className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    <Layers size={14} style={{ color: '#6366F1' }} />Manche {i + 1}
                  </span>
                  {manches.length > 1 && (
                    <button onClick={() => removeManche(i)} className="btn-ghost btn-sm" title="Supprimer la manche"
                      style={{ color: '#F87171' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">Nom de la manche</label>
                  <input type="text" value={m.nom} maxLength={100}
                    onChange={e => updateManche(i, 'nom', e.target.value)}
                    className="input text-sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Thème</label>
                    {/* Thèmes = catégories RÉELLES de la base (avec nb de questions). */}
                    <select value={m.theme} onChange={e => updateManche(i, 'theme', e.target.value)}
                      className="input text-sm">
                      <option value="MELANGE">Mélange (tous les thèmes)</option>
                      {categories.map(c => (
                        <option key={c.nom} value={c.nom} disabled={c.count === 0}>
                          {c.nom} ({c.count})
                        </option>
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

                {/* Filtre par TYPE de question (chips, multi-sélection ; vide = tous). */}
                <div>
                  <label className="label">Types de questions</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {QUESTION_TYPES.map(t => {
                      const active = (m.typesAutorises ?? []).includes(t.value)
                      return (
                        <button key={t.value} type="button" onClick={() => toggleType(i, t.value)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: active ? 'rgba(99,102,241,0.18)' : 'var(--hover-overlay)',
                            color: active ? '#818CF8' : 'var(--text-muted)',
                            border: `1px solid ${active ? 'rgba(99,102,241,0.45)' : 'var(--border)'}`,
                          }}>
                          {active && <Check size={11} className="inline mr-1 -mt-0.5" />}{t.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-2xs mt-1.5" style={{ color: 'var(--text-dim)' }}>
                    {(m.typesAutorises ?? []).length === 0 ? 'Aucune sélection = tous les types.' : `${m.typesAutorises.length} type(s) sélectionné(s).`}
                  </p>
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

            {/* Ajouter une manche — remplace l'ancien compteur de l'écran 1. */}
            {manches.length < 10 && (
              <button onClick={addManche} className="btn-secondary w-full gap-2">
                <Plus size={15} />Ajouter une manche
              </button>
            )}

            {/* Récap compact intégré (remplace l'ancien écran « Confirmation »). */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between text-sm"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {manches.length} manche{manches.length > 1 ? 's' : ''} · {totalQuestions} questions
              </span>
              <span style={{ color: 'var(--text-dim)' }}>≈ {dureeMin} min</span>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} />{error}
              </div>
            )}

            <button onClick={handleCreate} disabled={loading} className="btn-primary w-full btn-xl gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <><Rocket size={16} />Créer la partie</>}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
