import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'

const COULEURS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

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
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    apiFetch('/buzzers').then(r => r?.json()).then(b => { if (b) setBuzzers(b) })
  }, [])

  async function handleClaim(e) {
    e.preventDefault()
    setClaimError('')
    setClaimSuccess('')
    const res = await apiFetch('/buzzers/claim', { method: 'POST', body: { mac: claimMac.toUpperCase() } })
    if (!res?.ok) {
      const err = await res?.json()
      setClaimError(err?.error ?? 'Erreur')
      return
    }
    const buzzer = await res.json()
    setBuzzers(prev => [...prev.filter(b => b.mac !== buzzer.mac), buzzer])
    setClaimMac('')
    setClaimSuccess(`Buzzer ${buzzer.mac} appairé avec succès !`)
  }

  async function handleSaveEdit(mac) {
    const res = await apiFetch(`/buzzers/${mac}`, {
      method: 'PATCH',
      body: { nom: editNom || undefined, couleur: editCouleur || undefined },
    })
    if (res?.ok) {
      const updated = await res.json()
      setBuzzers(prev => prev.map(b => b.mac === mac ? updated : b))
    }
    setEditingId(null)
  }

  async function handleRelease(mac) {
    const res = await apiFetch(`/buzzers/${mac}/claim`, { method: 'DELETE' })
    if (res?.ok) {
      setBuzzers(prev => prev.filter(b => b.mac !== mac))
      setNotification('Buzzer libéré. Il peut maintenant être réclamé par quelqu\'un d\'autre.')
    }
    setReleaseConfirm(null)
  }

  function getBuzzerStatut(b) {
    if (b.status === 'OFFLINE') return 'offline'
    if (b.status === 'IN_GAME') return 'pressed'
    if (b.status === 'AWAITING_CLAIM') return 'offline'
    return 'ready'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Tableau de bord</Link>
        </div>

        <h1 className="text-3xl font-bold text-purple-400">Mon compte</h1>

        {/* Info utilisateur */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <p className="text-gray-400 text-sm">Prénom</p>
          <p className="text-xl font-bold">{user?.prenom}</p>
          <p className="text-gray-400 text-sm mt-3">Email</p>
          <p className="text-white">{user?.email}</p>
          <p className="text-gray-400 text-sm mt-3">Plan</p>
          <p className="text-white capitalize">{user?.plan?.toLowerCase()}</p>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-amber-500/20 border border-amber-500 rounded-xl p-4 text-amber-300 text-sm flex justify-between">
            {notification}
            <button onClick={() => setNotification(null)} className="ml-2 text-amber-400 hover:text-white">✕</button>
          </div>
        )}

        {/* MES BUZZERS */}
        <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-5">Mes buzzers</h2>

          {buzzers.length === 0 ? (
            <p className="text-gray-500 text-sm mb-4">Aucun buzzer appairé.</p>
          ) : (
            <ul className="space-y-4 mb-6">
              {buzzers.map(b => (
                <li key={b.id} className="bg-gray-800 rounded-xl p-4">
                  {editingId === b.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Nom du buzzer"
                        value={editNom}
                        onChange={e => setEditNom(e.target.value)}
                        maxLength={50}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {COULEURS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditCouleur(c)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${editCouleur === c ? 'scale-125 border-white' : 'border-transparent'}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(b.mac)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm">
                          Enregistrer
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white px-3 py-2 text-sm">
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <BuzzerAnime
                          couleur={b.couleur}
                          statut={getBuzzerStatut(b)}
                          size="md"
                        />
                        <div>
                          <p className="font-bold">{b.nom ?? 'Buzzer sans nom'}</p>
                          <p className="text-xs text-gray-400 font-mono">{b.mac}</p>
                          <p className="text-xs mt-1">
                            {b.status === 'OFFLINE' && <span className="text-gray-400">Hors ligne</span>}
                            {b.status === 'ONLINE' && <span className="text-green-400">Connecté</span>}
                            {b.status === 'IN_GAME' && <span className="text-amber-400">En jeu</span>}
                            {b.status === 'AWAITING_CLAIM' && <span className="text-purple-400">En attente d'appairage</span>}
                          </p>
                          {b.lastSeenAt && (
                            <p className="text-xs text-gray-500">
                              Vu {new Date(b.lastSeenAt).toLocaleString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => { setEditingId(b.id); setEditNom(b.nom ?? ''); setEditCouleur(b.couleur) }}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Renommer
                        </button>
                        <button
                          onClick={() => setReleaseConfirm(b)}
                          className="text-sm text-red-400 hover:text-red-300"
                          disabled={b.status === 'IN_GAME'}
                        >
                          ⚠️ Libérer
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Ajouter un buzzer */}
          <form onSubmit={handleClaim} className="space-y-3">
            <h3 className="font-semibold text-gray-300">Ajouter un buzzer</h3>
            <p className="text-xs text-gray-500">
              Entrez l'adresse MAC imprimée sous votre buzzer, puis maintenez le bouton 3 secondes.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                value={claimMac}
                onChange={e => setClaimMac(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl"
              >
                Appairer
              </button>
            </div>
            {claimError && <p className="text-red-400 text-sm">{claimError}</p>}
            {claimSuccess && <p className="text-green-400 text-sm">{claimSuccess}</p>}
          </form>
        </section>

        {/* Modal confirmation libération */}
        {releaseConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-red-800 shadow-2xl">
              <h3 className="text-xl font-bold text-red-400 mb-3">Libérer ce buzzer ?</h3>
              <p className="text-gray-300 text-sm mb-1">
                <strong>{releaseConfirm.nom ?? releaseConfirm.mac}</strong>
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Ce buzzer pourra être réclamé par quelqu'un d'autre. Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleRelease(releaseConfirm.mac)}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl"
                >
                  Confirmer la libération
                </button>
                <button
                  onClick={() => setReleaseConfirm(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
