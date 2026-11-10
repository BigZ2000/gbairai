import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import {
  Building2, Users, Loader2, Mail, Link2, Copy, Check, UserMinus, Pause, Play,
  Shield, ShieldCheck, ArrowLeft, Crown, Upload, ImageIcon, Pencil, Trash2,
} from 'lucide-react'

const TYPE_LABEL = {
  ENTREPRISE: 'Entreprise', ECOLE: 'École', UNIVERSITE: 'Université',
  ASSOCIATION: 'Association', ONG: 'ONG', COLLECTIVITE: 'Collectivité',
}
const ROLE_LABEL = { RESPONSABLE: 'Responsable', GESTIONNAIRE: 'Gestionnaire', MEMBRE: 'Membre' }

export default function MonOrganisation() {
  const { apiFetch, apiUpload, user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await apiFetch('/organisations/mine')
    if (res?.status === 404) { setNotFound(true); setLoading(false); return }
    if (res?.ok) setData(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [])

  async function invite() {
    if (!email.trim()) return
    setInviting(true)
    const res = await apiFetch(`/organisations/${data.organisation.id}/invitations`, { method: 'POST', body: { email: email.trim() } })
    setInviting(false)
    if (res?.ok) { setEmail(''); load() }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(data.organisation.lienInvitation)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  // Habillage : nom et logo affichés sur l'écran public, la salle d'attente et le bilan.
  const fichierLogo = useRef(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [habillageErreur, setHabillageErreur] = useState('')
  const [nomEdit, setNomEdit] = useState(null)
  async function envoyerLogo(f) {
    if (!f) return
    setLogoBusy(true); setHabillageErreur('')
    const fd = new FormData(); fd.append('file', f)
    const r = await apiUpload(`/organisations/${data.organisation.id}/logo`, fd)
    setLogoBusy(false)
    if (!r?.ok) { const d = await r?.json().catch(() => ({})); setHabillageErreur(d?.error ?? 'Logo refusé.'); return }
    load()
  }
  async function retirerLogo() {
    await apiFetch(`/organisations/${data.organisation.id}/logo`, { method: 'DELETE' })
    load()
  }
  async function enregistrerNom() {
    const nom = nomEdit?.trim()
    if (!nom) return
    const r = await apiFetch(`/organisations/${data.organisation.id}`, { method: 'PATCH', body: { nom } })
    if (r?.ok) { setNomEdit(null); load() } else setHabillageErreur('Nom refusé.')
  }

  async function setMembre(m, body) {
    await apiFetch(`/organisations/${data.organisation.id}/membres/${m.id}`, { method: 'PATCH', body })
    load()
  }
  async function removeMembre(m) {
    if (!confirm(`Retirer ${m.prenom || m.email} de l'organisation ?`)) return
    await apiFetch(`/organisations/${data.organisation.id}/membres/${m.id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <Layout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: 'var(--text-dim)' }} /></Layout>
  if (notFound) return (
    <Layout maxWidth="max-w-lg">
      <div className="card p-10 text-center">
        <Building2 size={28} className="mx-auto mb-3" style={{ color: '#4A382C' }} />
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>Aucune organisation</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Passe à l'offre Organisation pour gérer une équipe, une école ou une entreprise.</p>
        <button onClick={() => navigate('/abonnement')} className="btn-primary gap-2"><Crown size={15} />Voir l'offre Organisation</button>
      </div>
    </Layout>
  )

  const { organisation: org, membres, peutGerer } = data
  const pct = Math.round((org.siegesUtilises / org.sieges) * 100)

  return (
    <Layout maxWidth="max-w-4xl">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost btn-sm gap-1.5 mb-4"><ArrowLeft size={14} />Retour</button>

      {/* En-tête organisation */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {org.logoUrl
              ? <img src={org.logoUrl} alt="" className="w-12 h-12 rounded-xl object-contain" style={{ background: 'var(--input-bg)' }} />
              : <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--hover-overlay)' }}>
                  <Building2 size={22} style={{ color: 'var(--brand)' }} />
                </div>}
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{org.nom}</h1>
              <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                {TYPE_LABEL[org.type]} · Plan Organisation {org.sieges} utilisateurs
                {org.expireAt && <> · renouvellement le {new Date(org.expireAt).toLocaleDateString('fr-FR')}</>}
              </p>
            </div>
          </div>
          <div className="text-right min-w-[160px]">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {org.siegesUtilises} / {org.sieges} <span className="font-normal text-2xs" style={{ color: 'var(--text-dim)' }}>utilisateurs actifs</span>
            </p>
            <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? '#F59E0B' : '#38BDF8' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Habillage (gestionnaires) */}
      {peutGerer && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <ImageIcon size={16} style={{ color: 'var(--brand-text)' }} />Vos couleurs sur l'écran
          </h2>
          <p className="text-2xs mb-4" style={{ color: 'var(--text-dim)' }}>
            Le logo et le nom s'affichent sur le grand écran, dans la salle d'attente et sur le bilan des parties lancées par vos membres.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-28 h-20 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--input-bg)', border: '1px dashed var(--border-strong)' }}>
              {org.logoUrl ? <img src={org.logoUrl} alt="Logo actuel" className="max-w-full max-h-full object-contain p-2" /> : <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>Aucun logo</span>}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {nomEdit === null ? (
                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <span className="font-semibold truncate">{org.nom}</span>
                  <button onClick={() => setNomEdit(org.nom)} className="btn-ghost btn-sm gap-1"><Pencil size={12} />Renommer</button>
                </p>
              ) : (
                <div className="flex gap-2">
                  <input value={nomEdit} maxLength={120} onChange={e => setNomEdit(e.target.value)} className="input flex-1" aria-label="Nom de l'organisation"
                    onKeyDown={e => { if (e.key === 'Enter') enregistrerNom() }} autoFocus />
                  <button onClick={enregistrerNom} className="btn-primary btn-sm">OK</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input ref={fichierLogo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => { envoyerLogo(e.target.files?.[0]); e.target.value = '' }} />
                <button onClick={() => fichierLogo.current?.click()} disabled={logoBusy} className="btn-secondary btn-sm gap-1.5">
                  {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{org.logoUrl ? 'Changer le logo' : 'Ajouter le logo'}
                </button>
                {org.logoUrl && <button onClick={retirerLogo} className="btn-ghost btn-sm gap-1.5" style={{ color: '#C0392B' }}><Trash2 size={14} />Retirer</button>}
              </div>
              <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>PNG à fond transparent conseillé · 5 Mo max.</p>
              {habillageErreur && <p className="text-xs" role="alert" style={{ color: '#C0392B' }}>{habillageErreur}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Invitation (gestionnaires) */}
      {peutGerer && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Mail size={16} style={{ color: 'var(--brand-text)' }} />Inviter un collaborateur
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') invite() }}
              placeholder="email@exemple.com" className="input flex-1" />
            <button onClick={invite} disabled={inviting || !email.trim()} className="btn-primary gap-2 shrink-0">
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}Inviter
            </button>
            <button onClick={copyLink} className="btn-secondary gap-2 shrink-0">
              {copied ? <Check size={14} style={{ color: '#22C55E' }} /> : <Link2 size={14} />}
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
          <p className="text-2xs mt-2" style={{ color: 'var(--text-dim)' }}>
            Envoie un email d'invitation, ou partage simplement le lien : la personne rejoint en un clic.
          </p>
        </div>
      )}

      {/* Membres */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <Users size={15} style={{ color: 'var(--brand-text)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Membres ({membres.length})</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <tbody>
            {membres.map(m => {
              const isSelf = m.userId === user?.id
              const isResp = m.role === 'RESPONSABLE'
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--input-bg)' }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-2xs font-bold text-white"
                        style={{ background: m.statut === 'SUSPENDU' ? 'var(--text-dim)' : '#F26A1B' }}>
                        {(m.prenom?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text)' }}>
                          {m.prenom} {m.nom} {isSelf && <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>(vous)</span>}
                        </p>
                        <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: isResp ? 'rgba(234,179,8,0.12)' : 'rgba(242,106,27,0.12)', color: isResp ? '#EAB308' : 'var(--brand-text)' }}>
                      {isResp ? <ShieldCheck size={10} /> : <Shield size={10} />}{ROLE_LABEL[m.role]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {m.statut === 'SUSPENDU'
                      ? <span className="text-2xs" style={{ color: '#F59E0B' }}>Suspendu</span>
                      : <span className="text-2xs" style={{ color: '#22C55E' }}>Actif</span>}
                  </td>
                  <td className="px-5 py-3">
                    {peutGerer && !isResp && !isSelf && (
                      <div className="flex gap-0.5 justify-end">
                        {m.statut === 'ACTIF'
                          ? <button onClick={() => setMembre(m, { statut: 'SUSPENDU' })} className="btn-ghost btn-sm" title="Suspendre"><Pause size={13} /></button>
                          : <button onClick={() => setMembre(m, { statut: 'ACTIF' })} className="btn-ghost btn-sm" title="Réactiver" style={{ color: '#22C55E' }}><Play size={13} /></button>}
                        <button onClick={() => removeMembre(m)} className="btn-ghost btn-sm" style={{ color: '#F87171' }} title="Retirer"><UserMinus size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </Layout>
  )
}
