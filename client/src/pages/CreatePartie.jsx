import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const MODES = [
  {
    value: 'animateur',
    label: 'Avec animateur',
    description: 'Vous validez chaque réponse manuellement. Contrôle total sur le déroulement.',
  },
  {
    value: 'auto',
    label: 'Automatique',
    description: 'Pas besoin d\'animateur. La partie avance seule grâce au timer après chaque buzz.',
  },
  {
    value: 'vote',
    label: 'Vote collectif',
    description: 'Les joueurs votent ensemble pour valider ou invalider chaque réponse.',
  },
]

export default function CreatePartie() {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nom: '',
    mode: 'animateur',
    timerBuzz: 10,
    timerVote: 15,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/parties', { method: 'POST', body: form })
      if (!res?.ok) {
        const err = await res?.json()
        setError(err?.error ?? 'Erreur lors de la création')
        return
      }
      const partie = await res.json()
      navigate(`/parties/${partie.code}/attente`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-6">
          ← Retour
        </button>

        <h1 className="text-3xl font-bold mb-8 text-purple-400">Nouvelle partie</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nom */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Nom de la partie</label>
            <input
              type="text" required maxLength={100}
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Ex: Quiz du vendredi soir"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Mode de la partie</label>
            <div className="space-y-3">
              {MODES.map(m => (
                <label
                  key={m.value}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    form.mode === m.value
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    checked={form.mode === m.value}
                    onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                    className="mt-1 accent-purple-500"
                  />
                  <div>
                    <p className="font-semibold text-white">{m.label}</p>
                    <p className="text-sm text-gray-400 mt-1">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Timers (selon mode) */}
          {form.mode !== 'animateur' && (
            <div className="grid grid-cols-2 gap-4">
              {form.mode === 'auto' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Timer après buzz (s)
                  </label>
                  <input
                    type="number" min={3} max={60}
                    value={form.timerBuzz}
                    onChange={e => setForm(f => ({ ...f, timerBuzz: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              {form.mode === 'vote' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Timer vote (s)
                  </label>
                  <input
                    type="number" min={5} max={60}
                    value={form.timerVote}
                    onChange={e => setForm(f => ({ ...f, timerVote: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-lg"
          >
            {loading ? 'Création...' : 'Créer la partie'}
          </button>
        </form>
      </div>
    </div>
  )
}
