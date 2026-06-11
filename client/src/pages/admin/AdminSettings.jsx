import React, { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Loader2, Mail, ShieldCheck, LogIn, Check, Smartphone, Send, Lightbulb } from 'lucide-react'

const LOGIN_PLANS = ['PRO', 'ENTREPRISE', 'ECOLE']

export default function AdminSettings() {
  const { apiFetch } = useAuth()
  const [s, setS] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { apiFetch('/admin/settings').then(r => r?.json()).then(setS) }, [])

  async function save(patch) {
    setSaving(true)
    const next = { ...s, ...patch }
    setS(next)
    const r = await apiFetch('/admin/settings', { method: 'PATCH', body: patch })
    setSaving(false)
    if (r?.ok) { const d = await r.json(); setS(d); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  function togglePlan(plan) {
    const cur = s.emailRequireVerifiedLoginPlans ?? []
    const next = cur.includes(plan) ? cur.filter(p => p !== plan) : [...cur, plan]
    save({ emailRequireVerifiedLoginPlans: next })
  }

  if (!s) return <AdminLayout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: 'var(--text-dim)' }} /></AdminLayout>

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Réglages</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Vérification d'email et sécurité des comptes.</p>
        </div>
        {saved && <span className="text-sm flex items-center gap-1.5" style={{ color: '#4ADE80' }}><Check size={14} />Enregistré</span>}
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Vérification email à l'inscription */}
        <Row icon={Mail} color="#6366F1" title="Vérifier l'email à l'inscription"
          desc="Envoie un code/lien de confirmation. Désactivé → les comptes par email sont validés automatiquement (aucun mail).">
          <Toggle on={s.emailVerifyOnRegister} onClick={() => save({ emailVerifyOnRegister: !s.emailVerifyOnRegister })} disabled={saving} />
        </Row>

        {/* Vérification téléphone (SMS) à l'inscription */}
        <Row icon={Smartphone} color="#22C55E" title="Vérifier le téléphone à l'inscription (SMS)"
          desc="Envoie un code OTP par SMS. Désactivé → les comptes par numéro sont validés automatiquement (aucun SMS).">
          <Toggle on={s.phoneVerifyOnRegister} onClick={() => save({ phoneVerifyOnRegister: !s.phoneVerifyOnRegister })} disabled={saving} />
        </Row>

        {/* Blocage des actions sensibles */}
        <Row icon={ShieldCheck} color="#0EA5E9" title="Bloquer les paiements tant que non vérifié"
          desc="Abonnement et achat de pack restent inaccessibles tant qu'aucun contact (email OU téléphone) n'est vérifié.">
          <Toggle on={s.emailBlockUnverifiedActions} onClick={() => save({ emailBlockUnverifiedActions: !s.emailBlockUnverifiedActions })} disabled={saving} />
        </Row>

        {/* Vérification à la connexion par plan */}
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <LogIn size={16} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Contact vérifié obligatoire à la connexion</h3>
              <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                Pour les types de comptes sélectionnés, la connexion exige un email ou un téléphone vérifié (un code est renvoyé sinon).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-12">
            {LOGIN_PLANS.map(plan => {
              const active = (s.emailRequireVerifiedLoginPlans ?? []).includes(plan)
              return (
                <button key={plan} onClick={() => togglePlan(plan)} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? 'rgba(245,158,11,0.18)' : 'var(--hover-overlay)',
                    color: active ? '#F59E0B' : 'var(--text-muted)',
                    border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                  }}>
                  {active && <Check size={11} className="inline mr-1" />}{plan}
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
          <Lightbulb size={12} className="inline mr-1 -mt-0.5" />Pour tester sans envoi réel : <code style={{ color: 'var(--text-muted)' }}>MAIL_ENABLED=false</code> (email) ou
          <code style={{ color: 'var(--text-muted)' }}> SMS_ENABLED=false</code> (SMS) côté serveur → le contenu est alors **logué dans la console**.
        </p>

        <TestSender apiFetch={apiFetch} />
      </div>
    </AdminLayout>
  )
}

// ── Banc de test d'envoi (email / SMS) ────────────────────────────────────────
function TestSender({ apiFetch }) {
  const [channel, setChannel] = useState('email')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('Test Gbairai')
  const [body, setBody] = useState('Test Gbairai : si tu reçois ce message, la configuration fonctionne ✅')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { ok, msg }

  async function send() {
    if (!to.trim()) return
    setSending(true); setResult(null)
    const r = await apiFetch('/admin/test-send', { method: 'POST', body: { channel, to: to.trim(), subject, body } })
    setSending(false)
    const d = await r?.json().catch(() => ({}))
    if (r?.ok) {
      setResult({ ok: true, msg: d.simulated
        ? `Mode simulé (${channel === 'sms' ? 'SMS_ENABLED' : 'MAIL_ENABLED'}=false) — contenu logué côté serveur, pas d'envoi réel.`
        : `Envoyé à ${d.to} ✓` })
    } else {
      setResult({ ok: false, msg: d?.error ?? 'Échec de l\'envoi' })
    }
  }

  return (
    <div className="card p-5 mt-2">
      <div className="flex items-center gap-2 mb-4">
        <Send size={15} style={{ color: '#A855F7' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Tester un envoi</h3>
      </div>

      {/* Canal */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg mb-3" style={{ background: 'var(--hover-overlay)' }}>
        {[['email', 'Email', Mail], ['sms', 'SMS', Smartphone]].map(([m, label, Icon]) => (
          <button key={m} onClick={() => { setChannel(m); setResult(null) }}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{ background: channel === m ? 'var(--surface)' : 'transparent', color: channel === m ? 'var(--text)' : 'var(--text-dim)', boxShadow: channel === m ? 'var(--shadow)' : 'none' }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      <label className="label">{channel === 'sms' ? 'Numéro de téléphone' : 'Adresse email'}</label>
      <input value={to} onChange={e => setTo(e.target.value)} className="input mb-3"
        placeholder={channel === 'sms' ? '07 01 02 03 04' : 'destinataire@exemple.com'} />

      {channel === 'email' && (
        <>
          <label className="label">Objet</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} className="input mb-3" />
        </>
      )}

      <label className="label">Message</label>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} className="input mb-3" />

      <button onClick={send} disabled={sending || !to.trim()} className="btn-primary btn-sm gap-1.5">
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Envoyer le test
      </button>

      {result && (
        <p className="text-sm mt-3" style={{ color: result.ok ? '#4ADE80' : '#F87171' }}>{result.msg}</p>
      )}
    </div>
  )
}

function Row({ icon: Icon, color, title, desc, children }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(color, 0.15) }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{desc}</p>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-11 h-6 rounded-full relative transition-all shrink-0"
      style={{ background: on ? '#6366F1' : 'var(--border-strong)', opacity: disabled ? 0.6 : 1 }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: on ? '22px' : '2px' }} />
    </button>
  )
}

function hex(c, a) { const x = c.replace('#', ''); return `rgba(${parseInt(x.slice(0,2),16)},${parseInt(x.slice(2,4),16)},${parseInt(x.slice(4,6),16)},${a})` }
