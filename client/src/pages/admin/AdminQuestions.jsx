import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  Plus, Search, Pencil, Trash2, X, Check, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'
import MediaPicker from '../../components/MediaPicker.jsx'

const TYPES      = ['BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO']
const DIFFS      = ['FACILE', 'MOYEN', 'DIFFICILE']
const TYPE_COLOR = { BUZZER: '#818CF8', QCM: '#4ADE80', VRAI_FAUX: '#FCD34D', IMAGE: '#F87171', AUDIO: '#C084FC', VIDEO: '#2DD4BF' }

const EMPTY = {
  enonce: '', type: 'BUZZER', reponse: '', indice: '', choix: [], explication: '', source: '',
  points: 100, tempsLimite: 30, difficulte: 'MOYEN', publique: true, categorieId: '', rubriqueId: '',
  mediaUrl: '', videoUrl: '', videoDebut: '', videoFin: '', audioUrl: '',
}

export default function AdminQuestions() {
  const { apiFetch } = useAuth()

  const [questions, setQuestions] = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [filterType, setFilterType]   = useState('')
  const [filterDiff, setFilterDiff]   = useState('')
  const [categories, setCategories]   = useState([])
  const [loading, setLoading]     = useState(false)

  const [editing, setEditing]     = useState(null)  // null | {} (new) | {id, ...}
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [choixInput, setChoixInput] = useState('')

  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit })
    if (search)     params.set('q', search)
    if (filterType) params.set('type', filterType)
    if (filterDiff) params.set('difficulte', filterDiff)
    const res = await apiFetch(`/questions?${params}`)
    if (res?.ok) {
      const d = await res.json()
      setQuestions(d.questions ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [page, search, filterType, filterDiff])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    apiFetch('/categories').then(r => r?.json()).then(d => { if (Array.isArray(d)) setCategories(d) })
  }, [])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const body = {
      ...editing,
      points:     Number(editing.points) || 100,
      tempsLimite: Number(editing.tempsLimite) || 30,
      videoDebut: editing.videoDebut ? Number(editing.videoDebut) : null,
      videoFin:   editing.videoFin   ? Number(editing.videoFin)   : null,
      categorieId: editing.categorieId || null,
      rubriqueId:  editing.rubriqueId  || null,
      mediaUrl:    editing.mediaUrl    || null,
      videoUrl:    editing.videoUrl    || null,
      audioUrl:    editing.audioUrl    || null,
      choix: editing.choix ?? [],
    }

    const url    = editing.id ? `/questions/${editing.id}` : '/questions'
    const method = editing.id ? 'PATCH' : 'POST'
    const res = await apiFetch(url, { method, body })
    if (res?.ok) {
      setEditing(null)
      load()
    } else {
      const err = await res?.json()
      alert(err?.error ? JSON.stringify(err.error) : 'Erreur de sauvegarde')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette question définitivement ?')) return
    setDeleting(id)
    await apiFetch(`/questions/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  function addChoix() {
    if (!choixInput.trim()) return
    setEditing(e => ({ ...e, choix: [...(e.choix ?? []), choixInput.trim()] }))
    setChoixInput('')
  }

  function removeChoix(i) {
    setEditing(e => ({ ...e, choix: e.choix.filter((_, idx) => idx !== i) }))
  }

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>Questions</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5A6E' }}>{total} question{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary gap-2">
          <Plus size={14} />Nouvelle question
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5A5A6E' }} />
          <input type="text" placeholder="Rechercher…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input pl-8 text-sm w-full" />
        </div>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="input text-sm">
          <option value="">Tous types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterDiff} onChange={e => { setFilterDiff(e.target.value); setPage(1) }}
          className="input text-sm">
          <option value="">Toutes difficultés</option>
          {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Type', 'Énoncé', 'Difficulté', 'Catégorie', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#5A5A6E' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: TYPE_COLOR[q.type] ?? '#9090A0' }}>
                      {q.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate" style={{ color: '#ECECF0' }}>{q.enonce}</p>
                    <p className="text-xs truncate" style={{ color: '#5A5A6E' }}>{q.reponse}</p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9090A0' }}>{q.difficulte}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9090A0' }}>{q.categorie?.nom ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing({ ...q })} className="btn-ghost btn-sm">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id}
                        className="btn-ghost btn-sm" style={{ color: '#F87171' }}>
                        {deleting === q.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {questions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: '#5A5A6E' }}>Aucune question</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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

      {/* Edit/Create modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 w-full max-w-2xl my-8 animate-scaleIn space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#ECECF0' }}>
                {editing.id ? 'Modifier la question' : 'Nouvelle question'}
              </h2>
              <button onClick={() => setEditing(null)} className="btn-ghost btn-sm"><X size={14} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Énoncé *</label>
                <textarea value={editing.enonce} onChange={e => setEditing(f => ({ ...f, enonce: e.target.value }))}
                  rows={3} className="input text-sm w-full resize-none" />
              </div>

              <div>
                <label className="label">Type</label>
                <select value={editing.type} onChange={e => setEditing(f => ({ ...f, type: e.target.value }))}
                  className="input text-sm w-full">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Réponse *</label>
                <input type="text" value={editing.reponse}
                  onChange={e => setEditing(f => ({ ...f, reponse: e.target.value }))}
                  className="input text-sm w-full" />
              </div>

              {/* QCM choices */}
              {(editing.type === 'QCM' || editing.type === 'VRAI_FAUX') && (
                <div className="col-span-2">
                  <label className="label">Choix</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={choixInput} onChange={e => setChoixInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChoix() } }}
                      placeholder="Ajouter un choix puis Entrée"
                      className="input text-sm flex-1" />
                    <button type="button" onClick={addChoix} className="btn-primary btn-sm">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(editing.choix ?? []).map((c, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                        style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                        <span className="font-bold mr-1">{['A','B','C','D','E','F'][i]}</span>{c}
                        <button onClick={() => removeChoix(i)} className="ml-1"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Difficulté</label>
                <select value={editing.difficulte} onChange={e => setEditing(f => ({ ...f, difficulte: e.target.value }))}
                  className="input text-sm w-full">
                  {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Catégorie</label>
                <select value={editing.categorieId ?? ''} onChange={e => setEditing(f => ({ ...f, categorieId: e.target.value || null }))}
                  className="input text-sm w-full">
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Points</label>
                <input type="number" min={1} value={editing.points}
                  onChange={e => setEditing(f => ({ ...f, points: e.target.value }))}
                  className="input text-sm w-full" />
              </div>

              <div>
                <label className="label">Temps limite (s)</label>
                <input type="number" min={5} value={editing.tempsLimite}
                  onChange={e => setEditing(f => ({ ...f, tempsLimite: e.target.value }))}
                  className="input text-sm w-full" />
              </div>

              <div className="col-span-2">
                <label className="label">Explication (optionnel)</label>
                <textarea value={editing.explication ?? ''} onChange={e => setEditing(f => ({ ...f, explication: e.target.value }))}
                  rows={2} className="input text-sm w-full resize-none" />
              </div>

              {editing.type === 'IMAGE' && (
                <div className="col-span-2">
                  <label className="label">Image</label>
                  <MediaPicker type="IMAGE" value={editing.mediaUrl ?? ''}
                    onChange={(url, media) => setEditing(f => ({ ...f, mediaUrl: url || null, mediaId: media?.id ?? null }))} />
                </div>
              )}

              {editing.type === 'AUDIO' && (
                <div className="col-span-2">
                  <label className="label">Fichier audio</label>
                  <MediaPicker type="AUDIO" value={editing.audioUrl ?? ''}
                    onChange={(url, media) => setEditing(f => ({ ...f, audioUrl: url || null, mediaId: media?.id ?? null }))} />
                </div>
              )}

              {editing.type === 'VIDEO' && (
                <>
                  <div className="col-span-2">
                    <label className="label">Vidéo (fichier)</label>
                    <MediaPicker type="VIDEO"
                      value={editing.videoUrl?.startsWith('/uploads') ? editing.videoUrl : ''}
                      onChange={(url, media) => setEditing(f => ({ ...f, videoUrl: url || null, mediaId: media?.id ?? null }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">… ou lien YouTube</label>
                    <input type="url" placeholder="https://youtube.com/watch?v=…"
                      value={editing.videoUrl && !editing.videoUrl.startsWith('/uploads') ? editing.videoUrl : ''}
                      onChange={e => setEditing(f => ({ ...f, videoUrl: e.target.value || null, mediaId: null }))}
                      className="input text-sm w-full" />
                  </div>
                  <div>
                    <label className="label">Début (s)</label>
                    <input type="number" min={0} value={editing.videoDebut ?? ''} onChange={e => setEditing(f => ({ ...f, videoDebut: e.target.value }))}
                      className="input text-sm w-full" />
                  </div>
                  <div>
                    <label className="label">Fin (s)</label>
                    <input type="number" min={0} value={editing.videoFin ?? ''} onChange={e => setEditing(f => ({ ...f, videoFin: e.target.value }))}
                      className="input text-sm w-full" />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="btn-ghost">Annuler</button>
              <button onClick={handleSave} disabled={saving || !editing.enonce?.trim() || !editing.reponse?.trim()}
                className="btn-primary gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
