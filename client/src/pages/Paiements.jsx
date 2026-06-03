import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { fmtFCFA } from './Abonnements.jsx'
import { Receipt, Loader2, Sparkles } from 'lucide-react'

const STATUT_STYLE = {
  SUCCESS:   { bg: 'rgba(34,197,94,0.12)',  fg: '#22C55E', label: 'Payé' },
  PENDING:   { bg: 'rgba(245,158,11,0.12)', fg: '#F59E0B', label: 'En attente' },
  FAILED:    { bg: 'rgba(248,113,113,0.12)', fg: '#F87171', label: 'Échoué' },
  CANCELLED: { bg: 'rgba(90,90,110,0.18)',  fg: 'var(--text-muted)', label: 'Annulé' },
}

export default function Paiements() {
  const { apiFetch } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/billing/history').then(r => r?.json()).then(d => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [])

  return (
    <Layout maxWidth="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Receipt size={20} style={{ color: '#818CF8' }} />Mes paiements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>Historique de tes abonnements et achats.</p>
        </div>
        <Link to="/abonnement" className="btn-secondary btn-sm gap-1.5"><Sparkles size={13} />Voir les offres</Link>
      </div>

      {loading ? (
        <Loader2 size={22} className="animate-spin mx-auto my-12" style={{ color: 'var(--text-dim)' }} />
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <Receipt size={28} className="mx-auto mb-3" style={{ color: '#2A2A35' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>Aucun paiement pour le moment.</p>
          <Link to="/abonnement" className="btn-primary btn-sm">Découvrir les offres</Link>
        </div>
      ) : (
        <>
        {/* Mobile : cartes empilées */}
        <div className="space-y-2 md:hidden">
          {items.map(p => {
            const st = STATUT_STYLE[p.statut] ?? STATUT_STYLE.PENDING
            return (
              <div key={p.id} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                    {p.description ?? (p.plan ? `Abonnement ${p.plan}` : 'Achat')}
                  </span>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                    {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{fmtFCFA(p.montant)}</span>
                </div>
              </div>
            )
          })}
        </div>
        {/* Desktop : tableau */}
        <div className="card overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Description', 'Montant', 'Statut'].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(p => {
                const st = STATUT_STYLE[p.statut] ?? STATUT_STYLE.PENDING
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--input-bg)' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text)' }}>
                      {p.description ?? (p.plan ? `Abonnement ${p.plan}` : 'Achat')}
                      <div className="text-2xs font-mono" style={{ color: 'var(--text-dim)' }}>{p.reference}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{fmtFCFA(p.montant)}</td>
                    <td className="px-4 py-3">
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Layout>
  )
}
