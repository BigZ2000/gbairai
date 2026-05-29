import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

const COULEURS = ['#7C3AED','#A855F7','#3B82F6','#06B6D4','#10B981','#F59E0B','#EF4444','#EC4899']

export default function MonCompte() {
  const { user, apiFetch } = useAuth()
  const [buzzers, setBuzzers] = useState([])
  const [claimMac, setClaimMac] = useState('')
  const [claimError, setClaimError] = useState('')
  const [claimSuccess, setClaimSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editNom, setEditNom] = useState('')
  const [editCouleur, setEditCouleur] = useState('')
  const [releaseConfirm, setReleaseConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    apiFetch('/buzzers').then(r => r?.json()).then(b => { if (Array.isArray(b)) setBuzzers(b) })
  }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleClaim(e) {
    e.preventDefault()
    setClaimError('')
    setClaimSuccess('')
    const res = await apiFetch('/buzzers/claim', { method: 'POST', body: { mac: claimMac.toUpperCase() } })
    if (!res?.ok) {
      const err = await res?.json().catch(() => ({}))
      setClaimError(err?.error ?? 'Erreur')
      return
    }
    const buzzer = await res.json()
    setBuzzers(prev => [...prev.filter(b => b.mac !== buzzer.mac), buzzer])
    setClaimMac('')
    showToast(`Buzzer ${buzzer.mac.slice(-5)} appairé !`)
  }

  async function handleSaveEdit(mac) {
    const res = await apiFetch(`/buzzers/${mac}`, {
      method: 'PATCH',
      body: { nom: editNom.trim() || undefined, couleur: editCouleur || undefined },
    })
    if (res?.ok) {
      const updated = await res.json()
      setBuzzers(prev => prev.map(b => b.mac === mac ? updated : b))
      showToast('Buzzer mis à jour')
    }
    setEditingId(null)
  }

  async function handleRelease(mac) {
    const res = await apiFetch(`/buzzers/${mac}/claim`, { method: 'DELETE' })
    if (res?.ok) {
      setBuzzers(prev => prev.filter(b => b.mac !== mac))
      showToast('Buzzer libéré', 'warn')
    }
    setReleaseConfirm(null)
  }

  function getBuzzerStatut(b) {
    if (b.status === 'IN_GAME')        return 'pressed'
    if (b.status === 'OFFLINE')        return 'offline'
    if (b.status === 'AWAITING_CLAIM') return 'offline'
    return 'ready'
  }

  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fadeIn"
          style={{ background: toast.type === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', border: `1px solid ${toast.type === 'warn' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`, color: toast.type === 'warn' ? '#FBBF24' : '#34D399' }}>
          {toast.type === 'warn' ? '⚠' : '✓'} {toast.msg}
        </div>
      )}

      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-3xl font-black text-white">Mon compte</h1>

        {/* Profil */}
        <div className="card p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}>
            {user?.prenom?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-bold text-white">{user?.prenom}</p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(156,163,175,0.7)' }}>{user?.email}</p>
            <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(124,58,237,0.2)', color: '#C4B5FD' }}>
              {user?.plan ?? 'FREE'}
            </span>
          </div>
        </div>

        {/* Buzzers */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <span>🔔</span> Mes buzzers
          </h2>

          {buzzers.length === 0 ? (
            <p className="text-sm mb-5" style={{ color: 'rgba(156,163,175,0.6)' }}>
              Aucun buzzer appairé pour l'instant.
            </p>
          ) : (
            <ul className="space-y-4 mb-6">
              {buzzers.map(b => (
                <li key={b.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {editingId === b.id ? (
                    <div className="space-y-3">
                      <input
                        type="text" placeholder="Nom du buzzer" value={editNom} maxLength={50}
                        onChange={e => setEditNom(e.target.value)}
                        className="input"
                      />
                      <div>
                        <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)' }}>Couleur</p>
                        <div className="flex gap-2 flex-wrap">
                          {COULEURS.map(c => (
                            <button key={c} onClick={() => setEditCouleur(c)}
                              className="w-8 h-8 rounded-full transition-transform"
                              style={{ background: c, transform: editCouleur === c ? 'scale(1.25)' : 'scale(1)', boxShadow: editCouleur === c ? `0 0 10px ${c}` : 'none', outline: editCouleur === c ? `2px solid white` : 'none', outlineOffset: '2px' }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleSaveEdit(b.mac)} className="btn-primary text-sm px-4 py-2">Enregistrer</button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost text-sm px-4 py-2">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="md" />
                        <div>
                          <p className="font-bold text-white">{b.nom ?? 'Sans nom'}</p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(156,163,175,0.5)' }}>{b.mac}</p>
                          <p className="text-xs mt-1 font-medium" style={{
                            color: b.status === 'ONLINE' ? '#34D399' : b.status === 'IN_GAME' ? '#FBBF24' : b.status === 'AWAITING_CLAIM' ? '#A855F7' : '#6B7280'
                          }}>
                            {b.status === 'ONLINE' ? '● Connecté' : b.status === 'IN_GAME' ? '● En jeu' : b.status === 'AWAITING_CLAIM' ? '● Appairage...' : '● Hors ligne'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => { setEditingId(b.id); setEditNom(b.nom ?? ''); setEditCouleur(b.couleur) }}
                          className="text-sm font-medium transition-colors" style={{ color: '#C4B5FD' }}>
                          ✏ Renommer
                        </button>
                        <button onClick={() => setReleaseConfirm(b)} disabled={b.status === 'IN_GAME'}
                          className="text-sm font-medium disabled:opacity-30 transition-colors" style={{ color: '#F43F5E' }}>
                          ⚠ Libérer
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Ajouter un buzzer */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.3)' }}>
            <p className="text-sm font-semibold text-white mb-1">+ Ajouter un buzzer</p>
            <p className="text-xs mb-3" style={{ color: 'rgba(156,163,175,0.6)' }}>
              Entrez l'adresse MAC imprimée sous le buzzer, puis maintenez le bouton 3 s.
            </p>
            <form onSubmit={handleClaim} className="flex gap-3">
              <input
                type="text" value={claimMac} placeholder="AA:BB:CC:DD:EE:FF"
                onChange={e => setClaimMac(e.target.value)}
                className="input flex-1 font-mono text-sm"
              />
              <button type="submit" disabled={!claimMac.trim()} className="btn-primary text-sm px-4 py-2 shrink-0">
                Appairer
              </button>
            </form>
            {claimError && <p className="text-xs mt-2" style={{ color: '#FB7185' }}>{claimError}</p>}
          </div>
        </div>
      </div>

      {/* Modal libération */}
      {releaseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-sm w-full animate-fadeIn" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#F43F5E' }}>Libérer ce buzzer ?</h3>
            <p className="text-sm mb-1 text-white font-semibold">{releaseConfirm.nom ?? releaseConfirm.mac}</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(156,163,175,0.7)' }}>
              Ce buzzer pourra être réclamé par quelqu'un d'autre. Action irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleRelease(releaseConfirm.mac)} className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', color: '#F43F5E' }}>
                Confirmer
              </button>
              <button onClick={() => setReleaseConfirm(null)} className="btn-ghost flex-1 py-2.5 text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
