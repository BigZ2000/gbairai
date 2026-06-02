import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader2, ArrowRight, Gamepad2, AlertCircle } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'

// Page PUBLIQUE de jonction (cible du QR / lien). Objectif : jouer en < 1 min.
// - Utilisateur déjà connecté → rejoint directement.
// - Sinon → un pseudo suffit (compte invité créé en arrière-plan).
export default function RejoindrePartie() {
  const { code: rawCode } = useParams()
  const code = (rawCode ?? '').toUpperCase()
  const { user, apiFetch, loginWithTokens } = useAuth()
  const navigate = useNavigate()

  const [partieNom, setPartieNom] = useState(null)
  const [status, setStatus] = useState(null)
  // Mémorise le dernier pseudo utilisé (retour = saisie déjà remplie).
  const [prenom, setPrenom] = useState(() => localStorage.getItem('gbairai_pseudo') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const autoTried = useRef(false)

  // Vérifie la partie au chargement.
  useEffect(() => {
    apiFetch(`/parties/check/${code}`).then(async r => {
      if (r?.ok) { const d = await r.json(); setPartieNom(d.nom); setStatus(d.status) }
      else { const e = await r?.json().catch(() => ({})); setError(e?.error ?? 'Code invalide') }
    }).finally(() => setChecking(false))
  }, [code])

  // Si déjà connecté, on rejoint automatiquement.
  useEffect(() => {
    if (user && partieNom && !autoTried.current) { autoTried.current = true; doJoin() }
  }, [user, partieNom])

  async function doJoin() {
    setBusy(true); setError('')
    const res = await apiFetch('/parties/join', { method: 'POST', body: { code } })
    if (!res?.ok) {
      const e = await res?.json().catch(() => ({}))
      setError(e?.error ?? 'Impossible de rejoindre'); setBusy(false); return
    }
    navigate(status === 'EN_COURS' ? `/parties/${code}/jeu` : `/parties/${code}/attente`, { replace: true })
  }

  async function handleGuest(e) {
    e.preventDefault()
    if (!prenom.trim()) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/auth/guest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom: prenom.trim() }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      localStorage.setItem('gbairai_pseudo', prenom.trim()) // mémorise pour la prochaine fois
      await loginWithTokens(data.access, data.refresh)
      await doJoin() // le token est désormais en place
    } catch {
      setError('Connexion impossible. Réessaie.'); setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg)' }}>
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <div className="card p-7 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(99,102,241,0.15)' }}>
          <Gamepad2 size={26} style={{ color: '#818CF8' }} />
        </div>

        {checking ? (
          <Loader2 size={24} className="animate-spin mx-auto my-4" style={{ color: '#6366F1' }} />
        ) : error && !partieNom ? (
          <>
            <h1 className="text-lg font-bold mb-2" style={{ color: '#ECECF0' }}>Partie introuvable</h1>
            <p className="text-sm mb-5 flex items-center justify-center gap-1.5" style={{ color: '#F87171' }}>
              <AlertCircle size={14} />{error}
            </p>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full">Aller au tableau de bord</button>
          </>
        ) : (
          <>
            <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Tu rejoins</p>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#ECECF0' }}>{partieNom}</h1>
            <p className="text-2xs font-mono mb-5" style={{ color: '#5A5A6E' }}>{code}</p>

            {user || busy ? (
              <div className="flex items-center justify-center gap-2 py-3" style={{ color: '#9090A0' }}>
                <Loader2 size={18} className="animate-spin" /> Connexion à la partie…
              </div>
            ) : (
              <form onSubmit={handleGuest} className="space-y-3">
                <input autoFocus value={prenom} onChange={e => setPrenom(e.target.value)} maxLength={30}
                  placeholder="Ton prénom / pseudo" className="input w-full text-center" />
                {error && <p className="text-sm" style={{ color: '#F87171' }}>{error}</p>}
                <button type="submit" disabled={!prenom.trim()} className="btn-primary w-full btn-lg gap-2">
                  Jouer <ArrowRight size={16} />
                </button>
                <p className="text-2xs" style={{ color: '#5A5A6E' }}>Pas besoin de compte — un pseudo suffit.</p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
