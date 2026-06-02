import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  Search, Trophy, Users, Clock, Calendar, Filter, X, ChevronRight,
  Gamepad2, Bot, Vote, History as HistoryIcon, Loader2,
} from 'lucide-react'

const TYPE_META = {
  auto:      { label: 'Auto', icon: Bot, color: '#06B6D4' },
  vote:      { label: 'Vote', icon: Vote, color: '#8B5CF6' },
  animateur: { label: 'Animateur', icon: Gamepad2, color: '#6366F1' },
}
const STATUS_META = {
  EN_ATTENTE: { label: 'En attente', cls: 'badge-wait' },
  EN_COURS:   { label: 'En cours', cls: 'badge-active' },
  TERMINEE:   { label: 'Terminée', cls: 'badge-done' },
  ANNULEE:    { label: 'Annulée', cls: 'badge-done' },
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function Historique() {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [pack, setPack] = useState('')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    apiFetch('/history').then(r => r?.ok ? r.json() : []).then(setItems)
  }, [])

  // Liste des packs présents (pour le filtre).
  const packs = useMemo(() => {
    if (!items) return []
    const map = new Map()
    items.forEach(i => { if (i.packId && i.pack) map.set(i.packId, i.pack) })
    return [...map.entries()].map(([id, nom]) => ({ id, nom }))
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = q.trim().toLowerCase()
    return items.filter(i => {
      if (needle && !i.nom?.toLowerCase().includes(needle) && !i.code?.toLowerCase().includes(needle)) return false
      if (type && i.type !== type) return false
      if (pack && i.packId !== pack) return false
      if (status && i.status !== status) return false
      if (result === 'win' && i.rang !== 1) return false
      if (result === 'loss' && (i.rang == null || i.rang === 1)) return false
      return true
    })
  }, [items, q, type, pack, status, result])

  const activeFilters = [type, pack, result, status].filter(Boolean).length

  function clearFilters() { setType(''); setPack(''); setResult(''); setStatus('') }

  return (
    <Layout>
      <div className="flex items-center gap-2 mb-1">
        <HistoryIcon size={20} style={{ color: '#6366F1' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Historique</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Toutes vos parties jouées et créées.
      </p>

      {/* Recherche + bouton filtres */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input className="input pl-9" placeholder="Rechercher une partie…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button onClick={() => setShowFilters(s => !s)} className="btn-secondary btn-sm gap-1.5 shrink-0">
          <Filter size={13} />Filtres
          {activeFilters > 0 && (
            <span className="w-4 h-4 rounded-full text-2xs flex items-center justify-center text-white"
              style={{ background: '#6366F1' }}>{activeFilters}</span>
          )}
        </button>
      </div>

      {/* Panneau filtres */}
      {showFilters && (
        <div className="card p-4 mb-4 animate-fadeUp grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="">Tous</option>
              <option value="animateur">Animateur</option>
              <option value="auto">Auto</option>
              <option value="vote">Vote</option>
            </select>
          </div>
          <div>
            <label className="label">Pack</label>
            <select className="input" value={pack} onChange={e => setPack(e.target.value)}>
              <option value="">Tous</option>
              {packs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Résultat</label>
            <select className="input" value={result} onChange={e => setResult(e.target.value)}>
              <option value="">Tous</option>
              <option value="win">Victoires</option>
              <option value="loss">Défaites</option>
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Tous</option>
              <option value="TERMINEE">Terminée</option>
              <option value="EN_COURS">En cours</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="btn-ghost btn-sm gap-1 col-span-full justify-self-start">
              <X size={12} />Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      {items === null ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <HistoryIcon size={28} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {items.length === 0 ? 'Aucune partie pour le moment' : 'Aucun résultat'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            {items.length === 0 ? 'Lancez votre première partie depuis le tableau de bord.' : 'Essayez de modifier vos filtres.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(i => {
            const tm = TYPE_META[i.type] ?? TYPE_META.animateur
            const TIcon = tm.icon
            const st = STATUS_META[i.status] ?? STATUS_META.TERMINEE
            const isWin = i.rang === 1
            const clickable = i.status === 'TERMINEE' || i.status === 'EN_COURS'
            return (
              <button key={i.id} disabled={!clickable}
                onClick={() => clickable && navigate(`/historique/${i.id}`)}
                className="card w-full text-left p-4 flex items-center gap-4 transition-all"
                style={{ cursor: clickable ? 'pointer' : 'default', opacity: clickable ? 1 : 0.7 }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>

                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${tm.color}1A`, border: `1px solid ${tm.color}33` }}>
                  <TIcon size={17} style={{ color: tm.color }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{i.nom}</p>
                    <span className={st.cls}>{st.label}</span>
                    {isWin && <span className="badge" style={{ background: 'rgba(245,158,11,0.14)', color: '#FCD34D' }}><Trophy size={9} />1er</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-2xs" style={{ color: 'var(--text-dim)' }}>
                    <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(i.createdAt)} · {fmtTime(i.createdAt)}</span>
                    <span className="flex items-center gap-1"><Users size={10} />{i.joueurs}</span>
                    {i.durationMin != null && <span className="flex items-center gap-1"><Clock size={10} />{i.durationMin} min</span>}
                    {i.pack && <span className="truncate">{i.pack}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {i.status === 'TERMINEE' && (
                    <>
                      <p className="text-lg font-black" style={{ color: '#F59E0B' }}>{i.score}</p>
                      <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                        {i.rang != null ? `#${i.rang}` : '—'} pts
                      </p>
                    </>
                  )}
                  {i.status === 'EN_COURS' && (
                    <span role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); navigate(`/parties/${i.code}/jeu`) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`/parties/${i.code}/jeu`) } }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80' }}>
                      Reprendre →
                    </span>
                  )}
                </div>
                {clickable && <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
