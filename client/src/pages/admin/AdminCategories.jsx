import React, { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Trash2, Pencil, X, Check, Loader2 } from 'lucide-react'

export default function AdminCategories() {
  const { apiFetch } = useAuth()
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await apiFetch('/categories')
    if (res?.ok) setCategories(await res.json())
  }

  async function handleSave() {
    if (!editing?.nom?.trim()) return
    setSaving(true)
    const url    = editing.id ? `/categories/${editing.id}` : '/categories'
    const method = editing.id ? 'PATCH' : 'POST'
    const res = await apiFetch(url, { method, body: { nom: editing.nom, emoji: editing.emoji, description: editing.description } })
    if (res?.ok) { setEditing(null); load() }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette catégorie ? Les questions associées perdront leur catégorie.')) return
    await apiFetch(`/categories/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>Catégories</h1>
        <button onClick={() => setEditing({ nom: '', emoji: '', description: '' })} className="btn-primary gap-2">
          <Plus size={14} />Nouvelle catégorie
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['', 'Nom', 'Description', 'Questions', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#5A5A6E' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xl w-12">{c.emoji}</td>
                <td className="px-4 py-3 font-medium" style={{ color: '#ECECF0' }}>{c.nom}</td>
                <td className="px-4 py-3 text-sm max-w-xs truncate" style={{ color: '#9090A0' }}>{c.description}</td>
                <td className="px-4 py-3 text-sm" style={{ color: '#9090A0' }}>
                  {c._count?.questions ?? c.questions?.length ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditing({ ...c })} className="btn-ghost btn-sm"><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(c.id)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: '#5A5A6E' }}>Aucune catégorie</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 w-full max-w-md animate-scaleIn space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#ECECF0' }}>
                {editing.id ? 'Modifier' : 'Nouvelle catégorie'}
              </h2>
              <button onClick={() => setEditing(null)} className="btn-ghost btn-sm"><X size={14} /></button>
            </div>
            <div>
              <label className="label">Emoji</label>
              <input type="text" value={editing.emoji ?? ''} onChange={e => setEditing(f => ({ ...f, emoji: e.target.value }))}
                maxLength={4} className="input text-2xl w-20 text-center" />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input type="text" value={editing.nom} onChange={e => setEditing(f => ({ ...f, nom: e.target.value }))}
                maxLength={100} className="input w-full" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={editing.description ?? ''} onChange={e => setEditing(f => ({ ...f, description: e.target.value }))}
                rows={2} className="input w-full resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="btn-ghost">Annuler</button>
              <button onClick={handleSave} disabled={saving || !editing.nom?.trim()} className="btn-primary gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
