import React, { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Trash2, Pencil, X, Check, Loader2 } from 'lucide-react'

export default function AdminCategories() {
  const { apiFetch } = useAuth()
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  // Gestion des rubriques (dans la modale d'édition)
  const [rubriques, setRubriques] = useState([])
  const [newRubrique, setNewRubrique] = useState('')
  const [rubriqueBusy, setRubriqueBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await apiFetch('/categories')
    if (res?.ok) {
      const data = await res.json()
      setCategories(data)
      // Garder la liste de rubriques de la modale synchronisée si une catégorie est en édition
      setEditing(cur => {
        if (cur?.id) {
          const fresh = data.find(c => c.id === cur.id)
          if (fresh) setRubriques(fresh.rubriques ?? [])
        }
        return cur
      })
    }
  }

  function openEdit(c) {
    setEditing(c ? { ...c } : { nom: '', emoji: '', description: '' })
    setRubriques(c?.rubriques ?? [])
    setNewRubrique('')
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
    if (!confirm('Supprimer cette catégorie ? Les rubriques liées seront supprimées et les questions associées perdront leur catégorie.')) return
    await apiFetch(`/categories/${id}`, { method: 'DELETE' })
    load()
  }

  async function addRubrique() {
    const nom = newRubrique.trim()
    if (!nom || !editing?.id) return
    setRubriqueBusy(true)
    const res = await apiFetch(`/categories/${editing.id}/rubriques`, { method: 'POST', body: { nom } })
    if (res?.ok) {
      const r = await res.json()
      setRubriques(prev => [...prev, { ...r, _count: { questions: 0 } }])
      setNewRubrique('')
      load()
    }
    setRubriqueBusy(false)
  }

  async function renameRubrique(r) {
    const nom = prompt('Nouveau nom de la rubrique', r.nom)
    if (!nom || !nom.trim() || nom.trim() === r.nom) return
    const res = await apiFetch(`/categories/${editing.id}/rubriques/${r.id}`, { method: 'PATCH', body: { nom: nom.trim() } })
    if (res?.ok) {
      setRubriques(prev => prev.map(x => x.id === r.id ? { ...x, nom: nom.trim() } : x))
      load()
    }
  }

  async function deleteRubrique(r) {
    if (!confirm(`Supprimer la rubrique « ${r.nom} » ? Les questions associées perdront leur rubrique.`)) return
    const res = await apiFetch(`/categories/${editing.id}/rubriques/${r.id}`, { method: 'DELETE' })
    if (res?.ok) {
      setRubriques(prev => prev.filter(x => x.id !== r.id))
      load()
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Catégories</h1>
        <button onClick={() => openEdit(null)} className="btn-primary gap-2">
          <Plus size={14} />Nouvelle catégorie
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['', 'Nom', 'Description', 'Rubriques', 'Questions', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--input-bg)' }}
                className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-xl w-12">{c.emoji}</td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{c.nom}</td>
                <td className="px-4 py-3 text-sm max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.description}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {c._count?.rubriques ?? c.rubriques?.length ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {c._count?.questions ?? c.questions?.length ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(c)} className="btn-ghost btn-sm"><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(c.id)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>Aucune catégorie</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 w-full max-w-md animate-scaleIn space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
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
            {editing.id && (
              <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <label className="label">Rubriques</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {rubriques.map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded px-2 py-1.5"
                      style={{ background: 'var(--hover-overlay)' }}>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {r.nom}
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                          {r._count?.questions ?? 0} question{(r._count?.questions ?? 0) > 1 ? 's' : ''}
                        </span>
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => renameRubrique(r)} className="btn-ghost btn-sm"><Pencil size={11} /></button>
                        <button onClick={() => deleteRubrique(r)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {rubriques.length === 0 && (
                    <p className="text-xs py-1" style={{ color: 'var(--text-dim)' }}>Aucune rubrique</p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <input type="text" value={newRubrique} onChange={e => setNewRubrique(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRubrique() } }}
                    placeholder="Nouvelle rubrique" maxLength={80} className="input flex-1" />
                  <button onClick={addRubrique} disabled={rubriqueBusy || !newRubrique.trim()} className="btn-secondary gap-1">
                    {rubriqueBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  </button>
                </div>
              </div>
            )}

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
