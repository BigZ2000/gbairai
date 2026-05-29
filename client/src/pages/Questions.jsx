import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  Search, Plus, X, ChevronDown, ChevronUp, Loader2, AlertCircle,
  BookOpen, Trash2, Edit3, Check, Tag,
} from 'lucide-react'

const TYPE_LABELS = { BUZZER: 'Buzzer', QCM: 'QCM', VRAI_FAUX: 'Vrai/Faux', IMAGE: 'Image', AUDIO: 'Audio' }
const TYPE_COLORS = {
  BUZZER: { bg: 'rgba(99,102,241,0.1)', color: '#818CF8' },
  QCM: { bg: 'rgba(245,158,11,0.1)', color: '#FCD34D' },
  VRAI_FAUX: { bg: 'rgba(34,197,94,0.1)', color: '#4ADE80' },
  IMAGE: { bg: 'rgba(236,72,153,0.1)', color: '#F472B6' },
  AUDIO: { bg: 'rgba(14,165,233,0.1)', color: '#38BDF8' },
}
const DIFF_COLORS = { FACILE: '#4ADE80', MOYEN: '#FCD34D', DIFFICILE: '#F87171' }

const EMPTY_FORM = {
  enonce: '', type: 'BUZZER', reponse: '', indice: '', choix: ['', '', '', ''],
  points: 100, tempsLimite: 30, difficulte: 'MOYEN',
  publique: false, categorieId: '', rubriqueId: '',
  mediaUrl: '', videoUrl: '',
}

