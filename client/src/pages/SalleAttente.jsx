import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import JoinInvite from '../components/JoinInvite.jsx'
import BatteryBadge from '../components/BatteryBadge.jsx'
import {
  Users, Radio, Hash, Play, Plus, X, Loader2, SearchX, Wifi, WifiOff,
  GripVertical, Layers, Search, AtSign, Trash2, Ban, UserPlus, Pencil, Tv,
} from 'lucide-react'

const DIFF_LABELS = { MIXTE: 'Mixte', FACILE: 'Facile', MOYEN: 'Moyen', DIFFICILE: 'Difficile' }

export default function SalleAttente() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const { joinRoom, subscribe, send } = useWs()
  const navigate = useNavigate()

  const [partie, setPartie]             = useState(null)
  const [participants, setParticipants] = useState([])
  const [buzzersDispo, setBuzzersDispo] = useState([])
  const [draggingBuzzer, setDraggingBuzzer] = useState(null)
  const [dragOverId, setDragOverId]     = useState(null)
  const [pickerFor, setPickerFor]       = useState(null) // attribution tactile : participant ciblé
  const [invitePrenom, setInvitePrenom] = useState('')
  const [showInvite, setShowInvite]     = useState(false)
  const [starting, setStarting]         = useState(false)
  const [notFound, setNotFound]         = useState(false)
  // Recherche de membres à ajouter
  const [search, setSearch]             = useState('')
  const [results, setResults]           = useState([])
  const [searching, setSearching]       = useState(false)
  const [addError, setAddError]         = useState('')
  // Annulation de la partie
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelled, setCancelled]       = useState(false)
  // Édition de la partie (en attente)
  const [editOpen, setEditOpen]         = useState(false)
  const [editForm, setEditForm]         = useState(null)
  const [editSaving, setEditSaving]     = useState(false)
  const [editError, setEditError]       = useState('')
  const searchTimer = useRef(null)

  const code          = partieCode?.toUpperCase()
  const isAnimateur   = partie?.animateurId === user?.id
  const isModeLibre   = partie?.modeAuto || partie?.modeVote
  const myParticipant = participants.find(p => p.userId === user?.id)
  // L'hôte = animateur OU créateur. En modes auto/vote il n'y a pas d'animateur,
  // mais le créateur (ou, à défaut, le 1er participant inscrit) reste seul à
  // pouvoir gérer et lancer. On s'appuie sur creatorId fourni par l'API, avec
  // repli sur le 1er inscrit pour les parties anciennes.
  const creatorId     = partie?.creatorId ?? [...participants]
    .filter(p => p.userId)
    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0]?.userId
  const canManage     = isAnimateur || (creatorId && creatorId === user?.id)
  // Seul l'hôte peut lancer la partie — quel que soit le mode (#7).
  const canStart      = canManage

  const load = useCallback(async () => {
    const res = await apiFetch(`/parties/by-code/${code}`)
    if (!res?.ok) { setNotFound(true); return }
    const p = await res.json()
    if (p.status === 'EN_COURS') { navigate(`/parties/${code}/jeu`, { replace: true }); return }
    if (p.status === 'TERMINEE' || p.status === 'ANNULEE') { setNotFound(true); return }
    setPartie(p)
    setParticipants(p.participants ?? [])
  }, [code])

  useEffect(() => {
    load()
    apiFetch('/buzzers').then(r => r?.json()).then(b => { if (Array.isArray(b)) setBuzzersDispo(b) })
    joinRoom(code)

    const unsub = subscribe('salle_attente', (msg) => {
      if (msg.type === 'participant_joined') {
        setParticipants(prev => prev.find(p => p.id === msg.participant.id) ? prev : [...prev, msg.participant])
      }
      if (msg.type === 'participant_removed') {
        // Si je suis le participant retiré, je quitte la salle.
        setParticipants(prev => {
          const removed = prev.find(p => p.id === msg.participantId)
          if (removed && removed.userId === user?.id && removed.userId !== partie?.animateurId) {
            navigate('/dashboard', { replace: true })
          }
          return prev.filter(p => p.id !== msg.participantId)
        })
      }
      if (msg.type === 'partie_cancelled') {
        setCancelled(true)
      }
      if (msg.type === 'partie_updated') {
        load()
      }
      if (msg.type === 'buzzer_assigned') {
        setParticipants(prev => prev.map(p => p.id === msg.participantId ? { ...p, buzzerId: msg.buzzerId } : p))
      }
      if (msg.type === 'unassign_buzzer') {
        setParticipants(prev => prev.map(p => p.id === msg.participantId ? { ...p, buzzerId: null, buzzer: null } : p))
      }
      if (msg.type === 'game_started') navigate(`/parties/${code}/jeu`, { replace: true })
      if (msg.type === 'buzzer_status_update') {
        setBuzzersDispo(prev => prev.map(b => b.mac === msg.mac ? { ...b, status: msg.status } : b))
      }
    })
    return unsub
  }, [code])

  async function assignBuzzer(participantId, buzzer) {
    const res = await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, {
      method: 'POST', body: { buzzerId: buzzer.id },
    })
    if (res?.ok) setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, buzzerId: buzzer.id, buzzer } : p))
  }

  async function unassignBuzzer(participantId) {
    await apiFetch(`/parties/${partie.id}/participants/${participantId}/assign-buzzer`, { method: 'DELETE' })
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, buzzerId: null, buzzer: null } : p))
  }

  // Associe en un clic les buzzers ONLINE libres aux joueurs sans buzzer.
  async function autoAssignBuzzers() {
    const free = unassignedBuzzers.filter(b => b.status === 'ONLINE')
    const need = participants.filter(p => !p.buzzerId && !p.isAnimateur)
    const n = Math.min(free.length, need.length)
    for (let i = 0; i < n; i++) await assignBuzzer(need[i].id, free[i])
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!invitePrenom.trim()) return
    const res = await apiFetch(`/parties/${partie.id}/participants/invite`, {
      method: 'POST', body: { prenom: invitePrenom.trim() },
    })
    if (res?.ok) {
      const p = await res.json()
      setParticipants(prev => [...prev, p])
      setInvitePrenom('')
      setShowInvite(false)
    }
  }

  // Recherche de membres (débounce 250 ms).
  function onSearchChange(value) {
    setSearch(value)
    setAddError('')
    clearTimeout(searchTimer.current)
    if (!value.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const res = await apiFetch(`/parties/${partie.id}/participants/search?q=${encodeURIComponent(value.trim())}`)
      if (res?.ok) setResults(await res.json())
      setSearching(false)
    }, 250)
  }

  async function addUser(u) {
    setAddError('')
    const res = await apiFetch(`/parties/${partie.id}/participants/add-user`, {
      method: 'POST', body: { userId: u.id },
    })
    if (res?.ok) {
      const p = await res.json()
      setParticipants(prev => prev.find(x => x.id === p.id) ? prev : [...prev, p])
      setSearch(''); setResults([])
    } else {
      const e = await res?.json().catch(() => ({}))
      setAddError(e?.error ?? "Impossible d'ajouter ce membre")
    }
  }

  async function removeParticipant(participantId) {
    const res = await apiFetch(`/parties/${partie.id}/participants/${participantId}`, { method: 'DELETE' })
    if (res?.ok) setParticipants(prev => prev.filter(p => p.id !== participantId))
  }

  async function cancelParty() {
    const res = await apiFetch(`/parties/${partie.id}/cancel`, { method: 'POST', body: {} })
    setCancelConfirm(false)
    if (res?.ok) navigate('/dashboard', { replace: true })
  }

  function openEdit() {
    setEditError('')
    setEditForm({
      nom: partie.nom,
      mode: partie.modeAuto ? 'auto' : partie.modeVote ? 'vote' : 'animateur',
      timerBuzz: partie.timerBuzz ?? 10,
      timerVote: partie.timerVote ?? 15,
      masquerReponses: partie.masquerReponses ?? false,
    })
    setEditOpen(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editForm?.nom?.trim()) { setEditError('Le nom est requis'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await apiFetch(`/parties/${partie.id}`, {
        method: 'PATCH',
        body: {
          nom: editForm.nom.trim(),
          mode: editForm.mode,
          timerBuzz: Number(editForm.timerBuzz),
          timerVote: Number(editForm.timerVote),
          masquerReponses: editForm.mode === 'animateur' ? !!editForm.masquerReponses : false,
        },
      })
      if (res?.ok) {
        const updated = await res.json()
        setPartie(updated)
        if (updated.participants) setParticipants(updated.participants)
        setEditOpen(false)
      } else {
        const err = await res?.json().catch(() => ({}))
        setEditError(err?.error?.formErrors?.[0] ?? err?.error ?? 'Modification impossible')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function handleStart() {
    setStarting(true)
    try {
      // TOUS les modes (animateur, auto, vote) passent par la route REST /start :
      // elle tire les questions, fixe le statut EN_COURS, diffuse la 1re question
      // et démarre le moteur auto le cas échéant. L'ancien message WS
      // 'start_game_collective' ne lançait jamais le moteur (bug auto/vote).
      const res = await apiFetch(`/parties/${partie.id}/start`, { method: 'POST', body: {} })
      if (!res?.ok) {
        const err = await res?.json().catch(() => ({}))
        alert(err?.error ?? 'Impossible de lancer')
      }
    } finally {
      setStarting(false)
    }
  }

  function getBuzzerStatut(b) {
    if (!b || b.status === 'OFFLINE') return 'offline'
    if (b.status === 'IN_GAME') return 'pressed'
    return 'ready'
  }

  const unassignedBuzzers = buzzersDispo.filter(b => !participants.some(p => p.buzzerId === b.id))
  // Un device « en ligne » = tout buzzer non OFFLINE. La zone buzzers n'a de sens
  // que s'il y a au moins un device en ligne (ou déjà un buzzer attribué) — sinon
  // c'est une partie 100 % téléphone et on masque tout le matériel.
  const anyBuzzerOnline = buzzersDispo.some(b => b.status !== 'OFFLINE')
  const showBuzzerZone = anyBuzzerOnline || participants.some(p => p.buzzerId)
  // Attribution automatique : buzzers ONLINE libres ↔ joueurs (non-animateur) sans buzzer.
  const freeOnlineBuzzers = unassignedBuzzers.filter(b => b.status === 'ONLINE')
  const playersNeedingBuzzer = participants.filter(p => !p.buzzerId && !p.isAnimateur)
  const autoAssignCount = Math.min(freeOnlineBuzzers.length, playersNeedingBuzzer.length)

  if (notFound) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <SearchX size={40} className="mb-4" style={{ color: '#2A2A35' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Partie introuvable</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Le code <span className="font-mono font-bold" style={{ color: 'var(--text)' }}>{code}</span> ne correspond à aucune partie active.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Retour au tableau de bord</button>
        </div>
      </Layout>
    )
  }

  if (cancelled) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Ban size={40} className="mb-4" style={{ color: '#F87171' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Partie annulée</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            L'animateur a annulé cette partie.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Retour au tableau de bord</button>
        </div>
      </Layout>
    )
  }

  if (!partie) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
        </div>
      </Layout>
    )
  }

  const manches = partie.manches ?? []
  const totalQuestions = manches.reduce((s, m) => s + (m.nbQuestions ?? 0), 0)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>{partie.nom}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="code-tag flex items-center gap-1"><Hash size={10} />{partie.code}</span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {participants.length} joueur{participants.length !== 1 ? 's' : ''} en attente
              </span>
              {isModeLibre && (
                <span className="badge-indigo">{partie.modeAuto ? 'Automatique' : 'Vote collectif'}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {canManage && (
              <a href={`/screen/${code}`} target="_blank" rel="noopener noreferrer"
                className="btn-secondary btn-sm gap-2" title="Ouvrir l'écran de projection (TV / vidéoprojecteur)">
                <Tv size={15} />Écran
              </a>
            )}
            {canManage && (
              <button onClick={openEdit} className="btn-secondary btn-sm gap-2">
                <Pencil size={15} />Modifier
              </button>
            )}
            {canManage && (
              <button onClick={() => setCancelConfirm(true)} className="btn-danger btn-sm gap-2">
                <Ban size={15} />Annuler
              </button>
            )}
            {canStart && (
              <button onClick={handleStart} disabled={starting || participants.length < 1}
                className="btn btn-sm gap-2 font-semibold flex-1 sm:flex-none"
                style={{
                  background: participants.length < 1 ? 'rgba(34,197,94,0.2)' : '#22C55E',
                  color: participants.length < 1 ? '#22C55E' : '#000',
                  opacity: starting ? 0.6 : 1,
                }}>
                {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {starting ? 'Lancement…' : 'Lancer'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Participants */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} style={{ color: '#6366F1' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Participants</h2>
            </div>

            <ul className="space-y-1.5">
              {participants.map(p => {
                const buzzer = buzzersDispo.find(b => b.id === p.buzzerId) ?? p.buzzer
                return (
                  <li key={p.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-150"
                    style={{
                      background: dragOverId === p.id ? 'rgba(99,102,241,0.08)' : 'var(--hover-overlay)',
                      border: `1px solid ${dragOverId === p.id ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    }}
                    onDragOver={canManage && showBuzzerZone ? e => { e.preventDefault(); setDragOverId(p.id) } : undefined}
                    onDragLeave={canManage && showBuzzerZone ? () => setDragOverId(null) : undefined}
                    onDrop={canManage && showBuzzerZone ? () => { setDragOverId(null); if (draggingBuzzer) assignBuzzer(p.id, draggingBuzzer) } : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.userId ? '#22C55E' : '#F59E0B' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{p.prenom}</p>
                        <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                          {p.isAnimateur ? 'Animateur' : p.userId ? 'Membre' : 'Invité'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {buzzer ? (
                        <>
                          <BatteryBadge battery={buzzer.battery} showPct={false} />
                          <BuzzerAnime couleur={buzzer.couleur} statut={getBuzzerStatut(buzzer)} size="sm" />
                          {canManage && (
                            <button onClick={() => unassignBuzzer(p.id)} className="btn-ghost" style={{ padding: '2px 4px' }} title="Retirer le buzzer">
                              <X size={12} />
                            </button>
                          )}
                        </>
                      ) : canManage && showBuzzerZone && !p.isAnimateur && (
                        // Tactile : taper pour attribuer un buzzer (+ glisser sur desktop).
                        <button onClick={() => setPickerFor(p.id)} className="btn-ghost btn-sm gap-1 text-2xs"
                          style={{ color: '#818CF8' }} title="Attribuer un buzzer">
                          <Radio size={12} />Buzzer
                        </button>
                      )}
                      {canManage && !p.isAnimateur && (
                        <button onClick={() => removeParticipant(p.id)} className="btn-ghost" style={{ padding: '2px 4px', color: '#F87171' }} title="Retirer le participant">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}

            </ul>

            {/* Ajout intelligent de participants */}
            {canManage && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                  <input type="text" value={search} placeholder="Ajouter un participant (pseudo ou prénom)…"
                    onChange={e => onSearchChange(e.target.value)} className="input pl-9 text-sm" />
                  {searching && <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#6366F1' }} />}

                  {/* Suggestions */}
                  {results.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden shadow-lg animate-fadeUp"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
                      {results.map(u => (
                        <button key={u.id} onClick={() => addUser(u)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-overlay)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                            : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold text-white shrink-0" style={{ background: '#6366F1' }}>
                                {(u.username?.[0] ?? u.prenom?.[0] ?? '?').toUpperCase()}
                              </div>}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                              {u.prenom}{u.nom ? ` ${u.nom}` : ''}
                            </p>
                            {u.username && <p className="text-2xs flex items-center gap-0.5" style={{ color: '#818CF8' }}><AtSign size={9} />{u.username}</p>}
                          </div>
                          <UserPlus size={14} className="ml-auto shrink-0" style={{ color: '#6366F1' }} />
                        </button>
                      ))}
                    </div>
                  )}
                  {!searching && search.trim() && results.length === 0 && (
                    <div className="absolute left-0 right-0 mt-1 z-20 rounded-lg px-3 py-2.5 text-2xs shadow-lg"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-dim)' }}>
                      Aucun membre trouvé.
                    </div>
                  )}
                </div>
                {addError && <p className="text-xs mt-2" style={{ color: '#F87171' }}>{addError}</p>}

                {/* Invité ponctuel (sans compte) */}
                {showInvite ? (
                  <form onSubmit={handleInvite} className="flex gap-1.5 mt-2">
                    <input type="text" placeholder="Prénom de l'invité" value={invitePrenom}
                      onChange={e => setInvitePrenom(e.target.value)} maxLength={50}
                      className="input flex-1 text-sm" autoFocus />
                    <button type="submit" className="btn-primary btn-sm">OK</button>
                    <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost btn-sm"><X size={12} /></button>
                  </form>
                ) : (
                  <button onClick={() => setShowInvite(true)}
                    className="text-2xs mt-2 flex items-center gap-1 transition-colors hover:underline"
                    style={{ color: 'var(--text-dim)' }}>
                    <Plus size={11} />ou ajouter un invité sans compte
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Buzzers — affiché seulement si au moins un device est en ligne
              (sinon partie 100 % téléphone : on ne montre aucun matériel). */}
          {canManage && showBuzzerZone && (
            <div className="card p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Radio size={14} style={{ color: '#6366F1' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Buzzers disponibles</h2>
                </div>
                {autoAssignCount > 0 && (
                  <button onClick={autoAssignBuzzers} className="btn-secondary btn-sm gap-1.5">
                    <Radio size={12} />Attribuer automatiquement ({autoAssignCount})
                  </button>
                )}
              </div>
              <p className="text-2xs mb-3" style={{ color: 'var(--text-dim)' }}>Glissez un buzzer vers un participant, ou attribuez automatiquement.</p>

              {unassignedBuzzers.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Tous les buzzers sont assignés.</p>
              ) : (
                <ul className="space-y-1.5">
                  {unassignedBuzzers.map(b => (
                    <li key={b.id} draggable
                      onDragStart={() => setDraggingBuzzer(b)}
                      onDragEnd={() => { setDraggingBuzzer(null); setDragOverId(null) }}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-all"
                      style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2.5">
                        <GripVertical size={12} style={{ color: 'var(--text-dim)' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{b.nom ?? b.mac.slice(-8)}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {b.status === 'ONLINE'
                              ? <Wifi size={10} style={{ color: '#22C55E' }} />
                              : <WifiOff size={10} style={{ color: 'var(--text-dim)' }} />}
                            <span className="text-2xs" style={{ color: b.status === 'ONLINE' ? '#22C55E' : 'var(--text-dim)' }}>
                              {b.status === 'ONLINE' ? 'Connecté' : b.status === 'AWAITING_CLAIM' ? 'Appairage…' : 'Hors ligne'}
                            </span>
                            <BatteryBadge battery={b.battery} />
                          </div>
                        </div>
                      </div>
                      <BuzzerAnime couleur={b.couleur} statut={getBuzzerStatut(b)} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Manches (read-only summary) */}
        {manches.length > 0 && (
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={14} style={{ color: '#6366F1' }} />
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Manches configurées</h2>
              <span className="badge-indigo">{totalQuestions} questions tirées au lancement</span>
            </div>
            <div className="space-y-2">
              {manches.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>M{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.nom}</p>
                      <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                        {m.theme === 'MELANGE' ? '🔀 Mélange' : m.theme}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                    <span>{DIFF_LABELS[m.difficulte] ?? m.difficulte}</span>
                    <span>{m.nbQuestions} q.</span>
                    <span>{m.tempsLimite}s</span>
                    <span>{m.pointsParQ} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invitation : QR + code. Le joueur scanne et joue sans compte. */}
        <JoinInvite code={partie.code} />
      </div>

      {/* Édition de la partie */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={saveEdit} className="card p-6 max-w-sm w-full animate-scaleIn">
            <h3 className="font-semibold mb-4 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
              <Pencil size={15} style={{ color: '#6366F1' }} />Modifier la partie
            </h3>

            <label className="label">Nom</label>
            <input type="text" value={editForm.nom} maxLength={100} autoFocus
              onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
              className="input mb-3" />

            <label className="label">Mode de jeu</label>
            <select value={editForm.mode}
              onChange={e => setEditForm(f => ({ ...f, mode: e.target.value }))}
              className="input mb-3">
              <option value="animateur">Animateur</option>
              <option value="auto">Automatique</option>
              <option value="vote">Vote collectif</option>
            </select>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Buzz (s)</label>
                <input type="number" min={3} max={60} value={editForm.timerBuzz}
                  onChange={e => setEditForm(f => ({ ...f, timerBuzz: e.target.value }))}
                  className="input" />
              </div>
              <div>
                <label className="label">Vote (s)</label>
                <input type="number" min={5} max={60} value={editForm.timerVote}
                  onChange={e => setEditForm(f => ({ ...f, timerVote: e.target.value }))}
                  className="input" />
              </div>
            </div>

            {/* Affichage des réponses côté animateur (mode animateur uniquement). */}
            {editForm.mode === 'animateur' && (
              <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none rounded-lg p-3"
                style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <input type="checkbox" checked={!!editForm.masquerReponses} className="mt-0.5"
                  onChange={e => setEditForm(f => ({ ...f, masquerReponses: e.target.checked }))} />
                <span>
                  <span className="text-sm font-medium block" style={{ color: 'var(--text)' }}>
                    Masquer les réponses jusqu'à la révélation
                  </span>
                  <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                    À activer si vous projetez directement votre écran (l'animateur découvre la
                    réponse en même temps que le public). Décochez pour disposer d'un écran de
                    régie privé montrant les réponses à l'avance.
                  </span>
                </span>
              </label>
            )}

            {editError && <p className="text-xs mb-3" style={{ color: '#F87171' }}>{editError}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={editSaving} className="btn-primary flex-1 gap-1.5">
                {editSaving && <Loader2 size={14} className="animate-spin" />}
                {editSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => setEditOpen(false)} className="btn-ghost flex-1">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation d'annulation */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="card p-6 max-w-xs w-full animate-scaleIn" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-semibold mb-1 flex items-center gap-1.5" style={{ color: '#F87171' }}>
              <Ban size={15} />Annuler cette partie ?
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Voulez-vous vraiment annuler cette partie ? Les participants seront notifiés et la salle sera fermée.
            </p>
            <div className="flex gap-2">
              <button onClick={cancelParty} className="btn-danger flex-1">Oui, annuler</button>
              <button onClick={() => setCancelConfirm(false)} className="btn-ghost flex-1">Retour</button>
            </div>
          </div>
        </div>
      )}

      {/* Attribution tactile : feuille de sélection d'un buzzer en ligne. */}
      {pickerFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setPickerFor(null)}>
          <div className="card p-4 w-full max-w-sm animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Attribuer un buzzer</h3>
              <button onClick={() => setPickerFor(null)} className="btn-ghost btn-sm"><X size={15} /></button>
            </div>
            {freeOnlineBuzzers.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-dim)' }}>
                Aucun buzzer en ligne disponible. Allume un buzzer (ou le simulateur).
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {freeOnlineBuzzers.map(b => (
                  <button key={b.id} onClick={() => { assignBuzzer(pickerFor, b); setPickerFor(null) }}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                    <BuzzerAnime couleur={b.couleur} statut="ready" size="sm" />
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{b.nom ?? b.mac.slice(-8)}</span>
                    <BatteryBadge battery={b.battery} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
