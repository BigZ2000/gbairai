import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Smartphone, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

// Vérification du numéro de téléphone par code OTP reçu par SMS.
export default function VerifierTelephone() {
  const { user, apiFetch, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | ok
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user?.phoneVerified) setStatus('ok') }, [user?.phoneVerified])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await apiFetch('/auth/verify-phone', { method: 'POST', body: { code: code.trim() } })
    setBusy(false)
    if (r?.ok) { setStatus('ok'); await refreshUser?.() }
    else { const er = await r?.json().catch(() => ({})); setError(er?.error ?? 'Code incorrect') }
  }

  async function resend() {
    setBusy(true); setError('')
    const r = await apiFetch('/auth/resend-phone', { method: 'POST' })
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
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Numéro vérifié !</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Ton compte est confirmé.</p>
            <button onClick={() => navigate('/dashboard')} className="btn-primary w-full">Aller au tableau de bord</button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
              <Smartphone size={26} style={{ color: '#22C55E' }} />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Vérifie ton numéro</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Un code à 6 chiffres a été envoyé par SMS au<br /><strong style={{ color: 'var(--text)' }}>{user?.telephone}</strong>.
            </p>
            <form onSubmit={submit}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" inputMode="numeric" autoFocus
                className="input text-center text-2xl font-bold tracking-[0.4em] mb-3" />
              {error && <p className="text-sm mb-3" style={{ color: '#F87171' }}>{error}</p>}
              <button type="submit" disabled={code.length !== 6 || busy} className="btn-primary w-full mb-3">
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Confirmer'}
              </button>
            </form>
            <button onClick={resend} disabled={busy} className="btn-ghost btn-sm gap-1.5">
              <RefreshCw size={13} />{resent ? 'Nouveau SMS envoyé ✓' : 'Renvoyer le code'}
            </button>
            <div className="mt-5">
              <button onClick={() => navigate('/dashboard')} className="text-sm" style={{ color: 'var(--text-dim)' }}>Plus tard →</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
