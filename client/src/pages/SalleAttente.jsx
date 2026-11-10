import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWs } from '../context/WsContext.jsx'
import Layout from '../components/Layout.jsx'
import BuzzerAnime from '../components/buzzer/BuzzerAnime.jsx'
import JoinInvite from '../components/JoinInvite.jsx'
import BatteryBadge from '../components/BatteryBadge.jsx'
import { NOMBRES_EQUIPES, PastilleEquipe, equipeDe } from '../components/Equipes.jsx'
import {
  Users, Radio, Hash, Play, Plus, X, Loader2, SearchX, Wifi, WifiOff,
  GripVertical, Layers, Search, AtSign, Trash2, Ban, UserPlus, Pencil, Tv,
  AlertTriangle, Globe, ChevronDown, Shuffle,
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
      if (msg.type === 'participant_equipe') {
        setParticipants(prev => prev.map(p => p.id === msg.participantId ? { ...p, equipe: msg.equipe } : p))
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

  // Équipes : l'hôte déplace n'importe qui, un joueur se déplace lui-même.
  async function changerEquipe(participantId, equipe) {
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, equipe } : p))
    const res = await apiFetch(`/parties/${partie.id}/participants/${participantId}/equipe`, { method: 'PATCH', body: { equipe } })
    if (!res?.ok) load()
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
      modeDistanciel: partie.modeDistanciel ?? false,
      equipes: Array.isArray(partie.equipes) ? partie.equipes.length : 0,
      equipesNoms: Array.isArray(partie.equipes) ? partie.equipes.map(e => e.nom) : [],
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
          modeDistanciel: !!editForm.modeDistanciel,
          ...(partie.solo ? {} : { equipes: Number(editForm.equipes) || 0, equipesNoms: editForm.equipesNoms.slice(0, Number(editForm.equipes) || 0) }),
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
          <SearchX size={40} className="mb-4" style={{ color: '#4A382C' }} />
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
          <Loader2 size={24} className="animate-spin" style={{ color: '#F26A1B' }} />
        </div>
      </Layout>
    )
  }

  const manches = partie.manches ?? []
  const totalQuestions = manches.reduce((s, m) => s + (m.nbQuestions ?? 0), 0)
  const equipes = Array.isArray(partie.equipes) && partie.equipes.length >= 2 ? partie.equipes : null
  const joueurs = participants.filter(p => !p.isAnimateur)
  const maitre = participants.find(p => p.isAnimateur)
  const logo = partie.branding?.logoUrl
  const modeLabel = partie.modeAuto ? 'Automatique' : partie.modeVote ? 'Vote de la salle' : 'Avec animateur'

  // Une ligne de joueur (avec buzzer, équipe et retrait selon les droits).
  function ligneJoueur(p) {
    const buzzer = buzzersDispo.find(b => b.id === p.buzzerId) ?? p.buzzer
    const estMoi = p.userId && p.userId === user?.id
    return (
      <li key={p.id}
        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-all duration-150"
        style={{
          background: dragOverId === p.id ? 'rgba(242,106,27,0.08)' : 'var(--surface)',
          border: `1px solid ${dragOverId === p.id ? 'rgba(242,106,27,0.3)' : estMoi ? 'var(--brand)' : 'var(--border)'}`,
        }}
        onDragOver={canManage && showBuzzerZone ? e => { e.preventDefault(); setDragOverId(p.id) } : undefined}
        onDragLeave={canManage && showBuzzerZone ? () => setDragOverId(null) : undefined}
        onDrop={canManage && showBuzzerZone ? () => { setDragOverId(null); if (draggingBuzzer) assignBuzzer(p.id, draggingBuzzer) } : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: equipeDe(partie, p)?.couleur ?? 'var(--brand)' }}>
            {(p.prenom?.[0] ?? '?').toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{p.prenom}{estMoi && <span className="font-normal" style={{ color: 'var(--text-dim)' }}> · toi</span>}</p>
            <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{p.userId ? 'Sur son téléphone' : 'Invité sans téléphone'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {equipes && canManage && (
            <select value={p.equipe ?? 0} onChange={e => changerEquipe(p.id, Number(e.target.value))}
              aria-label={`Équipe de ${p.prenom}`}
              className="input !py-1 !px-2 !w-auto text-2xs">
              {equipes.map((eq, i) => <option key={i} value={i}>{eq.nom}</option>)}
            </select>
          )}
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
          ) : canManage && showBuzzerZone && (
            <button onClick={() => setPickerFor(p.id)} className="btn-ghost btn-sm gap-1 text-2xs"
              style={{ color: 'var(--brand-text)' }} title="Attribuer un buzzer">
              <Radio size={12} />Buzzer
            </button>
          )}
          {canManage && !estMoi && (
            <button onClick={() => removeParticipant(p.id)} className="btn-ghost" style={{ padding: '2px 4px', color: '#C0392B' }} title="Retirer de la partie" aria-label={`Retirer ${p.prenom}`}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* En-tête : nom, réglages en clair, actions */}
        <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {logo && <img src={logo} alt={partie.branding?.nom ?? ''} className="h-10 max-w-[120px] object-contain shrink-0" />}
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold truncate" style={{ color: 'var(--text)' }}>{partie.nom}</h1>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="chip">{modeLabel}</span>
                {partie.modeDistanciel && <span className="chip"><Globe size={11} />À distance</span>}
                {equipes && <span className="chip"><Users size={11} />{equipes.length} équipes</span>}
                {totalQuestions > 0 && <span className="chip">{totalQuestions} questions</span>}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <a href={`/screen/${code}`} target="_blank" rel="noopener noreferrer"
                className="btn-secondary btn-sm gap-1.5" title="À ouvrir sur la télé ou le vidéoprojecteur">
                <Tv size={15} />Grand écran
              </a>
              <button onClick={openEdit} className="btn-secondary btn-sm gap-1.5"><Pencil size={14} />Réglages</button>
              <button onClick={() => setCancelConfirm(true)} className="btn-ghost btn-sm gap-1.5" style={{ color: '#C0392B' }}>
                <Ban size={14} />Annuler
              </button>
            </div>
          )}
        </div>

        {/* L'hôte : inviter d'abord, lancer ensuite. Les joueurs : attendre. */}
        {canManage ? (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-5 items-stretch">
            <JoinInvite code={partie.code} />
            <button onClick={handleStart} disabled={starting || joueurs.length < 1}
              className="btn-primary btn-lg gap-2 md:min-w-[200px] md:h-auto">
              {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              {starting ? 'Lancement…' : joueurs.length < 1 ? 'En attente de joueurs' : `Lancer (${joueurs.length})`}
            </button>
          </div>
        ) : (
          <div className="panel-ink rounded-2xl p-5 mb-5 flex items-center gap-4">
            <Loader2 size={22} className="animate-spin shrink-0" style={{ color: 'var(--mango)' }} />
            <div>
              <p className="font-semibold">Tu es dans la partie.</p>
              <p className="text-sm opacity-80">{equipes ? 'Choisis ton équipe en attendant le lancement.' : 'La partie démarre dès que l\'hôte lance.'}</p>
            </div>
          </div>
        )}

        {maitre && (
          <p className="text-2xs mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
            <Users size={12} />Animé par {maitre.prenom} (hors classement)
          </p>
        )}

        {/* Joueurs — par équipe, ou en liste */}
        {equipes ? (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 240px), 1fr))` }}>
            {equipes.map((eq, i) => {
              const membres = joueurs.filter(p => p.equipe === i)
              const dansCelleCi = myParticipant && !myParticipant.isAnimateur && myParticipant.equipe === i
              return (
                <section key={i} className="rounded-2xl p-3" style={{ background: `${eq.couleur}0F`, border: `1px solid ${eq.couleur}40` }}>
                  <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <PastilleEquipe equipe={eq} taille="lg" />
                    <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>{membres.length} joueur{membres.length !== 1 ? 's' : ''}</span>
                  </div>
                  <ul className="space-y-1.5">{membres.map(ligneJoueur)}</ul>
                  {myParticipant && !myParticipant.isAnimateur && !dansCelleCi && (
                    <button onClick={() => changerEquipe(myParticipant.id, i)}
                      className="w-full mt-2 rounded-xl py-2 text-sm font-semibold"
                      style={{ color: eq.couleur, border: `1px dashed ${eq.couleur}88` }}>
                      Rejoindre {eq.nom}
                    </button>
                  )}
                  {membres.length === 0 && !myParticipant && (
                    <p className="text-2xs px-1 py-2" style={{ color: 'var(--text-dim)' }}>Personne pour l'instant.</p>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="card p-4 mb-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Users size={14} style={{ color: 'var(--brand)' }} />Joueurs · {joueurs.length}
            </h2>
            {joueurs.length === 0
              ? <p className="text-sm py-2" style={{ color: 'var(--text-dim)' }}>Personne pour l'instant. Partage le code ou le QR.</p>
              : <ul className="space-y-1.5">{joueurs.map(ligneJoueur)}</ul>}
          </div>
        )}

        {/* Ajout manuel de joueurs (hôte) */}
        {canManage && (
          <div className="card p-4 mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
              <input type="text" value={search} placeholder="Ajouter quelqu'un qui a un compte (pseudo ou prénom)…"
                onChange={e => onSearchChange(e.target.value)} className="input pl-9 text-sm" />
              {searching && <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#F26A1B' }} />}
              {results.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden shadow-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
                  {results.map(u => (
                    <button key={u.id} onClick={() => addUser(u)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover-overlay)]">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold text-white shrink-0" style={{ background: '#F26A1B' }}>
                            {(u.username?.[0] ?? u.prenom?.[0] ?? '?').toUpperCase()}
                          </div>}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{u.prenom}{u.nom ? ` ${u.nom}` : ''}</p>
                        {u.username && <p className="text-2xs flex items-center gap-0.5" style={{ color: 'var(--brand-text)' }}><AtSign size={9} />{u.username}</p>}
                      </div>
                      <UserPlus size={14} className="ml-auto shrink-0" style={{ color: '#F26A1B' }} />
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
            {addError && <p className="text-xs mt-2" style={{ color: '#C0392B' }}>{addError}</p>}
            {showInvite ? (
              <form onSubmit={handleInvite} className="flex gap-1.5 mt-2">
                <input type="text" placeholder="Prénom (joue avec un buzzer, sans téléphone)" value={invitePrenom}
                  onChange={e => setInvitePrenom(e.target.value)} maxLength={50}
                  className="input flex-1 text-sm" autoFocus />
                <button type="submit" className="btn-primary btn-sm">Ajouter</button>
                <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost btn-sm" aria-label="Fermer"><X size={12} /></button>
              </form>
            ) : (
              <button onClick={() => setShowInvite(true)}
                className="text-2xs mt-2 flex items-center gap-1 hover:underline" style={{ color: 'var(--text-dim)' }}>
                <Plus size={11} />Ajouter un joueur sans téléphone (il jouera avec un buzzer)
              </button>
            )}
          </div>
        )}

        {/* Buzzers — seulement si au moins un boîtier est en ligne. */}
        {canManage && showBuzzerZone && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Radio size={14} style={{ color: 'var(--brand)' }} />Buzzers disponibles
              </h2>
              {autoAssignCount > 0 && (
                <button onClick={autoAssignBuzzers} className="btn-secondary btn-sm gap-1.5">
                  <Shuffle size={12} />Attribuer ({autoAssignCount})
                </button>
              )}
            </div>
            {unassignedBuzzers.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Tous les buzzers sont attribués.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {unassignedBuzzers.map(b => (
                  <li key={b.id} draggable
                    onDragStart={() => setDraggingBuzzer(b)}
                    onDragEnd={() => { setDraggingBuzzer(null); setDragOverId(null) }}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing select-none"
                    style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GripVertical size={12} style={{ color: 'var(--text-dim)' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{b.nom ?? b.mac.slice(-8)}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {b.status === 'ONLINE' ? <Wifi size={10} style={{ color: 'var(--leaf)' }} /> : <WifiOff size={10} style={{ color: 'var(--text-dim)' }} />}
                          <span className="text-2xs" style={{ color: b.status === 'ONLINE' ? 'var(--leaf)' : 'var(--text-dim)' }}>
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

        {/* Déroulé (repliable) */}
        {manches.length > 0 && (
          <details className="card p-4 mb-4 group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
              <span className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Layers size={14} style={{ color: 'var(--brand)' }} />Déroulé · {manches.length} manche{manches.length > 1 ? 's' : ''}
              </span>
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" style={{ color: 'var(--text-dim)' }} />
            </summary>
            <div className="space-y-2 mt-3">
              {manches.map((m, i) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--hover-overlay)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{i + 1}. {m.nom}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-dim)' }}>{m.theme === 'MELANGE' ? 'Mélange' : m.theme} · {DIFF_LABELS[m.difficulte] ?? m.difficulte}</p>
                  </div>
                  <p className="text-2xs shrink-0 text-right" style={{ color: 'var(--text-dim)' }}>{m.nbQuestions} q. · {m.tempsLimite} s · {m.pointsParQ} pts</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Édition de la partie */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={saveEdit} className="card p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto animate-scaleIn">
            <h3 className="font-semibold mb-4 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
              <Pencil size={15} style={{ color: '#F26A1B' }} />Réglages de la partie
            </h3>

            <label className="label">Nom</label>
            <input type="text" value={editForm.nom} maxLength={100} autoFocus
              onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
              className="input mb-3" />

            <label className="label">Mode de jeu</label>
            <select value={editForm.mode}
              onChange={e => setEditForm(f => ({ ...f, mode: e.target.value }))}
              className="input mb-2">
              <option value="animateur">Animateur</option>
              <option value="auto">Automatique</option>
              <option value="vote" disabled={participants.length < 3}>
                Vote collectif{participants.length < 3 ? ' (min. 3 joueurs)' : ''}
              </option>
            </select>
            {/* D4 — avertissement si vote sélectionné avec peu de joueurs */}
            {editForm.mode === 'vote' && participants.length < 3 && (
              <p className="text-2xs mb-2" style={{ color: '#F59E0B' }}>
                <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />Le vote collectif requiert au moins 3 joueurs.
              </p>
            )}
            {/* D5/A4 — Mode distanciel */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" className="check" checked={!!editForm.modeDistanciel}
                onChange={e => setEditForm(f => ({ ...f, modeDistanciel: e.target.checked }))} />
              <Globe size={13} className="inline mr-1.5 -mt-0.5" />Jeu à distance (médias + saisie sur téléphone)
            </label>

            {!partie.solo && (
              <div className="mb-3">
                <label className="label">Équipes</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[0, ...NOMBRES_EQUIPES].map(n => (
                    <button type="button" key={n} onClick={() => setEditForm(f => ({ ...f, equipes: n }))}
                      className={`chip ${Number(editForm.equipes) === n ? 'chip-on' : ''}`}>
                      {n === 0 ? 'Chacun pour soi' : `${n} équipes`}
                    </button>
                  ))}
                </div>
                {Number(editForm.equipes) > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {Array.from({ length: Number(editForm.equipes) }).map((_, i) => (
                      <input key={i} type="text" maxLength={24} className="input text-sm"
                        placeholder={['Soleil', 'Feuille', 'Lagune', 'Bissap'][i]}
                        aria-label={`Nom de l'équipe ${i + 1}`}
                        value={editForm.equipesNoms[i] ?? ''}
                        onChange={e => setEditForm(f => { const noms = [...f.equipesNoms]; noms[i] = e.target.value; return { ...f, equipesNoms: noms } })} />
                    ))}
                  </div>
                )}
              </div>
            )}

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
                style={{ background: 'rgba(242,106,27,0.05)', border: '1px solid rgba(242,106,27,0.15)' }}>
                <input type="checkbox" checked={!!editForm.masquerReponses} className="check mt-0.5"
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
