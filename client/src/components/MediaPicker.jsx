import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Upload, Image as ImageIcon, Music, Video, Library, X, Loader2, Trash2, Check, Search } from 'lucide-react'

const ACCEPT = {
  IMAGE: 'image/*',
  AUDIO: 'audio/*',
  VIDEO: 'video/*',
}
const ICON = { IMAGE: ImageIcon, AUDIO: Music, VIDEO: Video }

// Aperçu d'un média selon son type.
export function MediaPreview({ type, url, className = '', style = {} }) {
  if (!url) return null
  if (type === 'IMAGE') {
    return <img src={url} alt="" className={className} style={{ objectFit: 'contain', ...style }} />
  }
  if (type === 'AUDIO') {
    return <audio src={url} controls className={className} style={{ width: '100%', ...style }} />
  }
  if (type === 'VIDEO') {
    return <video src={url} controls className={className} style={{ maxWidth: '100%', ...style }} />
  }
  return null
}

/**
 * Sélecteur de média : téléversement (avec déduplication serveur) + médiathèque.
 * Props :
 *  - type: 'IMAGE' | 'AUDIO' | 'VIDEO'
 *  - value: url actuelle (string) ou ''
 *  - onChange: (url, media) => void
 */
export default function MediaPicker({ type = 'IMAGE', value, onChange }) {
  const { apiFetch, apiUpload } = useAuth()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [libOpen, setLibOpen]     = useState(false)
  const Icon = ICON[type] ?? ImageIcon

  async function doUpload(file) {
    if (!file) return
    setError(''); setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiUpload('/media/upload', fd)
    if (res?.ok) {
      const { media } = await res.json()
      onChange(media.url, media)
    } else {
      const e = await res?.json().catch(() => null)
      setError(e?.error || 'Échec du téléversement')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) doUpload(f)
  }

  return (
    <div>
      {value ? (
        <div className="rounded-lg p-3" style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center mb-2" style={{ maxHeight: 180, overflow: 'hidden' }}>
            <MediaPreview type={type} url={value} className="rounded" style={{ maxHeight: 160 }} />
          </div>
          <div className="flex gap-2 justify-center">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary btn-sm gap-1">
              <Upload size={12} />Remplacer
            </button>
            <button type="button" onClick={() => setLibOpen(true)} className="btn-secondary btn-sm gap-1">
              <Library size={12} />Médiathèque
            </button>
            <button type="button" onClick={() => onChange('', null)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all"
          style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' }}>
          {uploading ? (
            <Loader2 size={22} className="animate-spin" style={{ color: '#6366F1', margin: '0 auto' }} />
          ) : (
            <>
              <Icon size={22} style={{ color: '#6366F1', margin: '0 auto 8px' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Glissez un fichier ou cliquez</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); setLibOpen(true) }}
                className="text-xs mt-2 underline" style={{ color: '#818CF8' }}>
                ou choisir dans la médiathèque
              </button>
            </>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept={ACCEPT[type]} className="hidden"
        onChange={(e) => doUpload(e.target.files?.[0])} />

      {error && <p className="text-xs mt-1" style={{ color: '#F87171' }}>{error}</p>}

      {libOpen && (
        <MediaLibraryModal
          type={type}
          apiFetch={apiFetch}
          onClose={() => setLibOpen(false)}
          onSelect={(m) => { onChange(m.url, m); setLibOpen(false) }}
        />
      )}
    </div>
  )
}

// Modale de sélection dans la médiathèque.
function MediaLibraryModal({ type, apiFetch, onSelect, onClose }) {
  const [items, setItems]   = useState([])
  const [q, setQ]           = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ type, limit: '60' })
    if (q) params.set('q', q)
    const res = await apiFetch(`/media?${params}`)
    if (res?.ok) setItems((await res.json()).media ?? [])
    setLoading(false)
  }, [type, q, apiFetch])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card p-5 w-full max-w-3xl max-h-[80vh] flex flex-col animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Médiathèque — {type}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={14} /></button>
        </div>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            className="input pl-8 text-sm w-full" autoFocus />
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: '#6366F1' }} /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: 'var(--text-dim)' }}>Aucun média</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((m) => (
                <button key={m.id} onClick={() => onSelect(m)}
                  className="rounded-lg overflow-hidden text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center" style={{ height: 90, background: 'rgba(0,0,0,0.3)' }}>
                    {type === 'IMAGE'
                      ? <img src={m.url} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                      : type === 'AUDIO'
                        ? <Music size={26} style={{ color: '#C084FC' }} />
                        : <Video size={26} style={{ color: '#2DD4BF' }} />}
                  </div>
                  <p className="text-2xs truncate px-2 py-1" style={{ color: 'var(--text-muted)' }}>{m.titre || m.filename}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
