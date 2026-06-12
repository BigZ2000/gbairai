import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { Check, Loader2, Crown, Building2, Sparkles, ArrowLeft, ChevronRight, MailWarning } from 'lucide-react'

export function fmtFCFA(n) {
  return (n ?? 0).toLocaleString('fr-FR') + ' FCFA'
}

// 3 familles côté UX. L'Organisation regroupe toutes les offres multi-utilisateurs.
const FAMILLES = {
  gratuit: { icon: Sparkles, couleur: 'var(--text-muted)', titre: 'Gratuit', sousTitre: 'Pour découvrir Gbairai' },
  pro:     { icon: Crown,    couleur: '#6366F1', titre: 'Pro',     sousTitre: 'Animateurs, associations, événements et créateurs' },
  org:     { icon: Building2, couleur: '#0EA5E9', titre: 'Organisation', sousTitre: 'Écoles, entreprises et structures à plusieurs' },
}

export default function Abonnements() {
  const { apiFetch, user } = useAuth()
  const navigate = useNavigate()
  const [offres, setOffres] = useState([])
  const [current, setCurrent] = useState('FREE')
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(null)
  const [orgSize, setOrgSize] = useState(null) // offre Org sélectionnée

  useEffect(() => {
    apiFetch('/billing/plans').then(r => r?.json()).then(d => {
      if (d) {
        setOffres(d.offres ?? [])
        setCurrent(d.current ?? 'FREE')
        const orgs = (d.offres ?? []).filter(o => o.categorie === 'ORGANISATION')
        if (orgs.length) setOrgSize(orgs[0])
      }
    }).finally(() => setLoading(false))
  }, [])

  const free = offres.find(o => o.code === 'FREE')
  const pro = offres.find(o => o.code === 'PRO')
  const orgOffres = offres.filter(o => o.categorie === 'ORGANISATION').sort((a, b) => a.sieges - b.sieges)

  async function subscribe(offre) {
    if (user?.isGuest) { navigate('/register'); return }           // invité → créer un compte
    if (!offre) return
    setSubscribing(offre.id)
    const res = await apiFetch('/billing/subscribe', { method: 'POST', body: { offreId: offre.id } })
    setSubscribing(null)
    if (res?.status === 403) {                                     // email non vérifié
      const e = await res.json().catch(() => ({}))
      if (e.code === 'EMAIL_NOT_VERIFIED' || e.code === 'NOT_VERIFIED') { navigate(verifyPath); return }
    }
    if (!res?.ok) return
    const data = await res.json()
    navigate('/abonnement/checkout', { state: { reference: data.reference, offre, montant: data.montant } })
  }

  const isGuest = !!user?.isGuest
  const isPhoneUser = (user?.email ?? '').endsWith('@phone.gbairai')
  const verified = isPhoneUser ? user?.phoneVerified : user?.emailVerified
  const needsVerify = user && !user.isGuest && verified === false
  const verifyPath = isPhoneUser ? '/verifier-telephone' : '/verifier-email'

  const isPro = current === 'PRO'
  const isOrg = current === 'ENTREPRISE' || current === 'ECOLE'

  return (
    <Layout maxWidth="max-w-4xl">
      <button onClick={() => navigate(isGuest ? '/invite' : '/dashboard')} className="btn-ghost btn-sm gap-1.5 mb-4">
        <ArrowLeft size={14} />Retour
      </button>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Choisis ton offre</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Simple, sans engagement. Change ou arrête quand tu veux.</p>
      </div>

      {/* Invité : consultation libre, mais il faut un compte pour s'abonner. */}
      {isGuest && (
        <div className="card p-4 mb-6 flex items-center gap-3" style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)' }}>
          <Sparkles size={18} style={{ color: '#818CF8' }} className="shrink-0" />
          <p className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>Tu es en mode invité — <strong style={{ color: 'var(--text)' }}>crée un compte</strong> pour t'abonner.</p>
          <button onClick={() => navigate('/register')} className="btn-primary btn-sm shrink-0">Créer un compte</button>
        </div>
      )}
      {/* Compte non vérifié : invite à confirmer l'email avant de payer. */}
      {needsVerify && (
        <div className="card p-4 mb-6 flex items-center gap-3" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <MailWarning size={18} style={{ color: '#F59E0B' }} className="shrink-0" />
          <p className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>Vérifie ton adresse email pour pouvoir t'abonner.</p>
          <button onClick={() => navigate(verifyPath)} className="btn-secondary btn-sm shrink-0">Vérifier</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-96 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Gratuit */}
          <Carte famille="gratuit" prixLabel="Gratuit"
            avantages={free?.fonctionnalites ?? []}
            cta={current === 'FREE' ? { label: 'Offre actuelle', disabled: true } : null} />

          {/* Pro */}
          <Carte famille="pro" populaire prixLabel={`${fmtFCFA(pro?.prix)} / mois`}
            avantages={pro?.fonctionnalites ?? []}
            cta={isPro ? { label: 'Offre actuelle', disabled: true } : { label: 'Choisir Pro', onClick: () => subscribe(pro), loading: subscribing === pro?.id }} />

          {/* Organisation */}
          <Carte famille="org" prixLabel={orgSize ? `dès ${fmtFCFA(orgOffres[0]?.prix)} / mois` : 'Sur mesure'}
            avantages={orgSize?.fonctionnalites ?? []}
            extra={
              <div className="mb-4">
                <p className="text-2xs mb-1.5" style={{ color: 'var(--text-dim)' }}>Combien d'utilisateurs ?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {orgOffres.map(o => (
                    <button key={o.id} onClick={() => setOrgSize(o)}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: orgSize?.id === o.id ? 'rgba(14,165,233,0.18)' : 'var(--hover-overlay)',
                        color: orgSize?.id === o.id ? '#38BDF8' : 'var(--text-muted)',
                        border: `1px solid ${orgSize?.id === o.id ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
                      }}>
                      {o.sieges} pers.
                    </button>
                  ))}
                </div>
                {orgSize && <p className="text-2xs mt-2" style={{ color: 'var(--text-muted)' }}>{fmtFCFA(orgSize.prix)} / mois · {orgSize.sieges} utilisateurs</p>}
              </div>
            }
            cta={isOrg ? { label: 'Offre actuelle', disabled: true } : { label: 'Choisir Organisation', onClick: () => subscribe(orgSize), loading: subscribing === orgSize?.id }} />
        </div>
      )}

      <p className="text-center text-2xs mt-6" style={{ color: 'var(--text-dim)' }}>
        Paiement en préparation (CinetPay) — démonstration sans débit réel.
      </p>
    </Layout>
  )
}

function Carte({ famille, prixLabel, avantages, cta, extra, populaire }) {
  const f = FAMILLES[famille]
  const Icon = f.icon
  return (
    <div className="relative rounded-2xl p-5 flex flex-col"
      style={{
        background: populaire ? `linear-gradient(160deg, ${hex(f.couleur, 0.12)}, var(--card-tint))` : 'var(--surface)',
        border: `1px solid ${populaire ? hex(f.couleur, 0.4) : 'var(--border)'}`,
      }}>
      {populaire && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-2xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: f.couleur, color: '#fff' }}>POPULAIRE</span>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: hex(f.couleur, 0.15) }}>
        <Icon size={18} style={{ color: f.couleur }} />
      </div>
      <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{f.titre}</h3>
      <p className="text-2xs mb-3" style={{ color: 'var(--text-dim)' }}>{f.sousTitre}</p>
      <p className="text-xl font-extrabold mb-4" style={{ color: 'var(--text)' }}>{prixLabel}</p>
      {extra}
      <ul className="space-y-2 mb-5 flex-1">
        {avantages.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text)' }}>
            <Check size={13} style={{ color: f.couleur, marginTop: 1 }} className="shrink-0" />{a}
          </li>
        ))}
      </ul>
      {cta ? (
        cta.disabled
          ? <button disabled className="btn-secondary w-full opacity-60">{cta.label}</button>
          : <button onClick={cta.onClick} disabled={cta.loading} className="btn-primary w-full gap-2" style={{ background: f.couleur }}>
              {cta.loading ? <Loader2 size={14} className="animate-spin" /> : <>{cta.label}<ChevronRight size={15} /></>}
            </button>
      ) : <div className="h-9" />}
    </div>
  )
}

function hex(color, alpha) {
  const c = (color ?? '#6366F1').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
