import React, { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Loader2, TrendingUp, Users, Wallet, Repeat, Package, UserPlus } from 'lucide-react'
import { LineChart, Donut, BarChart } from '../../components/Charts.jsx'

function fmtFCFA(n) { return (n ?? 0).toLocaleString('fr-FR') + ' FCFA' }
function fmtK(n) { return (n ?? 0) >= 1000 ? Math.round(n / 1000) + 'k' : String(n ?? 0) }
const PLAN_COLORS = { FREE: 'var(--text-muted)', PRO: '#6366F1', ENTREPRISE: '#0EA5E9', ECOLE: '#22C55E' }

export default function AdminAnalytics() {
  const { apiFetch } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => { apiFetch('/admin/analytics').then(r => r?.ok && r.json()).then(setData) }, [])

  if (!data) return <AdminLayout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: 'var(--text-dim)' }} /></AdminLayout>

  const totalAbonnes = Object.values(data.abonnes).reduce((s, v) => s + v, 0) || 1

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Analytiques business</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>Revenus, abonnés et conversion.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon={Wallet} label="Revenus totaux" value={fmtFCFA(data.revenus)} color="#22C55E" />
        <Kpi icon={Users} label="Utilisateurs" value={data.totalUsers} sub={`${data.payants} payants`} color="#6366F1" />
        <Kpi icon={Repeat} label="Taux de conversion" value={`${data.tauxConversion}%`} color="#F59E0B" />
        <Kpi icon={TrendingUp} label="Abonnements actifs" value={data.abonnementsActifs} color="#0EA5E9" />
      </div>

      {/* Courbes : revenus + inscriptions (6 mois) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={15} style={{ color: '#22C55E' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Revenus (6 mois)</h2>
            <span className="text-2xs ml-auto" style={{ color: 'var(--text-dim)' }}>{fmtFCFA(data.revenus)} cumulés</span>
          </div>
          <LineChart data={data.revenusParMois ?? []} color="#22C55E" format={fmtK} />
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={15} style={{ color: '#6366F1' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Inscriptions (6 mois)</h2>
          </div>
          <LineChart data={data.inscriptionsParMois ?? []} color="#818CF8" />
        </div>
      </div>

      {/* Bar chart : revenus mensuels en barres (complément visuel de la courbe) */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={15} style={{ color: '#0EA5E9' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Revenus mensuels (barres)</h2>
        </div>
        <BarChart data={data.revenusParMois ?? []} color="#0EA5E9" height={200} format={fmtK} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Répartition des abonnés (donut) */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Répartition par plan</h2>
          <Donut data={Object.entries(data.abonnes).sort((a, b) => b[1] - a[1])
            .map(([plan, n]) => ({ label: plan, value: n, color: PLAN_COLORS[plan] ?? '#6366F1' }))} />
          <div className="mt-5 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border)' }}>
            <MiniStat label="Revenus abonnements" value={fmtFCFA(data.revenusAbonnements)} />
            <MiniStat label="Revenus packs" value={fmtFCFA(data.revenusPacks)} />
          </div>
        </div>

        {/* Top packs vendus */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Package size={16} style={{ color: '#818CF8' }} />Packs les plus vendus
          </h2>
          {data.topPacks.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-dim)' }}>Aucune vente de pack pour l'instant.</p>
          ) : (
            <div className="space-y-2">
              {data.topPacks.map((p, i) => (
                <div key={p.packId} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--hover-overlay)' }}>
                  <span className="text-sm font-bold w-5 text-center" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
                  <span className="text-lg">{p.emoji}</span>
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{p.nom}</span>
                  <div className="text-right">
                    <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{p.ventes} ventes</div>
                    <div className="text-2xs" style={{ color: 'var(--text-dim)' }}>{fmtFCFA(p.revenus)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function Kpi({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: hex(color, 0.15) }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
      <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{label}{sub ? ` · ${sub}` : ''}</p>
    </div>
  )
}
function MiniStat({ label, value }) {
  return (<div><p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{label}</p><p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{value}</p></div>)
}
function hex(color, alpha) {
  const c = (color ?? '#6366F1').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
