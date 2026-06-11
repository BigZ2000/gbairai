import React, { useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { fmtFCFA } from './Abonnements.jsx'
import { CheckCircle2, ArrowRight, Receipt } from 'lucide-react'

export default function Confirmation() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { apiFetch, setUser } = useAuth()
  const offre = state?.offre

  // Rafraîchit le plan effectif en mémoire (le serveur l'a mis à jour).
  useEffect(() => {
    apiFetch('/billing/me').then(r => r?.json()).then(d => {
      if (d?.plan) setUser(u => u ? { ...u, plan: d.plan } : u)
    }).catch(() => {})
  }, [])

  return (
    <Layout maxWidth="max-w-lg">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(34,197,94,0.12)' }}>
          <CheckCircle2 size={32} style={{ color: '#22C55E' }} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Paiement réussi</h1>
        {offre ? (
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
            Ton abonnement <strong style={{ color: 'var(--text)' }}>{offre.nom}</strong> est désormais actif.
          </p>
        ) : (
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Ta commande a bien été enregistrée.</p>
        )}
        {state?.montant != null && (
          <p className="text-2xs mb-6" style={{ color: 'var(--text-dim)' }}>
            Montant : {fmtFCFA(state.montant)} · Réf. {state?.reference}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Link to="/dashboard" className="btn-primary w-full gap-2">
            Accéder au Dashboard <ArrowRight size={15} />
          </Link>
          <Link to="/paiements" className="btn-ghost w-full gap-2">
            <Receipt size={14} />Voir mes paiements
          </Link>
        </div>
      </div>
    </Layout>
  )
}
