import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Smartphone, Lock, KeyRound, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'

const STEPS = { IDENTIFY: 'identify', OTP: 'otp', DONE: 'done' }

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [method, setMethod] = useState('email')
  const [identifier, setIdentifier] = useState('')
  const [channel, setChannel] = useState(null)   // 'email' | 'sms'
  const [hint, setHint] = useState('')
  const [code, setCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [step, setStep] = useState(STEPS.IDENTIFY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = method === 'email'
        ? { email: identifier.trim() }
        : { telephone: identifier.trim() }
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      setChannel(data.channel)
      setHint(data.hint ?? '')
      setStep(STEPS.OTP)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    if (newPwd.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères'); return }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      const body = method === 'email'
        ? { email: identifier.trim(), code: code.trim(), newPassword: newPwd }
        : { telephone: identifier.trim(), code: code.trim(), newPassword: newPwd }
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      setStep(STEPS.DONE)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="fixed top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm animate-fadeUp">

        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mb-4"
            style={{ background: '#6366F1', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>G</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {step === STEPS.DONE ? 'Mot de passe réinitialisé' : 'Mot de passe oublié'}
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
            {step === STEPS.IDENTIFY && 'Saisis ton email ou téléphone pour recevoir un code.'}
            {step === STEPS.OTP && `Code envoyé${hint ? ` sur ${hint}` : ''}. Entre-le ci-dessous.`}
            {step === STEPS.DONE && 'Tu peux maintenant te connecter avec ton nouveau mot de passe.'}
          </p>
        </div>

        {/* ── Étape 1 : identification ── */}
        {step === STEPS.IDENTIFY && (
          <div className="card p-6 space-y-4">
            {/* Toggle email / téléphone */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: 'var(--hover-overlay)' }}>
              {[['email', 'Email', Mail], ['phone', 'Téléphone', Smartphone]].map(([m, label, Icon]) => (
                <button key={m} type="button" onClick={() => { setMethod(m); setIdentifier(''); setError('') }}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: method === m ? 'var(--surface)' : 'transparent',
                    color: method === m ? 'var(--text)' : 'var(--text-dim)',
                    boxShadow: method === m ? 'var(--shadow)' : 'none',
                  }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            <form onSubmit={requestCode} className="space-y-3">
              <div>
                <label className="label">{method === 'phone' ? 'Numéro de téléphone' : 'Email'}</label>
                <div className="relative">
                  {method === 'phone'
                    ? <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                    : <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />}
                  <input
                    type={method === 'phone' ? 'tel' : 'email'} required
                    value={identifier} onChange={e => setIdentifier(e.target.value)}
                    placeholder={method === 'phone' ? '07 01 02 03 04' : 'vous@exemple.com'}
                    className="input pl-9"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
                </div>
              )}

              <button type="submit" disabled={loading || !identifier.trim()} className="btn-primary w-full btn-lg mt-1">
                {loading ? <Loader2 size={15} className="animate-spin" /> : 'Envoyer le code'}
              </button>
            </form>
          </div>
        )}

        {/* ── Étape 2 : OTP + nouveau mot de passe ── */}
        {step === STEPS.OTP && (
          <form onSubmit={resetPassword} className="card p-6 space-y-4">
            <div>
              <label className="label">Code reçu ({channel === 'sms' ? 'SMS' : 'email'})</label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input
                  type="text" inputMode="numeric" required maxLength={6}
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="input pl-9 font-mono tracking-widest text-center text-lg"
                />
              </div>
            </div>

            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input type="password" required autoComplete="new-password"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="6 caractères minimum" className="input pl-9" />
              </div>
            </div>

            <div>
              <label className="label">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                <input type="password" required autoComplete="new-password"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Répéter le mot de passe" className="input pl-9" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading || code.length !== 6 || !newPwd || !confirmPwd}
              className="btn-primary w-full btn-lg">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Réinitialiser le mot de passe'}
            </button>

            <button type="button" onClick={() => { setStep(STEPS.IDENTIFY); setError('') }}
              className="btn-ghost w-full btn-sm gap-1.5">
              <ArrowLeft size={13} />Modifier l'identifiant
            </button>
          </form>
        )}

        {/* ── Étape 3 : succès ── */}
        {step === STEPS.DONE && (
          <div className="card p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <CheckCircle2 size={28} style={{ color: '#4ADE80' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Ton mot de passe a été réinitialisé avec succès.
            </p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full btn-lg">
              Se connecter
            </button>
          </div>
        )}

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-dim)' }}>
          <Link to="/login" className="flex items-center justify-center gap-1.5 font-medium transition-colors"
            style={{ color: '#818CF8' }}>
            <ArrowLeft size={13} />Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
