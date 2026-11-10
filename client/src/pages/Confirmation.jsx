import React, { useEffect, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { fmtFCFA } from './Abonnements.jsx'
import { CheckCircle2, ArrowRight, Receipt, Loader2, XCircle, Smartphone } from 'lucide-react'

// Retour de paiement. La référence arrive dans l'URL (retour de CinetPay) ou
// dans l'état de navigation (démonstration). Le statut affiché est TOUJOURS
// celui du serveur, qui le vérifie lui-même auprès de CinetPay : un retour sur
// cette page ne prouve pas qu'un paiement a abouti.
const ATTENTE_MAX_MS = 3 * 60 * 1000

export default function Confirmation() {
  const { state, search } = useLocation()
  const { apiFetch, setUser } = useAuth()
  const reference = new URLSearchParams(search).get('ref') ?? state?.reference ?? null
  const [paiement, setPaiement] = useState(null)
  const [introuvable, setIntrouvable] = useState(!reference)
  const debut = useRef(Date.now())

  useEffect(() => {
    if (!reference) return
    let fini = false
    let minuteur
    async function suivre() {
      const r = await apiFetch(`/billing/paiements/${encodeURIComponent(reference)}`)
      if (fini) return
      if (!r?.ok) { setIntrouvable(true); return }
      const p = await r.json()
      setPaiement(p)
      if (p.statut === 'SUCCESS') {
        // Le plan vient de changer côté serveur : on le reflète en mémoire.
        const me = await apiFetch('/billing/me').then(x => x?.json()).catch(() => null)
        if (me?.plan) setUser(u => (u ? { ...u, plan: me.plan } : u))
        return
      }
      if (p.statut === 'PENDING' && Date.now() - debut.current < ATTENTE_MAX_MS) minuteur = setTimeout(suivre, 3000)
    }
    suivre()
    return () => { fini = true; clearTimeout(minuteur) }
  }, [reference])

  const statut = paiement?.statut
  const enAttente = !introuvable && (!paiement || statut === 'PENDING')

  return (
    <Layout maxWidth="max-w-lg">
      <div className="card p-8 text-center" aria-live="polite">
        {introuvable ? (
          <>
            <XCircle size={36} className="mx-auto mb-3" style={{ color: 'var(--text-dim)' }} />
            <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Paiement introuvable</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Retrouve tous tes règlements dans « Mes paiements ».</p>
          </>
        ) : statut === 'SUCCESS' ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(18,153,95,0.12)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--leaf)' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>C'est réglé !</h1>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{paiement.description ?? 'Ta commande'} : c'est actif dès maintenant.</p>
            <p className="text-2xs mb-6" style={{ color: 'var(--text-dim)' }}>{fmtFCFA(paiement.montant)} · Réf. {paiement.reference}</p>
          </>
        ) : enAttente ? (
          <>
            <Loader2 size={34} className="animate-spin mx-auto mb-4" style={{ color: 'var(--brand)' }} />
            <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Paiement en cours de confirmation</h1>
            <p className="text-sm mb-2 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Smartphone size={15} />Valide l'opération sur ton téléphone si ce n'est pas déjà fait.
            </p>
            <p className="text-2xs mb-6" style={{ color: 'var(--text-dim)' }}>Cette page se met à jour toute seule.</p>
            {paiement?.paymentUrl && Date.now() - debut.current > 20000 && (
              <a href={paiement.paymentUrl} className="btn-secondary w-full mb-2">Reprendre le paiement</a>
            )}
          </>
        ) : (
          <>
            <XCircle size={36} className="mx-auto mb-3" style={{ color: '#C0392B' }} />
            <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Paiement non abouti</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Aucun montant n'a été activé. Tu peux réessayer quand tu veux.</p>
            <Link to="/abonnement" className="btn-primary w-full mb-2">Réessayer</Link>
          </>
        )}

        <div className="flex flex-col gap-2">
          {statut === 'SUCCESS' && (
            <Link to="/dashboard" className="btn-primary w-full gap-2">Commencer <ArrowRight size={15} /></Link>
          )}
          <Link to="/paiements" className="btn-ghost w-full gap-2"><Receipt size={14} />Mes paiements</Link>
        </div>
      </div>
    </Layout>
  )
}
