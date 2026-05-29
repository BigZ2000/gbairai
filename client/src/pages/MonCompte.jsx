import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import {
  Radio, Pencil, Unlink, Check, X, Link2, Wifi, WifiOff, Cpu, Palette, AtSign,
} from 'lucide-react'

const COULEURS = ['#6366F1','#8B5CF6','#3B82F6','#06B6D4','#22C55E','#F59E0B','#EF4444','#EC4899']

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type !== 'warn'
  return (
    <div className="fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fadeUp"
      style={{
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        color: ok ? '#4ADE80' : '#FCD34D',
      }}>
      <Check size={13} /> {toast.msg}
    </div>
  )
}

export default function MonCompte() {
  const { user, apiFetch } = useAuth()
  const [buzzers, setBuzzers] = useState([])
  const [claimMac, setClaimMac] = useState('')
  const [claimError, setClaimError] = useState('')
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
    setTimeout(() => setToast(null), 3000)
  }

  async function handleClaim(e) {
    e.preventDefault()
    setClaimError('')
    const res = await apiFetch('/buzzers/claim', { method: 'POST', body: { mac: claimMac.toUpperCase() } })
    if (!res?.ok) {
      const err = await res?.json().catch(() => ({}))
      setClaimError(err?.error ?? 'Erreur')
      return
    }
    const buzzer = await res.json()
    setBuzzers(prev => [...prev.filter(b => b.mac !== buzzer.mac), buzzer])
    setClaimMac('')
    showToast('Buzzer appairé')
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

  const initial = (user?.username?.[0] ?? user?.prenom?.[0] ?? '?').toUpperCase()

  return (
    <Layout>
      <Toast toast={toast} />

      <h1 className="text-xl font-bold mb-6" style={{ color: '#ECECF0' }}>Mon compte</h1>

      <div className="max-w-lg space-y-5">

        {/* Profil */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0"
              style={{ background: '#6366F1' }}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold" style={{ color: '#ECECF0' }}>{user?.prenom}</p>
                {user?.username && (
                  <span className="flex items-center gap-0.5 text-xs" style={{ color: '#818CF8' }}>
                    <AtSign size={10} />{user.username}
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#9090A0' }}>{user?.email}</p>
              <span className="badge-indigo mt-2 inline-flex">{user?.plan ?? 'FREE'}</span>
            </div>
          </div>
        </div>

        {/* Buzzers */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Radio size={15} style={{ color: '#6366F1' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#ECECF0' }}>Mes buzzers</h2>
          </div>

          {buzzers.length === 0 ? (
            <p className="text-sm mb-5" style={{ color: '#5A5A6E' }}>Aucun buzzer appairé pour l'instant.</p>
          ) : (
            <ul className="space-y-2.5 mb-5">
              {buzzers.map(b => (
                <li key={b.id} className="rounded-lg p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {editingId === b.id ? (
                    <div className="space-y-3">
                      <input
                        type="text" placeholder="Nom du buzzer" value={editNom} maxLength={50}
                        onChange={e => setEditNom(e.target.value)}
                        className="input"
                      />
                      <div>
                        <p className="label flex items-center gap-1"><Palette size={11} />Couleur</p>
                        <div className="flex gap-2 flex-wrap">
                          {COULEURS.map(c => (
                            <button key={c} type="button" onClick={() => setEditCouleur(c)}
                              className="w-7 h-7 rounded-full transition-transform"
                              style={{
                                background: c,
                                transform: editCouleur === c ? 'scale(1.2)' : 'scale(1)',
                                outline: editCouleur === c ? `2px solid ${c}` : 'none',
                                outlineOffset: '2px',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(b.mac)} className="btn-primary btn-sm gap-1">
                          <Check size={12} />Enregistrer
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm gap-1">
                          <X size={12} />Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="sm" />
                        <div>
                          <p className="font-medium text-sm" style={{ color: '#ECECF0' }}>{b.nom ?? 'Sans nom'}</p>
                          <p className="text-2xs font-mono mt-0.5" style={{ color: '#5A5A6E' }}>{b.mac}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {b.status === 'ONLINE' || b.status === 'IN_GAME'
                              ? <Wifi size={10} style={{ color: b.status === 'IN_GAME' ? '#F59E0B' : '#22C55E' }} />
                              : <WifiOff size={10} style={{ color: '#5A5A6E' }} />}
                            <span className="text-2xs font-medium" style={{
                              color: b.status === 'ONLINE' ? '#22C55E' : b.status === 'IN_GAME' ? '#F59E0B' : b.status === 'AWAITING_CLAIM' ? '#818CF8' : '#5A5A6E'
                            }}>
                              {b.status === 'ONLINE' ? 'Connecté' : b.status === 'IN_GAME' ? 'En jeu' : b.status === 'AWAITING_CLAIM' ? 'Appairage…' : 'Hors ligne'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditingId(b.id); setEditNom(b.nom ?? ''); setEditCouleur(b.couleur) }}
                          className="btn-ghost btn-sm" title="Renommer">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setReleaseConfirm(b)} disabled={b.status === 'IN_GAME'}
                          className="btn-danger btn-sm" title="Libérer">
                          <Unlink size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg p-4" style={{ background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.2)' }}>
            <p className="text-sm font-medium mb-1 flex items-center gap-1.5" style={{ color: '#ECECF0' }}>
              <Link2 size={13} style={{ color: '#6366F1' }} />Ajouter un buzzer
            </p>
            <p className="text-xs mb-3" style={{ color: '#5A5A6E' }}>
              Entrez l'adresse MAC inscrite sous le buzzer, puis maintenez le bouton 3 s.
            </p>
            <form onSubmit={handleClaim} className="flex gap-2">
              <div className="relative flex-1">
                <Cpu size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#5A5A6E' }} />
                <input
                  type="text" value={claimMac} placeholder="AA:BB:CC:DD:EE:FF"
                  onChange={e => setClaimMac(e.target.value)}
                  className="input pl-8 font-mono text-sm"
                />
              </div>
              <button type="submit" disabled={!claimMac.trim()} className="btn-primary btn-sm shrink-0">
                Appairer
              </button>
            </form>
            {claimError && <p className="text-xs mt-2" style={{ color: '#F87171' }}>{claimError}</p>}
          </div>
        </div>
      </div>

      {releaseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-xs w-full animate-scaleIn"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-semibold mb-1" style={{ color: '#F87171' }}>Libérer ce buzzer ?</h3>
            <p className="text-sm mb-1" style={{ color: '#ECECF0' }}>{releaseConfirm.nom ?? releaseConfirm.mac}</p>
            <p className="text-sm mb-5" style={{ color: '#9090A0' }}>
              Il pourra être réclamé par quelqu'un d'autre. Action irréversible.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleRelease(releaseConfirm.mac)} className="btn-danger flex-1">Confirmer</button>
              <button onClick={() => setReleaseConfirm(null)} className="btn-ghost flex-1">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
