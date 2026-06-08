import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { MailCheck, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

// Page de vérification d'email :
//  • ?token=… (clic sur le lien du mail) → confirmation automatique.
//  • sinon → saisie du code à 6 chiffres reçu par mail.
export default function VerifierEmail() {
  const { user, apiFetch, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [code, setCode] = useState('')
  const [status, setStatus] = useState(token ? 'verifying' : 'idle') // idle|verifying|ok|error
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Vérification par LIEN (jeton) — au chargement.
  useEffect(() => {
    if (!token) return
    let alive = true
    fetch('/api/auth/verify-email-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async r => {
      if (!alive) return
      if (r.ok) { setStatus('ok'); refreshUser?.() }
      else { const e = await r.json().catch(() => ({})); setStatus('error'); setError(e.error ?? 'Lien invalide ou expiré') }
    }).catch(() => alive && (setStatus('error'), setError('Erreur réseau')))
    return () => { alive = false }
  }, [token])

  // Déjà vérifié → message de succès.
  useEffect(() => { if (user?.emailVerified) setStatus('ok') }, [user?.emailVerified])

  async function submitCode(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await apiFetch('/auth/verify-email', { method: 'POST', body: { code: code.trim() } })
    setBusy(false)
    if (r?.ok) { setStatus('ok'); await refreshUser?.() }
    else { const er = await r?.json().catch(() => ({})); setError(er?.error ?? 'Code incorrect') }
  }

  async function resend() {
    setBusy(true); setError('')
    const r = await apiFetch('/auth/resend-verification', { method: 'POST' })
    setBusy(false)
    if (r?.ok) { setResent(true); setTimeout(() => setResent(false), 4000) }
    else { const er = await r?.json().catch(() => ({})); setError(er?.error ?? 'Renvoi impossible') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm text-center">
        {status === 'ok' ? (
          <>
            <CheckCircle2 size={52} className="mx-auto mb-4" style={{ color: '#22C55E' }} />
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Email vérifié ! 🎉</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Ton compte est confirmé.</p>
            <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">Aller au tableau de bord</button>
          </>
        ) : status === 'verifying' ? (
          <><Loader2 size={36} className="animate-spin mx-auto mb-4" style={{ color: '#6366F1' }} />
            <p style={{ color: 'var(--text-muted)' }}>Vérification en cours…</p></>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <MailCheck size={26} style={{ color: '#818CF8' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Vérifie ton email</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Un code à 6 chiffres a été envoyé à<br /><strong style={{ color: 'var(--text)' }}>{user?.email}</strong>.
            </p>
            <form onSubmit={submitCode}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" inputMode="numeric" autoFocus
                className="input text-center text-2xl font-bold tracking-[0.4em] mb-3" />
              {error && <p className="text-sm mb-3" style={{ color: '#F87171' }}>{error}</p>}
              <button type="submit" disabled={code.length !== 6 || busy} className="btn-primary w-full mb-3">
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmer'}
              </button>
            </form>
            <button onClick={resend} disabled={busy} className="btn-ghost btn-sm gap-1.5">
              <RefreshCw size={13} />{resent ? 'Nouveau mail envoyé ✓' : 'Renvoyer le code'}
            </button>
            <div className="mt-5">
              <button onClick={() => navigate('/dashboard')} className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Plus tard →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
