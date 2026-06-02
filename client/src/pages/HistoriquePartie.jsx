import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  ArrowLeft, Trophy, Users, Clock, Zap, HelpCircle, Timer, Medal,
  CheckCircle2, ChevronDown, Loader2, Hash, LogIn, Activity,
} from 'lucide-react'

const RANK_COLORS = ['#F59E0B', '#94A3B8', '#B45309']

function fmtMs(ms) {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export default function HistoriquePartie() {
  const { id } = useParams()
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [openManche, setOpenManche] = useState(0)

  useEffect(() => {
    apiFetch(`/history/${id}`).then(async r => {
      if (!r?.ok) { setNotFound(true); return }
      setData(await r.json())
    })
  }, [id])

  if (notFound) {
    return (
      <Layout>
        <button onClick={() => navigate('/historique')} className="btn-ghost btn-sm gap-1 mb-4"><ArrowLeft size={14} />Retour</button>
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--text)' }}>Partie introuvable ou accès refusé.</p>
        </div>
      </Layout>
    )
  }
  if (!data) {
    return <Layout><div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }} /></div></Layout>
  }

  const finished = data.status === 'TERMINEE'
  const restricted = !!data.restricted
  const podium = [...data.participants].sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99) || b.score - a.score)

  const summary = restricted
    ? [
        { label: 'Joueurs', value: data.participants.length, icon: Users, color: '#6366F1' },
        { label: 'Questions', value: data.totalQuestions, icon: HelpCircle, color: '#8B5CF6' },
        {
          label: 'Progression',
          value: data.progress ? `${data.progress.current}/${data.progress.total}` : '—',
          icon: Activity, color: '#06B6D4',
        },
      ]
    : [
        { label: 'Joueurs', value: data.participants.length, icon: Users, color: '#6366F1' },
        { label: 'Questions', value: data.totalQuestions, icon: HelpCircle, color: '#8B5CF6' },
        { label: 'Buzz total', value: data.totalBuzz, icon: Zap, color: '#F59E0B' },
        { label: 'Temps moyen', value: fmtMs(data.tempsMoyenMs), icon: Timer, color: '#06B6D4' },
        { label: 'Durée', value: data.durationMin != null ? `${data.durationMin} min` : '—', icon: Clock, color: '#22C55E' },
      ]

  return (
    <Layout>
      <button onClick={() => navigate('/historique')} className="btn-ghost btn-sm gap-1 mb-4"><ArrowLeft size={14} />Retour à l'historique</button>

      {/* En-tête */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{data.nom}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-2xs" style={{ color: 'var(--text-dim)' }}>
              <span className="code-tag flex items-center gap-1"><Hash size={9} />{data.code}</span>
              <span>{new Date(data.createdAt).toLocaleString('fr-FR')}</span>
              {data.pack && <span>{data.pack}</span>}
            </div>
          </div>
          <span className={data.status === 'TERMINEE' ? 'badge-done' : 'badge-active'}>
            {data.status === 'TERMINEE' ? 'Terminée' : data.status === 'EN_COURS' ? 'En cours' : data.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          {summary.map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                <Icon size={15} style={{ color: s.color }} />
                <p className="text-lg font-black mt-1.5" style={{ color: 'var(--text)' }}>{s.value}</p>
                <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{s.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Retour à la partie en cours — restauration automatique de l'état */}
      {data.canRejoin && (
        <button onClick={() => navigate(`/parties/${data.code}/jeu`)}
          className="w-full card p-4 mb-5 flex items-center gap-3 transition-all"
          style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(34,197,94,0.15)' }}>
            <LogIn size={18} style={{ color: '#4ADE80' }} />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {data.isAnimateur ? 'Retourner à la partie' : 'Rejoindre la partie'}
            </p>
            <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
              Cette partie est en cours — votre état, score et le média seront restaurés automatiquement.
            </p>
          </div>
          <ChevronDown size={16} style={{ color: '#4ADE80', transform: 'rotate(-90deg)' }} className="shrink-0" />
        </button>
      )}

      {/* Classement / participants */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
          <Trophy size={15} style={{ color: '#F59E0B' }} />Classement {finished ? 'final' : 'provisoire'}
        </h2>
        <div className="space-y-2">
          {podium.map((p, idx) => {
            const rank = p.rang ?? idx + 1
            const rankColor = RANK_COLORS[rank - 1]
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg p-3"
                style={{ background: 'var(--input-bg)', border: `1px solid ${rank <= 3 && rankColor ? `${rankColor}40` : 'var(--border)'}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
                  style={{ background: rankColor ? `${rankColor}22` : 'var(--hover-overlay)', color: rankColor ?? 'var(--text-muted)' }}>
                  {rank <= 3 ? <Medal size={15} /> : rank}
                </div>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.couleur }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{p.prenom}</p>
                  {!restricted && (
                    <div className="flex items-center gap-3 mt-0.5 text-2xs" style={{ color: 'var(--text-dim)' }}>
                      <span className="flex items-center gap-1"><Zap size={9} />{p.buzz} buzz</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={9} />{p.bonnes} bonnes</span>
                      <span className="flex items-center gap-1"><Timer size={9} />{fmtMs(p.tempsMoyenMs)}</span>
                    </div>
                  )}
                </div>
                <p className="text-lg font-black shrink-0" style={{ color: '#F59E0B' }}>{p.score}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Déroulé : manches & questions — masqué tant que la partie n'est pas terminée */}
      <div className="card p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
          <HelpCircle size={15} style={{ color: '#6366F1' }} />Déroulé de la partie
        </h2>
        {restricted ? (
          <p className="text-xs rounded-lg p-2.5" style={{ background: 'rgba(245,158,11,0.08)', color: '#FCD34D' }}>
            Le déroulé, les questions et les réponses ne seront consultables qu'une fois la partie terminée.
          </p>
        ) : (
        <div className="space-y-2">
          {data.manches.map((m, idx) => {
            const open = openManche === idx
            return (
              <div key={m.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button onClick={() => setOpenManche(open ? -1 : idx)}
                  className="w-full flex items-center justify-between gap-3 p-3" style={{ background: 'var(--input-bg)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xs font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#A5B4FC' }}>
                      Manche {m.ordre}
                    </span>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{m.nom}</p>
                    <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>· {m.questions.length} Q</span>
                  </div>
                  <ChevronDown size={16} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {open && (
                  <div className="p-3 space-y-2.5">
                    {m.questions.map((qq, qi) => (
                      <div key={qq.id} className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          <span style={{ color: 'var(--text-dim)' }}>{qi + 1}. </span>{qq.enonce}
                        </p>
                        {finished && qq.reponse && (
                          <p className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: '#4ADE80' }}>
                            <CheckCircle2 size={12} className="mt-0.5 shrink-0" />{qq.reponse}
                          </p>
                        )}
                        {finished && qq.explication && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{qq.explication}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>
    </Layout>
  )
}
