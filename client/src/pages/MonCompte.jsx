import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import { formatMac } from '../utils/mac.js'
import {
  Radio, Pencil, Unlink, Check, X, Link2, Wifi, WifiOff, Cpu, Palette, AtSign,
  User, Shield, Sliders, BarChart3, Sun, Moon, Monitor, LogOut, Trophy,
  Clock, Target, Gamepad2, Crown, Loader2,
} from 'lucide-react'

const COULEURS = ['#6366F1','#8B5CF6','#3B82F6','#06B6D4','#22C55E','#F59E0B','#EF4444','#EC4899']

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type !== 'warn' && toast.type !== 'error'
  const isErr = toast.type === 'error'
  return (
    <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fadeUp"
      style={{
        background: isErr ? 'rgba(239,68,68,0.12)' : ok ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
        border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : ok ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        color: isErr ? '#F87171' : ok ? '#4ADE80' : '#FCD34D',
      }}>
      {isErr ? <X size={13} /> : <Check size={13} />} {toast.msg}
    </div>
  )
}

const TABS = [
  { id: 'profil', label: 'Profil', icon: User },
  { id: 'securite', label: 'Sécurité', icon: Shield },
  { id: 'preferences', label: 'Préférences', icon: Sliders },
  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
  { id: 'buzzers', label: 'Buzzers', icon: Radio },
]

