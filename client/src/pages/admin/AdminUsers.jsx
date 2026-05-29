import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Search, Shield, ShieldOff, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export default function AdminUsers() {
  const { apiFetch } = useAuth()
  const [users, setUsers]   = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState(null)
  const limit = 50

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page, limit })
    if (search) params.set('q', search)
    const res = await apiFetch(`/admin/users?${params}`)
    if (res?.ok) {
      const d = await res.json()
      setUsers(d.users ?? [])
      setTotal(d.total ?? 0)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  async function toggleAdmin(user) {
    setToggling(user.id)
    const res = await apiFetch(`/admin/users/${user.id}`, { method: 'PATCH', body: { isAdmin: !user.isAdmin } })
    if (res?.ok) load()
    setToggling(null)
  }

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>Utilisateurs</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5A6E' }}>{total} utilisateur{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5A5A6E' }} />
        <input type="text" placeholder="Rechercher…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="input pl-8 text-sm w-full" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Prénom', 'Email', 'Username', 'Plan', 'Parties', 'Admin', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#5A5A6E' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium" style={{ color: '#ECECF0' }}>{u.prenom}</td>
                <td className="px-4 py-3" style={{ color: '#9090A0' }}>{u.email}</td>
                <td className="px-4 py-3" style={{ color: '#9090A0' }}>{u.username ? `@${u.username}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: u.plan === 'FREE' ? 'rgba(90,90,110,0.2)' : 'rgba(99,102,241,0.15)',
                      color: u.plan === 'FREE' ? '#5A5A6E' : '#818CF8',
                    }}>{u.plan}</span>
                </td>
                <td className="px-4 py-3" style={{ color: '#9090A0' }}>{u._count?.partiesCreees ?? 0}</td>
                <td className="px-4 py-3">
                  {u.isAdmin && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>Admin</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleAdmin(u)} disabled={toggling === u.id}
                    className="btn-ghost btn-sm gap-1.5 text-xs"
                    style={{ color: u.isAdmin ? '#F87171' : '#9090A0' }}
                    title={u.isAdmin ? 'Retirer admin' : 'Rendre admin'}>
                    {toggling === u.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : u.isAdmin ? <ShieldOff size={12} /> : <Shield size={12} />}
                    {u.isAdmin ? 'Retirer' : 'Admin'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#5A5A6E' }}>Aucun utilisateur</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost btn-sm">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm" style={{ color: '#9090A0' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-ghost btn-sm">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </AdminLayout>
  )
}
