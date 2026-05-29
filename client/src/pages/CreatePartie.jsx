import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'

const MODES = [
  {
    value: 'animateur',
    icon: '🎙️',
    label: 'Avec animateur',
    description: 'Vous validez chaque réponse manuellement. Contrôle total.',
  },
  {
    value: 'auto',
    icon: '⏱️',
    label: 'Automatique',
    description: 'La partie avance seule grâce au timer. Aucun animateur requis.',
  },
  {
    value: 'vote',
    icon: '🗳️',
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
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm mb-8 transition-colors" style={{ color: 'rgba(196,181,253,0.6)' }}>
          ← Retour
        </button>

        <h1 className="text-3xl font-black text-white mb-8">
          Nouvelle partie
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom */}
          <div className="card p-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: '#C4B5FD' }}>
              Nom de la partie
            </label>
            <input
              type="text" required maxLength={100}
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Ex : Quiz du vendredi soir"
              className="input text-lg font-semibold"
            />
          </div>

          {/* Mode */}
          <div className="card p-6">
            <p className="text-sm font-semibold mb-4" style={{ color: '#C4B5FD' }}>Mode de la partie</p>
            <div className="space-y-3">
              {MODES.map(m => (
                <label
                  key={m.value}
                  className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-150"
                  style={{
                    background: form.mode === m.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.mode === m.value ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: form.mode === m.value ? '0 0 16px rgba(124,58,237,0.15)' : 'none',
                  }}
                >
                  <input
                    type="radio" name="mode" value={m.value}
                    checked={form.mode === m.value}
                    onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                    className="mt-0.5 accent-violet-500"
                  />
                  <div>
                    <p className="font-bold text-white flex items-center gap-2">
                      <span>{m.icon}</span> {m.label}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(156,163,175,0.7)' }}>{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Timers */}
          {form.mode !== 'animateur' && (
            <div className="card p-6">
              <p className="text-sm font-semibold mb-4" style={{ color: '#C4B5FD' }}>Durées</p>
              <div className="grid grid-cols-2 gap-4">
                {form.mode === 'auto' && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'rgba(156,163,175,0.7)' }}>
                      Timer après buzz (s)
                    </label>
                    <input type="number" min={3} max={60} value={form.timerBuzz}
                      onChange={e => setForm(f => ({ ...f, timerBuzz: Number(e.target.value) }))}
                      className="input text-center text-xl font-bold"
                    />
                  </div>
                )}
                {form.mode === 'vote' && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'rgba(156,163,175,0.7)' }}>
                      Timer vote (s)
                    </label>
                    <input type="number" min={5} max={60} value={form.timerVote}
                      onChange={e => setForm(f => ({ ...f, timerVote: Number(e.target.value) }))}
                      className="input text-center text-xl font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#FB7185' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <button type="submit" disabled={loading || !form.nom.trim()} className="btn-primary w-full py-4 text-lg">
            {loading ? 'Création en cours...' : '🚀 Créer la partie'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
