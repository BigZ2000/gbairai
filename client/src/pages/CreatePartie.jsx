import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  ChevronLeft, ChevronRight, Mic2, Timer, Users, Plus, Trash2,
  Loader2, AlertCircle, Check, Layers,
} from 'lucide-react'

const MODES = [
  { value: 'animateur', icon: Mic2,   label: 'Avec animateur', desc: 'Vous validez chaque réponse manuellement.' },
  { value: 'auto',      icon: Timer,   label: 'Automatique',    desc: 'La partie avance seule grâce au timer.' },
  { value: 'vote',      icon: Users,   label: 'Vote collectif', desc: 'Les joueurs votent ensemble pour valider.' },
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
  return { id: Date.now() + i, nom: `Manche ${i + 1}`, theme: 'MELANGE', difficulte: 'MIXTE', nbQuestions: 10, pointsParQ: 100, tempsLimite: 30 }
}

export default function CreatePartie() {
  const { apiFetch } = useAuth()
  const navigate    = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ nom: '', mode: 'animateur', timerBuzz: 10, timerVote: 15, nbManches: 1, masquerReponses: false })
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
      // 1. Create the partie
      const body = {
        nom: form.nom.trim(),
        mode: form.mode,
        timerBuzz: form.timerBuzz,
        timerVote: form.timerVote,
        masquerReponses: form.mode === 'animateur' ? form.masquerReponses : false,
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
      <div className="max-w-lg">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="btn-ghost btn-sm mb-6 -ml-2">
          <ChevronLeft size={15} />Retour
        </button>

        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                  style={{
                    background: step > s.n ? '#22C55E' : step === s.n ? '#6366F1' : 'rgba(255,255,255,0.06)',
                    color: step >= s.n ? '#fff' : '#5A5A6E',
                  }}>
                  {step > s.n ? <Check size={12} /> : s.n}
                </div>
                <span className="text-sm hidden sm:block" style={{ color: step === s.n ? '#ECECF0' : '#5A5A6E' }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px" style={{ background: step > s.n ? '#22C55E' : 'rgba(255,255,255,0.08)' }} />
              )}
            </React.Fragment>
          ))}
        </div>

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
                        border: `1px solid ${sel ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <input type="radio" name="mode" value={m.value} checked={sel}
                        onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                        className="mt-0.5 accent-indigo-500" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon size={14} style={{ color: sel ? '#818CF8' : '#5A5A6E' }} />
                          <p className="text-sm font-semibold" style={{ color: sel ? '#ECECF0' : '#9090A0' }}>{m.label}</p>
                        </div>
                        <p className="text-xs" style={{ color: '#5A5A6E' }}>{m.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

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
                          border: `1px solid ${sel ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        <input type="radio" name="masquerReponses" checked={sel}
                          onChange={() => setForm(f => ({ ...f, masquerReponses: opt.value }))}
                          className="mt-0.5 accent-indigo-500" />
                        <div>
                          <p className="text-sm font-semibold mb-0.5" style={{ color: sel ? '#ECECF0' : '#9090A0' }}>{opt.label}</p>
                          <p className="text-xs" style={{ color: '#5A5A6E' }}>{opt.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {form.mode !== 'animateur' && (
              <div className="card p-5">
                <p className="label mb-3">Durées</p>
                <div className="grid grid-cols-2 gap-3">
                  {form.mode === 'auto' && (
                    <div>
                      <label className="label">Timer après buzz (s)</label>
                      <input type="number" min={3} max={60} value={form.timerBuzz}
                        onChange={e => setForm(f => ({ ...f, timerBuzz: Number(e.target.value) }))}
                        className="input text-center text-lg font-bold" />
                    </div>
                  )}
                  {form.mode === 'vote' && (
                    <div>
                      <label className="label">Timer vote (s)</label>
                      <input type="number" min={5} max={60} value={form.timerVote}
                        onChange={e => setForm(f => ({ ...f, timerVote: Number(e.target.value) }))}
                        className="input text-center text-lg font-bold" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card p-5">
              <label className="label">Nombre de manches</label>
              <div className="flex items-center gap-3 mt-2">
                <button type="button" onClick={() => setNbManches(form.nbManches - 1)}
                  className="btn-ghost btn-sm w-9 h-9 flex items-center justify-center font-bold text-lg">−</button>
                <span className="text-2xl font-bold w-10 text-center" style={{ color: '#ECECF0' }}>{form.nbManches}</span>
                <button type="button" onClick={() => setNbManches(form.nbManches + 1)}
                  className="btn-ghost btn-sm w-9 h-9 flex items-center justify-center font-bold text-lg">+</button>
              </div>
            </div>

            <button onClick={() => { if (form.nom.trim()) setStep(2) }}
              disabled={!form.nom.trim()}
              className="btn-primary w-full btn-xl gap-2">
              Configurer les manches <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Étape 2 : Manches ── */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeUp">
            <p className="text-sm" style={{ color: '#9090A0' }}>
              Les questions seront tirées aléatoirement depuis la bibliothèque selon les critères de chaque manche.
            </p>

            {manches.map((m, i) => (
              <div key={m.id} className="card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={14} style={{ color: '#6366F1' }} />
                  <span className="text-sm font-semibold" style={{ color: '#ECECF0' }}>Manche {i + 1}</span>
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
                        <option key={t} value={t}>{t === 'MELANGE' ? '🔀 Mélange' : t}</option>
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
              <h2 className="text-base font-semibold" style={{ color: '#ECECF0' }}>Récapitulatif</h2>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#9090A0' }}>Nom</span>
                <span className="font-semibold" style={{ color: '#ECECF0' }}>{form.nom}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#9090A0' }}>Mode</span>
                <span className="font-semibold" style={{ color: '#ECECF0' }}>{MODES.find(m => m.value === form.mode)?.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#9090A0' }}>Manches</span>
                <span className="font-semibold" style={{ color: '#ECECF0' }}>{manches.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#9090A0' }}>Questions totales</span>
                <span className="font-semibold" style={{ color: '#ECECF0' }}>{manches.reduce((s, m) => s + m.nbQuestions, 0)}</span>
              </div>
            </div>

            {manches.map((m, i) => (
              <div key={m.id} className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <span className="text-xs font-bold mr-2" style={{ color: '#818CF8' }}>M{i + 1}</span>
                  <span className="text-sm font-medium" style={{ color: '#ECECF0' }}>{m.nom}</span>
                </div>
                <div className="flex gap-3 text-xs" style={{ color: '#5A5A6E' }}>
                  <span>{m.theme === 'MELANGE' ? '🔀 Mélange' : m.theme}</span>
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