export default function MonCompte() {
  const { user, setUser, apiFetch } = useAuth()
  const [tab, setTab] = useState('profil')
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const initial = (user?.username?.[0] ?? user?.prenom?.[0] ?? '?').toUpperCase()

  return (
    <Layout>
      <Toast toast={toast} />

      {/* En-tête profil */}
      <div className="flex items-center gap-4 mb-6">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0"
            style={{ border: '1px solid var(--border)' }} />
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
            style={{ background: '#6366F1' }}>{initial}</div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {user?.prenom}{user?.nom ? ` ${user.nom}` : ''}
            </h1>
            {user?.isAdmin && <span className="badge-indigo"><Crown size={9} />Admin</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {user?.username && <span className="flex items-center gap-0.5" style={{ color: '#818CF8' }}><AtSign size={11} />{user.username}</span>}
            <span>·</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="btn btn-sm gap-1.5 shrink-0"
              style={{
                background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
                color: active ? '#A5B4FC' : 'var(--text-muted)',
                border: `1px solid ${active ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
              }}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      <div className="max-w-2xl">
        {tab === 'profil'      && <ProfilTab user={user} setUser={setUser} apiFetch={apiFetch} showToast={showToast} />}
        {tab === 'securite'    && <SecuriteTab apiFetch={apiFetch} showToast={showToast} />}
        {tab === 'preferences' && <PreferencesTab user={user} setUser={setUser} apiFetch={apiFetch} showToast={showToast} />}
        {tab === 'stats'       && <StatsTab apiFetch={apiFetch} />}
        {tab === 'buzzers'     && <BuzzersTab apiFetch={apiFetch} showToast={showToast} />}
      </div>
    </Layout>
  )
}

// ── Onglet Profil ─────────────────────────────────────────────────────────────
function ProfilTab({ user, setUser, apiFetch, showToast }) {
  const [form, setForm] = useState({
    prenom: user?.prenom ?? '', nom: user?.nom ?? '', username: user?.username ?? '',
    telephone: user?.telephone ?? '', avatarUrl: user?.avatarUrl ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save(e) {
    e.preventDefault()
    setErr(''); setSaving(true)
    const body = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim() || null,
      username: form.username.trim(),
      telephone: form.telephone.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
    }
    const res = await apiFetch('/profile', { method: 'PATCH', body })
    setSaving(false)
    if (!res?.ok) {
      const e = await res?.json().catch(() => ({}))
      setErr(typeof e?.error === 'string' ? e.error : 'Erreur lors de la mise à jour')
      return
    }
    const updated = await res.json()
    setUser(u => ({ ...u, ...updated }))
    showToast('Profil mis à jour')
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-4">
      <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <User size={15} style={{ color: '#6366F1' }} />Informations personnelles
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prénom</label>
          <input className="input" value={form.prenom} maxLength={50} onChange={e => set('prenom', e.target.value)} />
        </div>
        <div>
          <label className="label">Nom</label>
          <input className="input" value={form.nom} maxLength={50} onChange={e => set('nom', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Pseudo</label>
        <input className="input font-mono" value={form.username} maxLength={30}
          onChange={e => set('username', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.telephone} maxLength={30}
            placeholder="+225…" onChange={e => set('telephone', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={user?.email ?? ''} disabled
            style={{ opacity: 0.6 }} />
        </div>
      </div>

      <div>
        <label className="label">Photo de profil (URL)</label>
        <input className="input" value={form.avatarUrl} maxLength={500}
          placeholder="https://…" onChange={e => set('avatarUrl', e.target.value)} />
      </div>

      {err && <p className="text-xs" style={{ color: '#F87171' }}>{err}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary btn-sm gap-1.5">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Enregistrer
        </button>
      </div>
    </form>
  )
}

// ── Onglet Sécurité ───────────────────────────────────────────────────────────
function SecuriteTab({ apiFetch, showToast }) {
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdErr, setPwdErr] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [sessions, setSessions] = useState(null)
  const currentRefresh = localStorage.getItem('refresh') ?? ''

  async function loadSessions() {
    const res = await apiFetch(`/profile/sessions?current=${encodeURIComponent(currentRefresh)}`)
    if (res?.ok) setSessions(await res.json())
  }
  useEffect(() => { loadSessions() }, [])

  async function changePassword(e) {
    e.preventDefault()
    setPwdErr('')
    if (pwd.next.length < 6) { setPwdErr('Le nouveau mot de passe doit faire au moins 6 caractères'); return }
    if (pwd.next !== pwd.confirm) { setPwdErr('Les mots de passe ne correspondent pas'); return }
    setPwdSaving(true)
    const res = await apiFetch('/profile/password', {
      method: 'POST',
      body: { currentPassword: pwd.current || undefined, newPassword: pwd.next },
    })
    setPwdSaving(false)
    if (!res?.ok) {
      const e = await res?.json().catch(() => ({}))
      setPwdErr(typeof e?.error === 'string' ? e.error : 'Erreur')
      return
    }
    setPwd({ current: '', next: '', confirm: '' })
    showToast('Mot de passe modifié')
  }

  async function logoutOthers() {
    const res = await apiFetch('/profile/sessions/others', { method: 'DELETE', body: { current: currentRefresh } })
    if (res?.ok) { showToast('Autres appareils déconnectés', 'warn'); loadSessions() }
  }

  function deviceLabel(ua) {
    if (!ua) return 'Appareil inconnu'
    if (/iphone/i.test(ua)) return 'iPhone'
    if (/ipad/i.test(ua)) return 'iPad'
    if (/android/i.test(ua)) return 'Android'
    if (/mac/i.test(ua)) return 'Mac'
    if (/windows/i.test(ua)) return 'Windows'
    if (/linux/i.test(ua)) return 'Linux'
    return ua.slice(0, 40)
  }

  return (
    <div className="space-y-5">
      {/* Mot de passe */}
      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Shield size={15} style={{ color: '#6366F1' }} />Changer le mot de passe
        </h2>
        <div>
          <label className="label">Mot de passe actuel</label>
          <input type="password" className="input" value={pwd.current}
            onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nouveau</label>
            <input type="password" className="input" value={pwd.next}
              onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirmer</label>
            <input type="password" className="input" value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} />
          </div>
        </div>
        {pwdErr && <p className="text-xs" style={{ color: '#F87171' }}>{pwdErr}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={pwdSaving} className="btn-primary btn-sm gap-1.5">
            {pwdSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Modifier
          </button>
        </div>
      </form>

      {/* Sessions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Monitor size={15} style={{ color: '#6366F1' }} />Sessions actives
          </h2>
          <button onClick={logoutOthers} className="btn-danger btn-sm gap-1.5">
            <LogOut size={12} />Déconnecter les autres
          </button>
        </div>
        {sessions === null ? (
          <Loader2 size={16} className="animate-spin" style={{ color: '#6366F1' }} />
        ) : sessions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Aucune session active.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg p-3"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                    {deviceLabel(s.userAgent)}
                    {s.current && <span className="badge-active">Cet appareil</span>}
                  </p>
                  <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {s.ip ?? 'IP inconnue'} · vu {new Date(s.lastUsedAt).toLocaleString('fr-FR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Onglet Préférences ────────────────────────────────────────────────────────
function PreferencesTab({ user, setUser, apiFetch, showToast }) {
  const [theme, setTheme] = useState(user?.theme === 'light' ? 'light' : 'dark')
  const [langue, setLangue] = useState(user?.langue ?? 'fr')
  const [saving, setSaving] = useState(false)

  async function save(next) {
    setSaving(true)
    const body = { theme: next.theme ?? theme, langue: next.langue ?? langue }
    const res = await apiFetch('/profile', { method: 'PATCH', body })
    setSaving(false)
    if (res?.ok) {
      const updated = await res.json()
      setUser(u => ({ ...u, ...updated }))
      showToast('Préférences enregistrées')
    }
  }

  function pickTheme(t) {
    setTheme(t)
    // Application immédiate (effet visuel sans attendre le serveur).
    document.documentElement.setAttribute('data-theme', t)
    save({ theme: t })
  }

  return (
    <div className="card p-5 space-y-5">
      <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <Palette size={15} style={{ color: '#6366F1' }} />Apparence
      </h2>

      <div>
        <label className="label">Thème</label>
        <div className="grid grid-cols-2 gap-3">
          {[{ id: 'dark', label: 'Sombre', icon: Moon }, { id: 'light', label: 'Clair', icon: Sun }].map(t => {
            const Icon = t.icon
            const active = theme === t.id
            return (
              <button key={t.id} onClick={() => pickTheme(t.id)} disabled={saving}
                className="flex items-center gap-2.5 rounded-xl p-3.5 transition-all"
                style={{
                  background: active ? 'rgba(99,102,241,0.1)' : 'var(--input-bg)',
                  border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                }}>
                <Icon size={18} style={{ color: active ? '#818CF8' : 'var(--text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.label}</span>
                {active && <Check size={14} className="ml-auto" style={{ color: '#818CF8' }} />}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label">Langue</label>
        <select className="input" value={langue}
          onChange={e => { setLangue(e.target.value); save({ langue: e.target.value }) }}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  )
}

// ── Onglet Statistiques ───────────────────────────────────────────────────────
function StatsTab({ apiFetch }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    apiFetch('/profile/stats').then(r => r?.ok ? r.json() : null).then(setStats)
  }, [])

  if (!stats) return <Loader2 size={18} className="animate-spin" style={{ color: '#6366F1' }} />

  const cards = [
    { label: 'Parties jouées', value: stats.partiesJouees, icon: Gamepad2, color: '#6366F1' },
    { label: 'Parties gagnées', value: stats.partiesGagnees, icon: Trophy, color: '#F59E0B' },
    { label: 'Parties créées', value: stats.partiesCreees, icon: Crown, color: '#8B5CF6' },
    { label: 'Meilleur score', value: stats.meilleurScore, icon: Target, color: '#22C55E' },
    { label: 'Taux de victoire', value: `${stats.tauxVictoire}%`, icon: BarChart3, color: '#EC4899' },
    { label: 'Temps de jeu', value: `${stats.tempsTotalMin} min`, icon: Clock, color: '#06B6D4' },
    { label: 'Rang moyen', value: stats.rangMoyen != null ? `#${stats.rangMoyen}` : '—', icon: Crown, color: '#3B82F6' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <div key={c.label} className="card p-4">
            <Icon size={16} style={{ color: c.color }} />
            <p className="text-2xl font-black mt-2" style={{ color: 'var(--text)' }}>{c.value}</p>
            <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{c.label}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Onglet Buzzers ────────────────────────────────────────────────────────────
function BuzzersTab({ apiFetch, showToast }) {
  const { subscribe } = useWs()
  const [buzzers, setBuzzers] = useState([])
  const [claimMac, setClaimMac] = useState('')
  const [claimError, setClaimError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editNom, setEditNom] = useState('')
  const [editCouleur, setEditCouleur] = useState('')
  const [releaseConfirm, setReleaseConfirm] = useState(null)

  useEffect(() => {
    apiFetch('/buzzers').then(r => r?.json()).then(b => { if (Array.isArray(b)) setBuzzers(b) })
  }, [])

  // Notifications temps réel du propriétaire (présence + tentatives de claim).
  useEffect(() => {
    const setStatut = (mac, status) =>
      setBuzzers(prev => prev.map(b => b.mac === mac ? { ...b, status } : b))
    const nomDe = mac => buzzers.find(b => b.mac === mac)?.nom ?? mac
    const unsub = subscribe('moncompte_buzzers', (msg) => {
      switch (msg.type) {
        case 'buzzer_status_update':
          setStatut(msg.mac, msg.status)
          break
        case 'buzzer_online':
          setStatut(msg.mac, 'ONLINE')
          showToast(`${msg.nom ?? nomDe(msg.mac)} est en ligne`)
          break
        case 'buzzer_offline':
          setStatut(msg.mac, 'OFFLINE')
          showToast(`${msg.nom ?? nomDe(msg.mac)} est hors ligne`, 'warn')
          break
        case 'claim_attempt':
          showToast(msg.message ?? 'Tentative de réclamation de votre buzzer', 'warn')
          break
      }
    })
    return unsub
  }, [subscribe, buzzers])

  async function handleClaim(e) {
    e.preventDefault()
    setClaimError('')
    const res = await apiFetch('/buzzers/claim', { method: 'POST', body: { mac: claimMac.toUpperCase() } })
    if (!res?.ok) {
      const err = await res?.json().catch(() => ({}))
      setClaimError(err?.error ?? 'Erreur'); return
    }
    const buzzer = await res.json()
    setBuzzers(prev => [...prev.filter(b => b.mac !== buzzer.mac), buzzer])
    setClaimMac(''); showToast('Buzzer appairé')
  }

  async function handleSaveEdit(mac) {
    const res = await apiFetch(`/buzzers/${mac}`, {
      method: 'PATCH', body: { nom: editNom.trim() || undefined, couleur: editCouleur || undefined },
    })
    if (res?.ok) {
      const updated = await res.json()
      setBuzzers(prev => prev.map(b => b.mac === mac ? updated : b))
      showToast('Buzzer mis à jour')
    }
    setEditingId(null)
  }

  async function handleRelease(mac) {
    const res = await apiFetch(`/buzzers/${mac}/claim`, { method: 'DELETE' })
    if (res?.ok) { setBuzzers(prev => prev.filter(b => b.mac !== mac)); showToast('Buzzer libéré', 'warn') }
    setReleaseConfirm(null)
  }

  function getBuzzerStatut(b) {
    if (b.status === 'IN_GAME') return 'pressed'
    if (b.status === 'OFFLINE' || b.status === 'AWAITING_CLAIM') return 'offline'
    return 'ready'
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-5">
        <Radio size={15} style={{ color: '#6366F1' }} />
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Mes buzzers</h2>
      </div>

      {buzzers.length === 0 ? (
        <p className="text-sm mb-5" style={{ color: 'var(--text-dim)' }}>Aucun buzzer appairé pour l'instant.</p>
      ) : (
        <ul className="space-y-2.5 mb-5">
          {buzzers.map(b => (
            <li key={b.id} className="rounded-lg p-4"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
              {editingId === b.id ? (
                <div className="space-y-3">
                  <input type="text" placeholder="Nom du buzzer" value={editNom} maxLength={50}
                    onChange={e => setEditNom(e.target.value)} className="input" />
                  <div>
                    <p className="label flex items-center gap-1"><Palette size={11} />Couleur</p>
                    <div className="flex gap-2 flex-wrap">
                      {COULEURS.map(c => (
                        <button key={c} type="button" onClick={() => setEditCouleur(c)}
                          className="w-7 h-7 rounded-full transition-transform"
                          style={{
                            background: c, transform: editCouleur === c ? 'scale(1.2)' : 'scale(1)',
                            outline: editCouleur === c ? `2px solid ${c}` : 'none', outlineOffset: '2px',
                          }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(b.mac)} className="btn-primary btn-sm gap-1"><Check size={12} />Enregistrer</button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm gap-1"><X size={12} />Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="sm" />
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{b.nom ?? 'Sans nom'}</p>
                      <p className="text-2xs font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>{b.mac}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {b.status === 'ONLINE' || b.status === 'IN_GAME'
                          ? <Wifi size={10} style={{ color: b.status === 'IN_GAME' ? '#F59E0B' : '#22C55E' }} />
                          : <WifiOff size={10} style={{ color: 'var(--text-dim)' }} />}
                        <span className="text-2xs font-medium" style={{
                          color: b.status === 'ONLINE' ? '#22C55E' : b.status === 'IN_GAME' ? '#F59E0B' : b.status === 'AWAITING_CLAIM' ? '#818CF8' : 'var(--text-dim)'
                        }}>
                          {b.status === 'ONLINE' ? 'Connecté' : b.status === 'IN_GAME' ? 'En jeu' : b.status === 'AWAITING_CLAIM' ? 'Appairage…' : 'Hors ligne'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setEditingId(b.id); setEditNom(b.nom ?? ''); setEditCouleur(b.couleur) }}
                      className="btn-ghost btn-sm" title="Renommer"><Pencil size={13} /></button>
                    <button onClick={() => setReleaseConfirm(b)} disabled={b.status === 'IN_GAME'}
                      className="btn-danger btn-sm" title="Libérer"><Unlink size={13} /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg p-4" style={{ background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.2)' }}>
        <p className="text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          <Link2 size={13} style={{ color: '#6366F1' }} />Ajouter un buzzer
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
          Entrez l'adresse MAC inscrite sous le buzzer, puis maintenez le bouton 3 s.
        </p>
        <form onSubmit={handleClaim} className="flex gap-2">
          <div className="relative flex-1">
            <Cpu size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <input type="text" value={claimMac} placeholder="AA:BB:CC:DD:EE:FF"
              inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={17}
              onChange={e => setClaimMac(formatMac(e.target.value))} className="input pl-8 font-mono text-sm" />
          </div>
          <button type="submit" disabled={!claimMac.trim()} className="btn-primary btn-sm shrink-0">Appairer</button>
        </form>
        {claimError && <p className="text-xs mt-2" style={{ color: '#F87171' }}>{claimError}</p>}
      </div>

      {releaseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-xs w-full animate-scaleIn" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-semibold mb-1" style={{ color: '#F87171' }}>Libérer ce buzzer ?</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>{releaseConfirm.nom ?? releaseConfirm.mac}</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Il pourra être réclamé par quelqu'un d'autre. Action irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleRelease(releaseConfirm.mac)} className="btn-danger flex-1">Confirmer</button>
              <button onClick={() => setReleaseConfirm(null)} className="btn-ghost flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
