import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { ChevronLeft, Mic2, Timer, Users, Loader2, AlertCircle } from 'lucide-react'

const MODES = [
  {
    value: 'animateur',
    icon: Mic2,
    label: 'Avec animateur',
    description: 'Vous validez chaque réponse manuellement. Contrôle total.',
  },
  {
    value: 'auto',
    icon: Timer,
    label: 'Automatique',
    description: 'La partie avance seule grâce au timer. Aucun animateur requis.',
  },
  {
    value: 'vote',
    icon: Users,
    label: 'Vote collectif',
    description: 'Les joueurs votent ensemble pour valider chaque réponse.',
  },
]

export default function CreatePartie() {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nom: '', mode: 'animateur', timerBuzz: 10, timerVote: 15 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/parties', { method: 'POST', body: form })
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}))
        setError(err?.error ?? 'Erreur lors de la création')
        return
      }
      const partie = await res.json()
      navigate(`/parties/${partie.code}/attente`)
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-md">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm mb-6 -ml-2">
          <ChevronLeft size={15} />Retour
        </button>

        <h1 className="text-xl font-bold mb-6" style={{ color: '#ECECF0' }}>Nouvelle partie</h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nom */}
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

          {/* Mode */}
          <div className="card p-5">
            <p className="label mb-3">Mode de jeu</p>
            <div className="space-y-2">
              {MODES.map(m => {
                const Icon = m.icon
                const selected = form.mode === m.value
                return (
                  <label key={m.value}
                    className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-all duration-150"
                    style={{
                      background: selected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <input
                      type="radio" name="mode" value={m.value}
                      checked={selected}
                      onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Icon size={14} style={{ color: selected ? '#818CF8' : '#5A5A6E' }} />
                        <p className="text-sm font-semibold" style={{ color: selected ? '#ECECF0' : '#9090A0' }}>
                          {m.label}
                        </p>
                      </div>
                      <p className="text-xs" style={{ color: '#5A5A6E' }}>{m.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Timers */}
          {form.mode !== 'animateur' && (
            <div className="card p-5">
              <p className="label mb-3">Durées</p>
              <div className="grid grid-cols-2 gap-3">
                {form.mode === 'auto' && (
                  <div>
                    <label className="label">Timer après buzz (s)</label>
                    <input type="number" min={3} max={60} value={form.timerBuzz}
                      onChange={e => setForm(f => ({ ...f, timerBuzz: Number(e.target.value) }))}
                      className="input text-center text-lg font-bold"
                    />
                  </div>
                )}
                {form.mode === 'vote' && (
                  <div>
                    <label className="label">Timer vote (s)</label>
                    <input type="number" min={5} max={60} value={form.timerVote}
                      onChange={e => setForm(f => ({ ...f, timerVote: Number(e.target.value) }))}
                      className="input text-center text-lg font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          <button type="submit" disabled={loading || !form.nom.trim()} className="btn-primary w-full btn-xl">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Créer la partie'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
