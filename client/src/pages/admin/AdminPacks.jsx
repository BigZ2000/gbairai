import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  Plus, Trash2, Pencil, X, Check, Loader2, Copy, BarChart3, Search,
  Star, Archive, Eye, EyeOff, Package, Rocket, Image as ImageIcon,
} from 'lucide-react'

const DIFFICULTES = ['FACILE', 'MOYEN', 'DIFFICILE', 'MIXTE']
const DUREES = ['RAPIDE', 'STANDARD', 'LONGUE']
const TYPES = ['BUZZER', 'QCM', 'VRAI_FAUX', 'IMAGE', 'AUDIO', 'VIDEO']
const GAMEMODES = [['animateur', 'Animateur'], ['auto', 'Automatique'], ['vote', 'Vote collectif']]
const STATUTS = [['ACTIF', 'Actif'], ['INACTIF', 'Inactif'], ['ARCHIVE', 'Archivé']]
const TIERS = [
  ['GRATUIT', 'Gratuit — accessible à tous'],
  ['PREMIUM', 'Premium — abonnés Pro'],
  ['ENTREPRISE', 'Entreprise — comptes société'],
  ['EVENEMENT', 'Événement — organisateurs'],
  ['ECOLE', 'École — établissements'],
]

const STATUT_STYLE = {
  ACTIF:   { bg: 'rgba(34,197,94,0.12)',  fg: '#22C55E' },
  INACTIF: { bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B' },
  ARCHIVE: { bg: 'rgba(90,90,110,0.18)',  fg: 'var(--text-muted)' },
}

const EMPTY_PACK = {
  nom: '', description: '', emoji: '🎮', couleur: '#6366F1',
  imageUrl: '', banniereUrl: '', categorie: '', tags: [],
  difficulte: 'MIXTE', duree: 'STANDARD', categories: [], typesAutorises: [],
  modeRecommande: 'animateur', contentMode: 'DYNAMIQUE',
  nbManches: 2, nbQuestions: 10, tempsParQuestion: 30, pointsParQuestion: 100,
  tier: 'GRATUIT', prix: 0,
  priorite: 50, vedette: false, signature: false, statut: 'ACTIF',
}

export default function AdminPacks() {
  const { apiFetch } = useAuth()
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // pack en édition (objet)
  const [statsFor, setStatsFor] = useState(null)  // pack dont on affiche les stats

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatut) params.set('statut', filterStatut)
    if (search.trim()) params.set('q', search.trim())
    const res = await apiFetch(`/admin/packs?${params}`)
    if (res?.ok) setPacks(await res.json())
    setLoading(false)
  }, [filterStatut, search])

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  async function openNew() { setEditing({ ...EMPTY_PACK }) }
  async function openEdit(p) {
    // Recharge la fiche complète (questions manuelles incluses).
    const res = await apiFetch(`/admin/packs/${p.id}`)
    if (res?.ok) setEditing(await res.json())
  }

  async function duplicate(p) {
    const nom = prompt('Nom du nouveau pack', `${p.nom} (copie)`)
    if (nom === null) return
    const res = await apiFetch(`/admin/packs/${p.id}/duplicate`, { method: 'POST', body: { nom } })
    if (res?.ok) load()
  }

  async function changeStatut(p, statut) {
    await apiFetch(`/admin/packs/${p.id}`, { method: 'PATCH', body: { statut } })
    load()
  }

  async function remove(p) {
    if (!confirm(`Supprimer définitivement « ${p.nom} » ? Préférez l'archivage pour garder l'historique.`)) return
    await apiFetch(`/admin/packs/${p.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Packs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
            Parties prêtes à jouer, pilotées par les données.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary gap-2"><Plus size={14} />Nouveau pack</button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {[['', 'Tous'], ...STATUTS].map(([v, l]) => (
            <button key={v || 'all'} onClick={() => setFilterStatut(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterStatut === v ? 'rgba(99,102,241,0.15)' : 'var(--hover-overlay)',
                color: filterStatut === v ? '#818CF8' : 'var(--text-muted)',
              }}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (nom, description, catégorie, tag)…"
            className="input w-full pl-9" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Pack', 'Catégorie', 'Diff.', 'Durée', 'Prio', 'Contenu', 'Lancements', 'Statut', ''].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {packs.map(p => {
              const st = STATUT_STYLE[p.statut] ?? STATUT_STYLE.INACTIF
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--input-bg)' }}
                  className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ background: hex(p.couleur, 0.15) }}>{p.emoji}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{p.nom}</span>
                          {p.vedette && <Star size={11} style={{ color: '#EAB308', fill: '#EAB308' }} />}
                          {p.signature && <span className="badge-wait">Signature</span>}
                          {p.tier && p.tier !== 'GRATUIT' && (
                            <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                              {p.tier}{p.prix > 0 ? ` · ${p.prix} F` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-2xs truncate max-w-xs" style={{ color: 'var(--text-dim)' }}>{p.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3" style={{ color: 'var(--text-muted)' }}>{p.categorie ?? '—'}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{p.difficulte}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{p.duree}</td>
                  <td className="px-3 py-3 font-mono" style={{ color: 'var(--text)' }}>{p.priorite}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {p.contentMode === 'MANUEL'
                      ? <span>Manuel · {p.nbQuestionsManuelles}q</span>
                      : <span>Dynamique</span>}
                  </td>
                  <td className="px-3 py-3 font-mono" style={{ color: 'var(--text-muted)' }}>{p.lancements}</td>
                  <td className="px-3 py-3">
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.fg }}>
                      {STATUTS.find(s => s[0] === p.statut)?.[1]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-0.5 justify-end">
                      <button onClick={() => setStatsFor(p)} className="btn-ghost btn-sm" title="Statistiques"><BarChart3 size={13} /></button>
                      <button onClick={() => openEdit(p)} className="btn-ghost btn-sm" title="Modifier"><Pencil size={13} /></button>
                      <button onClick={() => duplicate(p)} className="btn-ghost btn-sm" title="Dupliquer"><Copy size={13} /></button>
                      {p.statut === 'ACTIF'
                        ? <button onClick={() => changeStatut(p, 'INACTIF')} className="btn-ghost btn-sm" title="Désactiver"><EyeOff size={13} /></button>
                        : <button onClick={() => changeStatut(p, 'ACTIF')} className="btn-ghost btn-sm" title="Activer" style={{ color: '#22C55E' }}><Eye size={13} /></button>}
                      {p.statut !== 'ARCHIVE'
                        ? <button onClick={() => changeStatut(p, 'ARCHIVE')} className="btn-ghost btn-sm" title="Archiver"><Archive size={13} /></button>
                        : null}
                      <button onClick={() => remove(p)} className="btn-ghost btn-sm" style={{ color: '#F87171' }} title="Supprimer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && packs.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                <Package size={24} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />
                Aucun pack
              </td></tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="px-4 py-10 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--text-dim)' }} /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <PackEditor pack={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {statsFor && <StatsModal pack={statsFor} onClose={() => setStatsFor(null)} />}
    </AdminLayout>
  )
}

// ── Éditeur de pack ───────────────────────────────────────
function PackEditor({ pack, onClose, onSaved }) {
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(pack)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [catInput, setCatInput] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isNew = !form.id

  async function save() {
    if (!form.nom?.trim()) return
    setSaving(true)
    const body = {
      nom: form.nom, description: form.description ?? '', emoji: form.emoji || null,
      couleur: form.couleur, imageUrl: form.imageUrl || null, banniereUrl: form.banniereUrl || null,
      categorie: form.categorie || null, tags: form.tags ?? [],
      difficulte: form.difficulte, duree: form.duree, categories: form.categories ?? [],
      typesAutorises: form.typesAutorises ?? [], modeRecommande: form.modeRecommande,
      contentMode: form.contentMode,
      nbManches: Number(form.nbManches), nbQuestions: Number(form.nbQuestions),
      tempsParQuestion: Number(form.tempsParQuestion), pointsParQuestion: Number(form.pointsParQuestion),
      tier: form.tier, prix: Number(form.prix) || 0,
      priorite: Number(form.priorite), vedette: !!form.vedette, signature: !!form.signature,
      statut: form.statut,
    }
    const url = isNew ? '/admin/packs' : `/admin/packs/${form.id}`
    const res = await apiFetch(url, { method: isNew ? 'POST' : 'PATCH', body })
    setSaving(false)
    if (res?.ok) onSaved()
  }

  function addTag() { const t = tagInput.trim(); if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]); setTagInput('') } }
  function addCat() { const t = catInput.trim(); if (t && !form.categories.includes(t)) { set('categories', [...form.categories, t]); setCatInput('') } }
  function toggleType(t) {
    set('typesAutorises', form.typesAutorises.includes(t)
      ? form.typesAutorises.filter(x => x !== t) : [...form.typesAutorises, t])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
        <div className="flex items-center justify-between p-5 sticky top-0 z-10"
          style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {isNew ? 'Nouveau pack' : `Modifier « ${form.nom} »`}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Informations */}
          <Section title="Informations">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <Field label="Icône">
                <input value={form.emoji ?? ''} onChange={e => set('emoji', e.target.value)} maxLength={8}
                  className="input text-2xl text-center w-full" />
              </Field>
              <Field label="Nom *">
                <input value={form.nom} onChange={e => set('nom', e.target.value)} maxLength={120} className="input w-full" />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2}
                className="input w-full resize-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Catégorie principale">
                <input value={form.categorie ?? ''} onChange={e => set('categorie', e.target.value)} className="input w-full"
                  placeholder="Sport, Musique…" />
              </Field>
              <Field label="Couleur">
                <div className="flex items-center gap-2">
                  <input type="color" value={form.couleur} onChange={e => set('couleur', e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer bg-transparent" />
                  <input value={form.couleur} onChange={e => set('couleur', e.target.value)} className="input flex-1 font-mono" />
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Image (vignette)">
                <MediaField value={form.imageUrl} onChange={v => set('imageUrl', v)} />
              </Field>
              <Field label="Bannière">
                <MediaField value={form.banniereUrl} onChange={v => set('banniereUrl', v)} banner />
              </Field>
            </div>
            {/* Tags */}
            <Field label="Tags (recherche)">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                    {t}<button onClick={() => set('tags', form.tags.filter(x => x !== t))}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Ajouter un tag + Entrée" className="input w-full" />
            </Field>
          </Section>

          {/* Paramètres de jeu */}
          <Section title="Paramètres de jeu">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Manches"><input type="number" min={1} max={10} value={form.nbManches} onChange={e => set('nbManches', e.target.value)} className="input w-full" /></Field>
              <Field label="Questions/manche"><input type="number" min={1} max={50} value={form.nbQuestions} onChange={e => set('nbQuestions', e.target.value)} className="input w-full" /></Field>
              <Field label="Temps/question (s)"><input type="number" min={5} max={300} value={form.tempsParQuestion} onChange={e => set('tempsParQuestion', e.target.value)} className="input w-full" /></Field>
              <Field label="Points/question"><input type="number" min={10} max={1000} value={form.pointsParQuestion} onChange={e => set('pointsParQuestion', e.target.value)} className="input w-full" /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Difficulté">
                <select value={form.difficulte} onChange={e => set('difficulte', e.target.value)} className="input w-full">
                  {DIFFICULTES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Durée">
                <select value={form.duree} onChange={e => set('duree', e.target.value)} className="input w-full">
                  {DUREES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Mode recommandé">
                <select value={form.modeRecommande} onChange={e => set('modeRecommande', e.target.value)} className="input w-full">
                  {GAMEMODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Types de questions autorisés (vide = tous)">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t} onClick={() => toggleType(t)}
                    className="px-2.5 py-1 rounded-lg text-2xs font-medium transition-all"
                    style={{
                      background: form.typesAutorises.includes(t) ? 'rgba(99,102,241,0.18)' : 'var(--hover-overlay)',
                      color: form.typesAutorises.includes(t) ? '#818CF8' : 'var(--text-muted)',
                    }}>{t}</button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Contenu */}
          <Section title="Contenu">
            <div className="flex gap-2 mb-1">
              {[['DYNAMIQUE', 'Dynamique', 'Questions tirées automatiquement'], ['MANUEL', 'Manuel', 'Questions choisies précisément']].map(([v, l, d]) => (
                <button key={v} onClick={() => set('contentMode', v)}
                  className="flex-1 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: form.contentMode === v ? hex(form.couleur, 0.12) : 'var(--hover-overlay)',
                    border: `1px solid ${form.contentMode === v ? hex(form.couleur, 0.4) : 'var(--border)'}`,
                  }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{l}</p>
                  <p className="text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{d}</p>
                </button>
              ))}
            </div>
            {form.contentMode === 'DYNAMIQUE' ? (
              <Field label="Catégories sources (génération automatique)">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.categories.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs"
                      style={{ background: 'var(--hover-overlay)', color: 'var(--text)' }}>
                      {c}<button onClick={() => set('categories', form.categories.filter(x => x !== c))}><X size={10} /></button>
                    </span>
                  ))}
                  {form.categories.length === 0 && <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>Toutes catégories (mélange)</span>}
                </div>
                <input value={catInput} onChange={e => setCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat() } }}
                  placeholder="Nom exact de catégorie + Entrée" className="input w-full" />
              </Field>
            ) : (
              <ManualQuestions pack={form} />
            )}
          </Section>

          {/* Monétisation */}
          <Section title="Monétisation">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Niveau d'accès (tier)">
                <select value={form.tier} onChange={e => set('tier', e.target.value)} className="input w-full">
                  {TIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Prix unitaire (FCFA, 0 = inclus)">
                <input type="number" min={0} value={form.prix} onChange={e => set('prix', e.target.value)} className="input w-full" />
              </Field>
            </div>
            <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
              Un pack non gratuit est verrouillé pour les plans qui n'y donnent pas droit ; il peut aussi être acheté à l'unité si un prix &gt; 0 est défini.
            </p>
          </Section>

          {/* Promotion */}
          <Section title="Priorité & mise en avant">
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Priorité (100 = top)">
                <input type="number" min={0} max={1000} value={form.priorite} onChange={e => set('priorite', e.target.value)} className="input w-full" />
              </Field>
              <Field label="Statut">
                <select value={form.statut} onChange={e => set('statut', e.target.value)} className="input w-full">
                  {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-4">
              <Toggle label="⭐ Pack vedette" checked={!!form.vedette} onChange={v => set('vedette', v)} />
              <Toggle label="🏆 Partie signature" checked={!!form.signature} onChange={v => set('signature', v)} />
            </div>
          </Section>
        </div>

        <div className="flex gap-2 justify-end p-5 sticky bottom-0"
          style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving || !form.nom?.trim()} className="btn-primary gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Éditeur de questions manuelles ────────────────────────
function ManualQuestions({ pack }) {
  const { apiFetch } = useAuth()
  const [selected, setSelected] = useState(pack.questions ?? [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [savingQ, setSavingQ] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const res = await apiFetch(`/questions?q=${encodeURIComponent(query)}&limit=15`)
      if (res?.ok) { const d = await res.json(); setResults(d.questions ?? []) }
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function add(q) {
    if (selected.some(s => (s.questionId ?? s.question?.id) === q.id)) return
    setSelected(prev => [...prev, { questionId: q.id, manche: 1, ordre: prev.length, question: { id: q.id, enonce: q.enonce, type: q.type, difficulte: q.difficulte } }])
  }
  function removeQ(id) { setSelected(prev => prev.filter(s => (s.questionId ?? s.question?.id) !== id)) }
  function setManche(id, manche) {
    setSelected(prev => prev.map(s => (s.questionId ?? s.question?.id) === id ? { ...s, manche: Number(manche) } : s))
  }

  async function saveQuestions() {
    if (!pack.id) { setSavedMsg('Enregistrez d\'abord le pack.'); return }
    setSavingQ(true)
    const body = { questions: selected.map((s, i) => ({ questionId: s.questionId ?? s.question?.id, manche: s.manche ?? 1, ordre: i })) }
    const res = await apiFetch(`/admin/packs/${pack.id}/questions`, { method: 'PUT', body })
    setSavingQ(false)
    setSavedMsg(res?.ok ? `✓ ${selected.length} questions enregistrées` : 'Erreur')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  return (
    <div className="space-y-3">
      {!pack.id && (
        <p className="text-2xs p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
          Enregistrez le pack une première fois pour pouvoir sauvegarder la sélection de questions.
        </p>
      )}
      {/* Recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Chercher des questions à ajouter…" className="input w-full pl-9" />
        {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />}
      </div>
      {results.length > 0 && (
        <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
          {results.map(q => (
            <button key={q.id} onClick={() => add(q)}
              className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
              style={{ borderBottom: '1px solid var(--input-bg)' }}>
              <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{q.enonce}</span>
              <Plus size={13} style={{ color: '#818CF8' }} />
            </button>
          ))}
        </div>
      )}
      {/* Sélection */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="label">Questions sélectionnées ({selected.length})</p>
          <button onClick={saveQuestions} disabled={savingQ || !pack.id} className="btn-secondary btn-sm gap-1">
            {savingQ ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Enregistrer la sélection
          </button>
        </div>
        {savedMsg && <p className="text-2xs mb-1.5" style={{ color: '#22C55E' }}>{savedMsg}</p>}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {selected.map(s => {
            const id = s.questionId ?? s.question?.id
            return (
              <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'var(--hover-overlay)' }}>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>{s.question?.enonce ?? id}</span>
                <select value={s.manche ?? 1} onChange={e => setManche(id, e.target.value)}
                  className="input py-0.5 px-1.5 text-2xs w-auto" title="Manche">
                  {Array.from({ length: Number(pack.nbManches) || 1 }).map((_, i) => <option key={i} value={i + 1}>M{i + 1}</option>)}
                </select>
                <button onClick={() => removeQ(id)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}><Trash2 size={11} /></button>
              </div>
            )
          })}
          {selected.length === 0 && <p className="text-2xs py-2" style={{ color: 'var(--text-dim)' }}>Aucune question sélectionnée</p>}
        </div>
      </div>
    </div>
  )
}

// ── Statistiques ──────────────────────────────────────────
function StatsModal({ pack, onClose }) {
  const { apiFetch } = useAuth()
  const [stats, setStats] = useState(null)
  useEffect(() => { apiFetch(`/admin/packs/${pack.id}/stats`).then(r => r?.ok && r.json()).then(setStats) }, [pack.id])

  const items = [
    ['Lancements', stats?.lancements ?? '—'],
    ['Joueurs', stats?.joueurs ?? '—'],
    ['Temps moyen', stats ? `${Math.floor((stats.tempsMoyen ?? 0) / 60)} min` : '—'],
    ['Taux de complétion', stats ? `${stats.tauxCompletion}%` : '—'],
    ['Note moyenne', stats?.noteMoyenne ?? '—'],
    ['Popularité', stats?.popularite ?? '—'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card p-6 w-full max-w-md animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <span className="text-xl">{pack.emoji}</span>{pack.nom}
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>
        {!stats ? <Loader2 size={20} className="animate-spin mx-auto my-6" style={{ color: 'var(--text-dim)' }} /> : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(([l, v]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: 'var(--hover-overlay)' }}>
                <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{l}</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sélecteur d'image depuis la médiathèque ───────────────
function MediaField({ value, onChange, banner }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(true)}
          className="rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ width: banner ? 88 : 44, height: 44, background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          {value
            ? <img src={value} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={16} style={{ color: 'var(--text-dim)' }} />}
        </button>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">Choisir…</button>
          {value && <button type="button" onClick={() => onChange('')} className="text-2xs text-left" style={{ color: '#F87171' }}>Retirer</button>}
        </div>
      </div>
      {open && <MediaPicker onClose={() => setOpen(false)} onSelect={url => { onChange(url); setOpen(false) }} />}
    </>
  )
}

function MediaPicker({ onClose, onSelect }) {
  const { apiFetch } = useAuth()
  const [media, setMedia] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await apiFetch(`/media?type=IMAGE&limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      if (res?.ok) { const d = await res.json(); setMedia(d.media ?? []) }
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une image…" className="input w-full pl-9" autoFocus />
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          {loading ? <Loader2 size={20} className="animate-spin mx-auto my-8" style={{ color: 'var(--text-dim)' }} />
            : media.length === 0 ? <p className="text-sm text-center py-8" style={{ color: 'var(--text-dim)' }}>Aucune image dans la médiathèque.</p>
            : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {media.map(m => (
                  <button key={m.id} onClick={() => onSelect(m.url)}
                    className="aspect-square rounded-lg overflow-hidden group relative" style={{ border: '1px solid var(--border)' }}>
                    <img src={m.thumbUrl ?? m.url} alt={m.titre ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

// ── Petits composants ─────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#818CF8' }}>{title}</h3>
      {children}
    </div>
  )
}
function Field({ label, children }) {
  return (<div><label className="label">{label}</label>{children}</div>)
}
function Toggle({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 py-1">
      <span className="w-9 h-5 rounded-full transition-all relative shrink-0"
        style={{ background: checked ? '#6366F1' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '18px' : '2px' }} />
      </span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
    </button>
  )
}

function hex(color, alpha) {
  const c = (color ?? '#6366F1').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
