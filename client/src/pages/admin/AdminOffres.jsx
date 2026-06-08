import React, { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import Pagination, { usePagination } from '../../components/Pagination.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Pencil, Trash2, X, Check, Loader2, Eye, EyeOff, Star } from 'lucide-react'

const CATS = [['PERSONNEL', 'Personnel'], ['ORGANISATION', 'Organisation']]
const PLANS = ['FREE', 'PRO', 'ENTREPRISE', 'ECOLE']
const EMPTY = {
  code: '', nom: '', description: '', categorie: 'PERSONNEL', plan: 'PRO',
  prix: 0, dureeJours: 30, sieges: 1, fonctionnalites: [], couleur: '#6366F1',
  populaire: false, visible: true, ordre: 10,
}

export default function AdminOffres() {
  const { apiFetch } = useAuth()
  const [offres, setOffres] = useState([])
  const pg = usePagination(offres, 15)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  async function load() {
    setLoading(true)
    const res = await apiFetch('/admin/offres')
    if (res?.ok) setOffres(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function remove(o) {
    if (!confirm(`Supprimer l'offre « ${o.nom} » ? Préférez la masquer (visible = non).`)) return
    await apiFetch(`/admin/offres/${o.id}`, { method: 'DELETE' }); load()
  }
  async function toggleVisible(o) {
    await apiFetch(`/admin/offres/${o.id}`, { method: 'PATCH', body: { visible: !o.visible } }); load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Offres</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>Catalogue commercial — piloté ici, jamais dans le code.</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary gap-2"><Plus size={14} />Nouvelle offre</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Offre', 'Catégorie', 'Plan', 'Prix', 'Durée', 'Sièges', 'Abonnés', 'Visible', ''].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pg.slice.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--input-bg)' }} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.couleur }} />
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{o.nom}</span>
                    {o.populaire && <Star size={11} style={{ color: '#EAB308', fill: '#EAB308' }} />}
                    <span className="text-2xs font-mono" style={{ color: 'var(--text-dim)' }}>{o.code}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{o.categorie}</td>
                <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{o.plan}</td>
                <td className="px-3 py-3 font-medium" style={{ color: 'var(--text)' }}>{o.prix.toLocaleString('fr-FR')} F</td>
                <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{o.dureeJours} j</td>
                <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{o.sieges}</td>
                <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{o.abonnesPlan}</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggleVisible(o)} className="btn-ghost btn-sm">
                    {o.visible ? <Eye size={13} style={{ color: '#22C55E' }} /> : <EyeOff size={13} style={{ color: 'var(--text-dim)' }} />}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-0.5 justify-end">
                    <button onClick={() => setEditing({ ...o })} className="btn-ghost btn-sm"><Pencil size={13} /></button>
                    <button onClick={() => remove(o)} className="btn-ghost btn-sm" style={{ color: '#F87171' }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && offres.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>Aucune offre</td></tr>}
            {loading && <tr><td colSpan={9} className="px-4 py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: 'var(--text-dim)' }} /></td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pg.page} pages={pg.pages} total={pg.total} perPage={pg.perPage} onPage={pg.setPage} />

      {editing && <OffreEditor offre={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </AdminLayout>
  )
}

function OffreEditor({ offre, onClose, onSaved }) {
  const { apiFetch } = useAuth()
  const [form, setForm] = useState(offre)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [featInput, setFeatInput] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isNew = !form.id

  async function save() {
    setSaving(true); setErr('')
    const body = {
      code: form.code, nom: form.nom, description: form.description ?? '', categorie: form.categorie,
      plan: form.plan, prix: Number(form.prix) || 0, dureeJours: Number(form.dureeJours) || 0,
      sieges: Number(form.sieges) || 1, fonctionnalites: form.fonctionnalites ?? [],
      couleur: form.couleur, populaire: !!form.populaire, visible: !!form.visible, ordre: Number(form.ordre) || 0,
    }
    const res = await apiFetch(isNew ? '/admin/offres' : `/admin/offres/${form.id}`, { method: isNew ? 'POST' : 'PATCH', body })
    setSaving(false)
    if (res?.ok) onSaved()
    else { const e = await res?.json().catch(() => ({})); setErr(typeof e?.error === 'string' ? e.error : 'Erreur de validation') }
  }
  function addFeat() { const t = featInput.trim(); if (t) { set('fonctionnalites', [...(form.fonctionnalites ?? []), t]); setFeatInput('') } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-scaleIn space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{isNew ? 'Nouvelle offre' : 'Modifier l\'offre'}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>
        {err && <p className="text-sm" style={{ color: '#F87171' }}>{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <F label="Code *"><input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} className="input w-full font-mono" placeholder="PRO" /></F>
          <F label="Nom *"><input value={form.nom} onChange={e => set('nom', e.target.value)} className="input w-full" /></F>
        </div>
        <F label="Description"><textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2} className="input w-full resize-none" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Catégorie"><select value={form.categorie} onChange={e => set('categorie', e.target.value)} className="input w-full">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Plan interne"><select value={form.plan} onChange={e => set('plan', e.target.value)} className="input w-full">{PLANS.map(p => <option key={p} value={p}>{p}</option>)}</select></F>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <F label="Prix (FCFA)"><input type="number" min={0} value={form.prix} onChange={e => set('prix', e.target.value)} className="input w-full" /></F>
          <F label="Durée (jours)"><input type="number" min={0} value={form.dureeJours} onChange={e => set('dureeJours', e.target.value)} className="input w-full" /></F>
          <F label="Sièges"><input type="number" min={1} value={form.sieges} onChange={e => set('sieges', e.target.value)} className="input w-full" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Couleur"><div className="flex gap-2"><input type="color" value={form.couleur} onChange={e => set('couleur', e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-transparent" /><input value={form.couleur} onChange={e => set('couleur', e.target.value)} className="input flex-1 font-mono" /></div></F>
          <F label="Ordre d'affichage"><input type="number" value={form.ordre} onChange={e => set('ordre', e.target.value)} className="input w-full" /></F>
        </div>
        <F label="Avantages affichés">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(form.fonctionnalites ?? []).map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>
                {t}<button onClick={() => set('fonctionnalites', form.fonctionnalites.filter((_, j) => j !== i))}><X size={10} /></button>
              </span>
            ))}
          </div>
          <input value={featInput} onChange={e => setFeatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeat() } }} placeholder="Ajouter un avantage + Entrée" className="input w-full" />
        </F>
        <div className="flex gap-4">
          <Toggle label="⭐ Populaire" checked={!!form.populaire} onChange={v => set('populaire', v)} />
          <Toggle label="Visible" checked={!!form.visible} onChange={v => set('visible', v)} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving || !form.nom || !form.code} className="btn-primary gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

function F({ label, children }) { return (<div><label className="label">{label}</label>{children}</div>) }
function Toggle({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 py-1">
      <span className="w-9 h-5 rounded-full transition-all relative shrink-0" style={{ background: checked ? '#6366F1' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: checked ? '18px' : '2px' }} />
      </span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
    </button>
  )
}
