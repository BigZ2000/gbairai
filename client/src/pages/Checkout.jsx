import React, { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { fmtFCFA } from './Abonnements.jsx'
import { Loader2, ShieldCheck, Lock, ArrowLeft, Info } from 'lucide-react'

export default function Checkout() {
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  if (!state?.reference) return <Navigate to="/abonnement" replace />
  const { reference, offre, montant } = state

  async function pay() {
    setPaying(true); setError('')
    // Mode préparation : CinetPay n'est pas activé, on simule la confirmation.
    const res = await apiFetch('/billing/confirm', { method: 'POST', body: { reference, status: 'SUCCESS' } })
    setPaying(false)
    if (!res?.ok) { setError('Le paiement a échoué. Réessaie.'); return }
    navigate('/abonnement/confirmation', { state: { offre, montant, reference } })
  }

  return (
    <Layout maxWidth="max-w-lg">
      <button onClick={() => navigate('/abonnement')} className="btn-ghost btn-sm gap-1.5 mb-4">
        <ArrowLeft size={14} />Retour aux offres
      </button>

      <div className="card p-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>Récapitulatif de commande</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Vérifie ta commande avant de payer.</p>

        <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'var(--hover-overlay)' }}>
          <Row label="Offre" value={offre?.nom ?? 'Abonnement'} />
          {offre?.sieges > 1 && <Row label="Utilisateurs" value={`${offre.sieges} sièges`} />}
          <Row label="Durée" value={`${offre?.dureeJours ?? 30} jours`} />
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Total</span>
            <span className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>{fmtFCFA(montant)}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg mb-4 text-2xs"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
          <Info size={14} className="shrink-0 mt-0.5" />
          Paiement en mode démonstration — CinetPay n'est pas encore activé. Aucun montant réel ne sera débité.
        </div>

        {error && <p className="text-sm mb-3" style={{ color: '#F87171' }}>{error}</p>}

        <button onClick={pay} disabled={paying} className="btn-primary w-full btn-lg gap-2">
          {paying ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={15} />Payer {fmtFCFA(montant)}</>}
        </button>
        <p className="text-2xs text-center mt-3 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
          <ShieldCheck size={12} />Paiement sécurisé · Orange Money · MTN · Wave · Moov
        </p>
      </div>
    </Layout>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
