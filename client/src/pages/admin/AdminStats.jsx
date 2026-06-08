import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { HelpCircle, Users, Tag, Gamepad2, Loader2, UserPlus, Activity } from 'lucide-react'
import { BarChart, LineChart, Donut } from '../../components/Charts.jsx'

const TYPE_COLORS = { BUZZER: '#818CF8', QCM: '#4ADE80', VRAI_FAUX: '#FCD34D', IMAGE: '#F87171', AUDIO: '#C084FC', VIDEO: '#2DD4BF' }

export default function AdminStats() {
  const { apiFetch } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiFetch('/admin/stats').then(r => r?.json()).then(d => { if (d) setStats(d) })
  }, [])

  if (!stats) return <AdminLayout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: 'var(--text-dim)' }} /></AdminLayout>

  const cards = [
    { label: 'Utilisateurs', value: stats.users,      icon: Users,      color: '#818CF8' },
    { label: 'Questions',    value: stats.questions,   icon: HelpCircle, color: '#4ADE80' },
    { label: 'Parties',      value: stats.parties,     icon: Gamepad2,   color: '#FCD34D' },
    { label: 'Catégories',   value: stats.categories,  icon: Tag,        color: '#F87171' },
  ]
  const typeDonut = (stats.questionsParType ?? []).map(d => ({ ...d, color: TYPE_COLORS[d.label] ?? '#6366F1' }))

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>Tableau de bord</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="card p-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: hex(c.color, 0.15) }}>
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <p className="text-3xl font-black mb-0.5" style={{ color: 'var(--text)' }}>{(c.value ?? 0).toLocaleString('fr-FR')}</p>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Courbes d'activité (14 derniers jours) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Panel icon={UserPlus} color="#818CF8" title="Inscriptions (14 j)" sub={`${sum(stats.inscriptionsParJour)} nouveaux`}>
          <LineChart data={stats.inscriptionsParJour} color="#818CF8" />
        </Panel>
        <Panel icon={Activity} color="#22C55E" title="Parties créées (14 j)" sub={`${sum(stats.partiesParJour)} parties`}>
          <LineChart data={stats.partiesParJour} color="#22C55E" />
        </Panel>
      </div>

      {/* Répartition des questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel icon={Tag} color="#F59E0B" title="Questions par catégorie">
          <BarChart data={(stats.questionsParCategorie ?? []).slice(0, 13)} color="#6366F1" height={210} />
        </Panel>
        <Panel icon={HelpCircle} color="#4ADE80" title="Questions par type">
          <div className="py-3"><Donut data={typeDonut} /></div>
        </Panel>
      </div>
    </AdminLayout>
  )
}

function Panel({ icon: Icon, color, title, sub, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color }} />
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h2>
        {sub && <span className="text-2xs ml-auto" style={{ color: 'var(--text-dim)' }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}
const sum = arr => (arr ?? []).reduce((s, d) => s + d.value, 0)
function hex(c, a) { const x = c.replace('#', ''); return `rgba(${parseInt(x.slice(0,2),16)},${parseInt(x.slice(2,4),16)},${parseInt(x.slice(4,6),16)},${a})` }
