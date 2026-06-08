import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  Search, Shield, ChevronLeft, ChevronRight, Loader2, UserPlus, X, Check,
  Trophy, Gamepad2, KeyRound, Trash2, Ban, CheckCircle2, Crown, Mail, AtSign, Phone, Calendar, UserMinus,
} from 'lucide-react'

const PLANS = ['FREE', 'PRO', 'ENTREPRISE', 'ECOLE']

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div className="fixed top-16 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fadeUp"
      style={{
        background: isErr ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
        border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`,
        color: isErr ? '#F87171' : '#4ADE80',
      }}>
      {isErr ? <X size={13} /> : <Check size={13} />} {toast.msg}
    </div>
  )
}

export default function AdminUsers() {
  const { apiFetch, user: me } = useAuth()
  const [users, setUsers]   = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)   // user id ouvert dans le panneau
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const limit = 50

  const [purging, setPurging] = useState(false)
  function showToast(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  async function purgeGuests() {
    if (!confirm('Supprimer les comptes invités inactifs depuis plus de 7 jours ?')) return
    setPurging(true)
    const res = await apiFetch('/admin/cleanup-guests', { method: 'POST', body: { days: 7 } })
    setPurging(false)
    if (res?.ok) { const d = await res.json(); showToast(`${d.deleted ?? 0} invité(s) supprimé(s)`); load() }
    else showToast('Purge impossible', 'error')
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit })
    if (search) params.set('q', search)
    const res = await apiFetch(`/admin/users?${params}`)
    if (res?.ok) {
      const d = await res.json()
      setUsers(d.users ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <Toast toast={toast} />

      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Utilisateurs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{total} utilisateur{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={purgeGuests} disabled={purging} className="btn-secondary btn-sm gap-1.5" title="Supprimer les invités inactifs > 7 jours">
            {purging ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}Purger les invités
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary btn-sm gap-1.5">
            <UserPlus size={14} />Nouvel utilisateur
          </button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
        <input type="text" placeholder="Rechercher (nom, pseudo, email)…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="input pl-8 text-sm w-full" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Utilisateur', 'Email', 'Plan', 'Parties', 'Statut', 'Inscrit'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: '#6366F1' }} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>Aucun utilisateur</td></tr>
            ) : users.map(u => (
              <tr key={u.id} onClick={() => setSelected(u.id)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-overlay)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      : <div className="w-8 h-8 rounded-lg flex items-center justify-center text-2xs font-bold text-white" style={{ background: '#6366F1' }}>
                          {(u.username?.[0] ?? u.prenom?.[0] ?? '?').toUpperCase()}
                        </div>}
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                        {u.prenom}{u.nom ? ` ${u.nom}` : ''}
                        {u.isAdmin && <Crown size={11} style={{ color: '#F59E0B' }} />}
                      </p>
                      {u.username && <p className="text-2xs" style={{ color: '#818CF8' }}>@{u.username}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: u.plan === 'FREE' ? 'var(--hover-overlay)' : 'rgba(99,102,241,0.15)',
                      color: u.plan === 'FREE' ? 'var(--text-muted)' : '#818CF8',
                    }}>{u.plan}</span>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {(u._count?.partiesCreees ?? 0)} / {(u._count?.participations ?? 0)}
                </td>
                <td className="px-4 py-3">
                  {u.isActive === false
                    ? <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>Désactivé</span>
                    : <span className="badge-active">Actif</span>}
                </td>
                <td className="px-4 py-3 text-2xs" style={{ color: 'var(--text-dim)' }}>
                  {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost btn-sm"><ChevronLeft size={14} /></button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-ghost btn-sm"><ChevronRight size={14} /></button>
        </div>
      )}

      {creating && (
        <CreateUserModal apiFetch={apiFetch} onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); showToast('Utilisateur créé') }}
          onError={msg => showToast(msg, 'error')} />
      )}

      {selected && (
        <UserDetailPanel id={selected} me={me} apiFetch={apiFetch}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
          showToast={showToast} />
      )}
    </AdminLayout>
  )
}

// ── Modal de création ─────────────────────────────────────────────────────────
function CreateUserModal({ apiFetch, onClose, onCreated, onError }) {
  const [form, setForm] = useState({ email: '', password: '', prenom: '', nom: '', username: '', telephone: '', plan: 'FREE', isAdmin: false })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setSaving(true)
    const body = {
      email: form.email.trim(), password: form.password, prenom: form.prenom.trim(),
      nom: form.nom.trim() || undefined, username: form.username.trim() || undefined,
      telephone: form.telephone.trim() || undefined, plan: form.plan, isAdmin: form.isAdmin,
    }
    const res = await apiFetch('/admin/users', { method: 'POST', body })
    setSaving(false)
    if (res?.ok) { onCreated() }
    else {
      const e = await res?.json().catch(() => ({}))
      const m = typeof e?.error === 'string' ? e.error : 'Erreur lors de la création'
      setErr(m); onError?.(m)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={submit} className="card p-6 max-w-md w-full animate-scaleIn space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}><UserPlus size={16} style={{ color: '#6366F1' }} />Nouvel utilisateur</h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm"><X size={14} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Prénom *</label><input className="input" required value={form.prenom} onChange={e => set('prenom', e.target.value)} /></div>
          <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => set('nom', e.target.value)} /></div>
        </div>
        <div><label className="label">Email *</label><input type="email" className="input" required value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Pseudo</label><input className="input font-mono" value={form.username} onChange={e => set('username', e.target.value)} /></div>
          <div><label className="label">Téléphone</label><input className="input" value={form.telephone} onChange={e => set('telephone', e.target.value)} /></div>
        </div>
        <div><label className="label">Mot de passe * (min. 6)</label><input type="text" className="input" required value={form.password} onChange={e => set('password', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><label className="label">Plan</label>
            <select className="input" value={form.plan} onChange={e => set('plan', e.target.value)}>{PLANS.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={form.isAdmin} onChange={e => set('isAdmin', e.target.checked)} />Administrateur
          </label>
        </div>
        {err && <p className="text-xs" style={{ color: '#F87171' }}>{err}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1 gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Créer
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Annuler</button>
        </div>
      </form>
    </div>
  )
}

// ── Panneau détail / édition ───────────────────────────────────────────────────
function UserDetailPanel({ id, me, apiFetch, onClose, onChanged, showToast }) {
  const [u, setU] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pwd, setPwd] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isSelf = u?.id === me?.id

  const load = useCallback(async () => {
    const res = await apiFetch(`/admin/users/${id}`)
    if (res?.ok) {
      const data = await res.json()
      setU(data)
      setForm({
        email: data.email ?? '', prenom: data.prenom ?? '', nom: data.nom ?? '',
        username: data.username ?? '', telephone: data.telephone ?? '', plan: data.plan ?? 'FREE',
      })
    }
  }, [id])
  useEffect(() => { load() }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function patch(body, okMsg) {
    setSaving(true)
    const res = await apiFetch(`/admin/users/${id}`, { method: 'PATCH', body })
    setSaving(false)
    if (res?.ok) { await load(); onChanged(); showToast(okMsg ?? 'Modifié') }
    else { const e = await res?.json().catch(() => ({})); showToast(typeof e?.error === 'string' ? e.error : 'Erreur', 'error') }
  }

  async function saveInfo(e) {
    e.preventDefault()
    await patch({
      email: form.email.trim(), prenom: form.prenom.trim(), nom: form.nom.trim() || null,
      username: form.username.trim() || null, telephone: form.telephone.trim() || null, plan: form.plan,
    }, 'Informations mises à jour')
  }

  async function resetPassword() {
    if (pwd.length < 6) { showToast('Mot de passe trop court (min. 6)', 'error'); return }
    const res = await apiFetch(`/admin/users/${id}/reset-password`, { method: 'POST', body: { newPassword: pwd } })
    if (res?.ok) { setPwd(''); showToast('Mot de passe réinitialisé') }
    else showToast('Erreur', 'error')
  }

  async function doDelete() {
    const res = await apiFetch(`/admin/users/${id}`, { method: 'DELETE' })
    if (res?.ok) { onChanged(); onClose(); showToast('Utilisateur supprimé', 'success') }
    else { const e = await res?.json().catch(() => ({})); showToast(typeof e?.error === 'string' ? e.error : 'Erreur', 'error') }
    setConfirmDelete(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto animate-fadeUp" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        {!u || !form ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }} /></div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ background: '#6366F1' }}>
                      {(u.username?.[0] ?? u.prenom?.[0] ?? '?').toUpperCase()}
                    </div>}
                <div>
                  <p className="font-bold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                    {u.prenom}{u.nom ? ` ${u.nom}` : ''}{u.isAdmin && <Crown size={12} style={{ color: '#F59E0B' }} />}
                  </p>
                  <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{u.username ? `@${u.username}` : 'sans pseudo'}</p>
                </div>
              </div>
              <button onClick={onClose} className="btn-ghost btn-sm"><X size={15} /></button>
            </div>

            {/* Méta */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card p-3 text-center"><Gamepad2 size={14} className="mx-auto" style={{ color: '#6366F1' }} /><p className="text-lg font-black mt-1" style={{ color: 'var(--text)' }}>{u._count?.partiesCreees ?? 0}</p><p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Créées</p></div>
              <div className="card p-3 text-center"><Gamepad2 size={14} className="mx-auto" style={{ color: '#8B5CF6' }} /><p className="text-lg font-black mt-1" style={{ color: 'var(--text)' }}>{u._count?.participations ?? 0}</p><p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Jouées</p></div>
              <div className="card p-3 text-center"><Trophy size={14} className="mx-auto" style={{ color: '#F59E0B' }} /><p className="text-lg font-black mt-1" style={{ color: 'var(--text)' }}>{u.victoires ?? 0}</p><p className="text-2xs" style={{ color: 'var(--text-dim)' }}>Victoires</p></div>
            </div>

            <div className="text-2xs space-y-1" style={{ color: 'var(--text-dim)' }}>
              <p className="flex items-center gap-1.5"><Calendar size={11} />Inscrit le {new Date(u.createdAt).toLocaleString('fr-FR')}</p>
              {u.lastSeenAt && <p className="flex items-center gap-1.5"><CheckCircle2 size={11} />Vu le {new Date(u.lastSeenAt).toLocaleString('fr-FR')}</p>}
            </div>

            {/* Édition infos */}
            <form onSubmit={saveInfo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom</label><input className="input" value={form.prenom} onChange={e => set('prenom', e.target.value)} /></div>
                <div><label className="label">Nom</label><input className="input" value={form.nom} onChange={e => set('nom', e.target.value)} /></div>
              </div>
              <div><label className="label flex items-center gap-1"><Mail size={11} />Email</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label flex items-center gap-1"><AtSign size={11} />Pseudo</label><input className="input font-mono" value={form.username} onChange={e => set('username', e.target.value)} /></div>
                <div><label className="label flex items-center gap-1"><Phone size={11} />Téléphone</label><input className="input" value={form.telephone} onChange={e => set('telephone', e.target.value)} /></div>
              </div>
              <div><label className="label">Plan</label>
                <select className="input" value={form.plan} onChange={e => set('plan', e.target.value)}>{PLANS.map(p => <option key={p}>{p}</option>)}</select>
              </div>
              <button type="submit" disabled={saving} className="btn-primary btn-sm w-full gap-1.5">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Enregistrer les informations
              </button>
            </form>

            {/* Actions rapides */}
            <div className="space-y-2 pt-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div className="flex gap-2">
                <button onClick={() => patch({ isAdmin: !u.isAdmin }, u.isAdmin ? 'Statut admin retiré' : 'Promu administrateur')}
                  disabled={isSelf && u.isAdmin}
                  className="btn-secondary btn-sm flex-1 gap-1.5" title={isSelf && u.isAdmin ? 'Vous ne pouvez pas vous retirer admin' : ''}>
                  <Shield size={13} />{u.isAdmin ? 'Retirer admin' : 'Rendre admin'}
                </button>
                <button onClick={() => patch({ isActive: !(u.isActive !== false) }, u.isActive !== false ? 'Compte désactivé' : 'Compte réactivé')}
                  disabled={isSelf}
                  className="btn-secondary btn-sm flex-1 gap-1.5"
                  style={{ color: u.isActive !== false ? '#F87171' : '#4ADE80' }}>
                  {u.isActive !== false ? <><Ban size={13} />Désactiver</> : <><CheckCircle2 size={13} />Réactiver</>}
                </button>
              </div>

              {/* Réinitialisation mot de passe */}
              <div className="flex gap-2">
                <input type="text" placeholder="Nouveau mot de passe" value={pwd} onChange={e => setPwd(e.target.value)}
                  className="input text-sm flex-1" />
                <button onClick={resetPassword} disabled={!pwd} className="btn-secondary btn-sm gap-1.5 shrink-0"><KeyRound size={13} />Réinit.</button>
              </div>

              {/* Suppression */}
              {!isSelf && (
                confirmDelete ? (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-xs mb-2" style={{ color: '#F87171' }}>Supprimer définitivement cet utilisateur ?</p>
                    <div className="flex gap-2">
                      <button onClick={doDelete} className="btn-danger btn-sm flex-1">Confirmer</button>
                      <button onClick={() => setConfirmDelete(false)} className="btn-ghost btn-sm flex-1">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="btn-danger btn-sm w-full gap-1.5"><Trash2 size={13} />Supprimer l'utilisateur</button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
