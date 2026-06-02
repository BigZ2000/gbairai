import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import { Building2, Loader2, Check, X } from 'lucide-react'

export default function InvitationAccept() {
  const { token } = useParams()
  const { apiFetch } = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch(`/organisations/invitation/${token}`).then(async r => {
      if (r?.ok) setPreview(await r.json())
      else setError("Cette invitation n'est plus valide.")
    }).finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setJoining(true); setError('')
    const res = await apiFetch(`/organisations/invitation/${token}/accept`, { method: 'POST' })
    setJoining(false)
    if (res?.ok) { navigate('/organisation') }
    else { const e = await res?.json().catch(() => ({})); setError(e?.error ?? 'Impossible de rejoindre.') }
  }

  return (
    <Layout maxWidth="max-w-md">
      <div className="card p-8 text-center mt-8">
        {loading ? <Loader2 size={22} className="animate-spin mx-auto my-6" style={{ color: '#5A5A6E' }} /> : error && !preview ? (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <X size={26} style={{ color: '#F87171' }} />
            </div>
            <h1 className="text-lg font-bold mb-2" style={{ color: '#ECECF0' }}>Invitation invalide</h1>
            <p className="text-sm mb-5" style={{ color: '#9090A0' }}>{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full">Retour au Dashboard</button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(14,165,233,0.12)' }}>
              <Building2 size={26} style={{ color: '#38BDF8' }} />
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#ECECF0' }}>Rejoindre {preview.organisationNom}</h1>
            <p className="text-sm mb-1" style={{ color: '#9090A0' }}>Tu as été invité à rejoindre cette organisation sur Gbairai.</p>
            <p className="text-2xs mb-6" style={{ color: '#5A5A6E' }}>{preview.places} place{preview.places !== 1 ? 's' : ''} disponible{preview.places !== 1 ? 's' : ''}</p>
            {error && <p className="text-sm mb-3" style={{ color: '#F87171' }}>{error}</p>}
            <div className="flex flex-col gap-2">
              <button onClick={accept} disabled={joining} className="btn-primary w-full gap-2">
                {joining ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} />Rejoindre l'organisation</>}
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn-ghost w-full">Plus tard</button>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
