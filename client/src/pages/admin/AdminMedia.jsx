import React, { useState, useEffect, useRef, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { MediaPreview } from '../../components/MediaPicker.jsx'
import { Upload, Search, Trash2, X, Loader2, Image as ImageIcon, Music, Video, Check } from 'lucide-react'

const TYPES = ['', 'IMAGE', 'AUDIO', 'VIDEO']
const TYPE_LABEL = { '': 'Tous', IMAGE: 'Images', AUDIO: 'Audio', VIDEO: 'Vidéos' }
const TYPE_ICON  = { IMAGE: ImageIcon, AUDIO: Music, VIDEO: Video }
const TYPE_COLOR = { IMAGE: '#F87171', AUDIO: '#C084FC', VIDEO: '#2DD4BF' }

function humanSize(bytes) {
  if (!bytes) return ''
  const u = ['o', 'Ko', 'Mo', 'Go']
  let i = 0, n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

export default function AdminMedia() {
  const { apiFetch, apiUpload } = useAuth()
  const fileRef = useRef(null)
  const [items, setItems]     = useState([])
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const PER = 60
  const [type, setType]       = useState('')
  const [q, setQ]             = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected]   = useState(null) // détail média
  const [savingTitle, setSavingTitle] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PER), page: String(page) })
    if (type) params.set('type', type)
    if (q)    params.set('q', q)
    const res = await apiFetch(`/media?${params}`)
    if (res?.ok) { const d = await res.json(); setItems(d.media ?? []); setTotal(d.total ?? 0) }
    setLoading(false)
  }, [type, q, page, apiFetch])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  // Retour à la page 1 quand on change de filtre/recherche.
  useEffect(() => { setPage(1) }, [type, q])

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      await apiUpload('/media/upload', fd)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  async function handleDelete(m) {
    const used = m._count?.questions ?? 0
    const warn = used > 0
      ? `Ce média est utilisé par ${used} question(s). Elles perdront leur média. Supprimer quand même ?`
      : 'Supprimer ce média ?'
    if (!confirm(warn)) return
    await apiFetch(`/media/${m.id}`, { method: 'DELETE' })
    setSelected(null)
    load()
  }

  async function saveTitle() {
    if (!selected) return
    setSavingTitle(true)
    const res = await apiFetch(`/media/${selected.id}`, { method: 'PATCH', body: { titre: selected.titre || null } })
    if (res?.ok) { const m = await res.json(); setSelected(m); load() }
    setSavingTitle(false)
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Médiathèque</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{total} fichier{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary gap-2">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Téléverser
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,audio/*,video/*" className="hidden"
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))} />
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="input pl-8 text-sm w-full" />
        </div>
        {TYPES.map(t => (
          <button key={t || 'all'} onClick={() => setType(t)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: type === t ? 'rgba(99,102,241,0.15)' : 'var(--input-bg)',
              color: type === t ? '#818CF8' : 'var(--text-muted)',
            }}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Zone drop */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files ?? [])) }}
        className="mb-4 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs"
        style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.03)', color: 'var(--text-dim)' }}>
        Glissez-déposez des fichiers ici pour les téléverser (images, audio, vidéo)
      </div>

      {/* Grille */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm py-16" style={{ color: 'var(--text-dim)' }}>Aucun média</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map(m => {
            const Icon = TYPE_ICON[m.type]
            return (
              <button key={m.id} onClick={() => setSelected(m)}
                className="rounded-xl overflow-hidden text-left transition-all hover:opacity-85"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-center relative" style={{ height: 110, background: 'rgba(0,0,0,0.35)' }}>
                  {m.type === 'IMAGE'
                    ? <img src={m.url} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                    : <Icon size={30} style={{ color: TYPE_COLOR[m.type] }} />}
                  {(m._count?.questions ?? 0) > 0 && (
                    <span className="absolute top-1.5 right-1.5 text-2xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text)' }}>{m._count.questions}×</span>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-xs truncate" style={{ color: 'var(--text)' }}>{m.titre || m.filename}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{humanSize(m.size)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PER))} total={total} perPage={PER} onPage={setPage} />

      {/* Détail média */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setSelected(null)}>
          <div className="card p-5 w-full max-w-lg animate-scaleIn space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: TYPE_COLOR[selected.type] }}>
                {selected.type}
              </span>
              <button onClick={() => setSelected(null)} className="btn-ghost btn-sm"><X size={14} /></button>
            </div>
            <div className="flex items-center justify-center rounded-lg p-2" style={{ background: 'rgba(0,0,0,0.3)', minHeight: 120 }}>
              <MediaPreview type={selected.type} url={selected.url} style={{ maxHeight: 280 }} />
            </div>
            <div>
              <label className="label">Titre</label>
              <div className="flex gap-2">
                <input value={selected.titre ?? ''} onChange={(e) => setSelected(s => ({ ...s, titre: e.target.value }))}
                  placeholder={selected.filename} className="input text-sm flex-1" />
                <button onClick={saveTitle} disabled={savingTitle} className="btn-secondary btn-sm gap-1">
                  {savingTitle ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
              <p>Fichier : {selected.filename}</p>
              <p>Taille : {humanSize(selected.size)} · {selected.mimeType}</p>
              <p>Utilisé par {selected._count?.questions ?? 0} question(s)</p>
            </div>
            <div className="flex justify-between">
              <a href={selected.url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Ouvrir</a>
              <button onClick={() => handleDelete(selected)} className="btn-ghost btn-sm gap-1" style={{ color: '#F87171' }}>
                <Trash2 size={12} />Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