export default function Questions() {
  const { apiFetch } = useAuth()

  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (filterType) params.set('type', filterType)
    if (filterDiff) params.set('difficulte', filterDiff)
    if (filterCat) params.set('categorieId', filterCat)
    const res = await apiFetch(`/questions?${params}`)
    if (res?.ok) {
      const data = await res.json()
      setQuestions(data.questions ?? [])
      setTotal(data.total ?? 0)
    }
    setLoading(false)
  }, [q, filterType, filterDiff, filterCat])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    apiFetch('/categories').then(r => r?.json()).then(d => { if (Array.isArray(d)) setCategories(d) })
  }, [])

  const selectedCat = categories.find(c => c.id === (editingId ? form.categorieId : filterCat))

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(q) {
    setEditingId(q.id)
    setForm({
      enonce: q.enonce,
      type: q.type,
      reponse: q.reponse,
      indice: q.indice ?? '',
      choix: q.choix?.length ? [...q.choix, ...Array(4).fill('')].slice(0, 4) : ['', '', '', ''],
      points: q.points,
      tempsLimite: q.tempsLimite,
      difficulte: q.difficulte,
      publique: q.publique,
      categorieId: q.categorieId ?? '',
      rubriqueId: q.rubriqueId ?? '',
      mediaUrl: q.mediaUrl ?? '',
      videoUrl: q.videoUrl ?? '',
    })
    setFormError('')
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditingId(null) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')

    const body = {
      enonce: form.enonce.trim(),
      type: form.type,
      reponse: form.reponse.trim(),
      indice: form.indice.trim() || null,
      choix: form.type === 'QCM' ? form.choix.filter(c => c.trim()) : [],
      points: form.points,
      tempsLimite: form.tempsLimite,
      difficulte: form.difficulte,
      publique: form.publique,
      categorieId: form.categorieId || null,
      rubriqueId: form.rubriqueId || null,
      mediaUrl: form.mediaUrl.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
    }

    const method = editingId ? 'PATCH' : 'POST'
    const url = editingId ? `/questions/${editingId}` : '/questions'
    const res = await apiFetch(url, { method, body })
    const data = await res?.json()
    if (!res?.ok) {
      setFormError(data?.error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }

    if (editingId) {
      setQuestions(prev => prev.map(q => q.id === editingId ? data : q))
    } else {
      setQuestions(prev => [data, ...prev])
      setTotal(t => t + 1)
    }
    closeForm()
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette question ?')) return
    const res = await apiFetch(`/questions/${id}`, { method: 'DELETE' })
    if (res?.ok) {
      setQuestions(prev => prev.filter(q => q.id !== id))
      setTotal(t => t - 1)
    }
  }

  const formRubriques = categories.find(c => c.id === form.categorieId)?.rubriques ?? []

  return (
    <Layout maxWidth="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#ECECF0' }}>Bibliothèque de questions</h1>
          <p className="text-sm mt-0.5" style={{ color: '#9090A0' }}>{total} question{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary gap-1.5">
          <Plus size={14} />Nouvelle question
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5A5A6E' }} />
          <input
            type="text"
            placeholder="Rechercher…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input pl-8 text-sm w-full"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X size={12} style={{ color: '#5A5A6E' }} />
            </button>
          )}
        </div>

        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes difficultés</option>
          <option value="FACILE">Facile</option>
          <option value="MOYEN">Moyen</option>
          <option value="DIFFICILE">Difficile</option>
        </select>

        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nom}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen size={40} className="mb-4" style={{ color: '#2A2A35' }} />
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#ECECF0' }}>Aucune question</h2>
          <p className="text-sm mb-5" style={{ color: '#9090A0' }}>Créez votre première question pour commencer.</p>
          <button onClick={openNew} className="btn-primary gap-1.5"><Plus size={14} />Créer une question</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {questions.map(question => {
            const isExpanded = expandedId === question.id
            const tc = TYPE_COLORS[question.type]
            return (
              <div key={question.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.015] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : question.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xs px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: tc.bg, color: tc.color }}>
                        {TYPE_LABELS[question.type]}
                      </span>
                      <span className="text-2xs font-semibold" style={{ color: DIFF_COLORS[question.difficulte] }}>
                        {question.difficulte}
                      </span>
                      {question.categorie && (
                        <span className="text-2xs" style={{ color: '#5A5A6E' }}>
                          {question.categorie.emoji} {question.categorie.nom}
                          {question.rubrique && ` › ${question.rubrique.nom}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1 truncate" style={{ color: '#ECECF0' }}>
                      {question.enonce}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(question) }}
                      className="btn-ghost btn-sm" title="Modifier">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(question.id) }}
                      className="btn-ghost btn-sm" title="Supprimer" style={{ color: '#EF4444' }}>
                      <Trash2 size={13} />
                    </button>
                    {isExpanded
                      ? <ChevronUp size={14} style={{ color: '#5A5A6E' }} />
                      : <ChevronDown size={14} style={{ color: '#5A5A6E' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      <div>
                        <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Réponse</p>
                        <p className="text-sm font-semibold" style={{ color: '#4ADE80' }}>{question.reponse}</p>
                      </div>
                      {question.indice && (
                        <div>
                          <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Indice</p>
                          <p className="text-sm" style={{ color: '#9090A0' }}>{question.indice}</p>
                        </div>
                      )}
                      {question.choix?.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Choix</p>
                          <div className="flex flex-wrap gap-1.5">
                            {question.choix.map((c, i) => (
                              <span key={i} className="text-2xs px-2 py-0.5 rounded"
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#ECECF0' }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Points</p>
                        <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>{question.points} pts</p>
                      </div>
                      <div>
                        <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: '#5A5A6E' }}>Temps limite</p>
                        <p className="text-sm" style={{ color: '#ECECF0' }}>{question.tempsLimite}s</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-end"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="w-full max-w-lg h-full overflow-y-auto animate-slideInRight"
            style={{ background: '#141418', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ background: '#141418', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="font-semibold" style={{ color: '#ECECF0' }}>
                {editingId ? 'Modifier la question' : 'Nouvelle question'}
              </h2>
              <button onClick={closeForm} className="btn-ghost btn-sm"><X size={14} /></button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">

              {/* Énoncé */}
              <div>
                <label className="label">Énoncé *</label>
                <textarea required rows={3} maxLength={2000}
                  value={form.enonce} onChange={e => setForm(f => ({ ...f, enonce: e.target.value }))}
                  placeholder="Quelle est la capitale de la France ?"
                  className="input resize-none"
                />
              </div>

              {/* Type + Difficulté */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Difficulté</label>
                  <select value={form.difficulte} onChange={e => setForm(f => ({ ...f, difficulte: e.target.value }))} className="input">
                    <option value="FACILE">Facile</option>
                    <option value="MOYEN">Moyen</option>
                    <option value="DIFFICILE">Difficile</option>
                  </select>
                </div>
              </div>

              {/* Réponse */}
              <div>
                <label className="label">Réponse *</label>
                <input required maxLength={500}
                  value={form.reponse} onChange={e => setForm(f => ({ ...f, reponse: e.target.value }))}
                  placeholder="Paris"
                  className="input"
                />
              </div>

              {/* Choix (QCM) */}
              {form.type === 'QCM' && (
                <div>
                  <label className="label">Choix (propositions)</label>
                  <div className="space-y-1.5">
                    {form.choix.map((c, i) => (
                      <input key={i} maxLength={200}
                        value={c} onChange={e => setForm(f => {
                          const choix = [...f.choix]
                          choix[i] = e.target.value
                          return { ...f, choix }
                        })}
                        placeholder={`Choix ${i + 1}`}
                        className="input text-sm"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Indice */}
              <div>
                <label className="label">Indice <span style={{ color: '#5A5A6E' }}>(optionnel)</span></label>
                <input maxLength={500}
                  value={form.indice} onChange={e => setForm(f => ({ ...f, indice: e.target.value }))}
                  placeholder="Ville lumière…"
                  className="input"
                />
              </div>

              {/* Media URL (IMAGE) */}
              {form.type === 'IMAGE' && (
                <div>
                  <label className="label">URL de l'image</label>
                  <input type="url"
                    value={form.mediaUrl} onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
                    placeholder="https://…"
                    className="input"
                  />
                </div>
              )}

              {/* Video URL (AUDIO) */}
              {form.type === 'AUDIO' && (
                <div>
                  <label className="label">URL vidéo/audio</label>
                  <input type="url"
                    value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="https://youtube.com/…"
                    className="input"
                  />
                </div>
              )}

              {/* Points + Temps */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Points</label>
                  <input type="number" min={1} max={10000}
                    value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Temps limite (s)</label>
                  <input type="number" min={5} max={300}
                    value={form.tempsLimite} onChange={e => setForm(f => ({ ...f, tempsLimite: Number(e.target.value) }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Catégorie + Rubrique */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Catégorie</label>
                  <select value={form.categorieId}
                    onChange={e => setForm(f => ({ ...f, categorieId: e.target.value, rubriqueId: '' }))}
                    className="input">
                    <option value="">Sans catégorie</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Rubrique</label>
                  <select value={form.rubriqueId}
                    onChange={e => setForm(f => ({ ...f, rubriqueId: e.target.value }))}
                    disabled={!form.categorieId}
                    className="input">
                    <option value="">Sans rubrique</option>
                    {formRubriques.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Publique */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, publique: !f.publique }))}
                  className="w-10 h-5.5 rounded-full relative transition-colors flex items-center cursor-pointer"
                  style={{
                    background: form.publique ? '#6366F1' : 'rgba(255,255,255,0.1)',
                    padding: '2px',
                    minWidth: '2.5rem',
                    height: '1.375rem',
                  }}>
                  <div className="w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: form.publique ? 'translateX(1.125rem)' : 'translateX(0)' }} />
                </div>
                <span className="text-sm" style={{ color: '#9090A0' }}>Visible par tous</span>
              </label>

              {formError && (
                <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2.5"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                  <AlertCircle size={13} />{formError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingId ? 'Sauvegarder' : 'Créer'}
                </button>
                <button type="button" onClick={closeForm} className="btn-ghost flex-1">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
