import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ prenom: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form.email, form.password, form.prenom)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#0F0A1E' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #F59E0B, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fadeIn">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl font-black text-white mb-4" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}>
            G
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(90deg,#C4B5FD,#F8F4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Gbairai
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(196,181,253,0.6)' }}>
            Un compte pour créer et rejoindre des parties
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg,#221445,#1A1035)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          <h2 className="text-xl font-bold text-white mb-2">Créer un compte</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.7)' }}>
            Pas de rôle — créez ou rejoignez selon vos envies.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#C4B5FD' }}>Prénom</label>
              <input
                type="text" required maxLength={50} autoComplete="given-name"
                placeholder="Affiché pendant les parties"
                value={form.prenom}
                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#C4B5FD' }}>Email</label>
              <input
                type="email" required autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#C4B5FD' }}>Mot de passe</label>
              <input
                type="password" required minLength={6} autoComplete="new-password"
                placeholder="6 caractères minimum"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#FB7185' }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'rgba(156,163,175,0.8)' }}>
            Déjà un compte ?{' '}
            <Link to="/login" className="font-semibold" style={{ color: '#C4B5FD' }}>
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
