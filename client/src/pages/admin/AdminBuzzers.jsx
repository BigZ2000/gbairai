import React, { useState, useEffect, useCallback, useMemo } from 'react'
import AdminLayout from './AdminLayout.jsx'
import Pagination, { usePagination } from '../../components/Pagination.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  Loader2, Radio, BatteryLow, Battery, Wifi, UploadCloud, Check,
  RotateCcw, Unlink, Trash2, X, AlertTriangle, ScrollText, MapPin,
  LogIn, LogOut, RefreshCw, Link2, Unlink2, Ban, Search,
} from 'lucide-react'

const STATUT = {
  ONLINE:        { c: '#22C55E', l: 'En ligne' },
  IN_GAME:       { c: '#3B82F6', l: 'En jeu' },
  AWAITING_CLAIM:{ c: '#EAB308', l: 'À appairer' },
  OFFLINE:       { c: 'var(--text-dim)', l: 'Hors ligne' },
}
const FILTRES = [
  ['ALL', 'Tous'], ['ONLINE', 'En ligne'], ['IN_GAME', 'En jeu'],
  ['AWAITING_CLAIM', 'À appairer'], ['OFFLINE', 'Hors ligne'],
]

// Horodatage relatif : « il y a 2 min » se lit bien plus vite qu'une date, et
// permet de repérer d'un coup d'œil un buzzer qui vient de tomber.
function tempsRelatif(iso) {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const j = Math.floor(s / 86400)
  return j > 30 ? new Date(iso).toLocaleDateString('fr-FR') : `il y a ${j} j`
}

export default function AdminBuzzers() {
  const { apiFetch, apiUpload } = useAuth()
  const [tab, setTab] = useState('parc') // 'parc' | 'journal'
  const [data, setData] = useState(null)
  const [filtre, setFiltre] = useState('ALL')
  const [cfg, setCfg] = useState({ enabled: false, version: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [pushed, setPushed] = useState(null)
  const [confirm, setConfirm] = useState(null) // { mac, nom, action, ... }
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const res = await apiFetch('/admin/firmware')
    if (res?.ok) { const d = await res.json(); setData(d); setCfg(d.config) }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [load])

  const buzzers = data?.buzzers ?? []
  const counts = useMemo(() => {
    const c = { ALL: buzzers.length, ONLINE: 0, IN_GAME: 0, AWAITING_CLAIM: 0, OFFLINE: 0 }
    buzzers.forEach(b => { c[b.status] = (c[b.status] ?? 0) + 1 })
    return c
  }, [buzzers])
  const filtered = useMemo(
    () => filtre === 'ALL' ? buzzers : buzzers.filter(b => b.status === filtre),
    [buzzers, filtre],
  )
  const pg = usePagination(filtered, 15)

  async function saveCfg() {
    setSaving(true)
    await apiFetch('/admin/firmware', { method: 'PUT', body: { enabled: !!cfg.enabled, version: cfg.version, url: cfg.url } })
    setSaving(false); load()
  }
  async function pushOta() {
    const res = await apiFetch('/admin/firmware/push', { method: 'POST' })
    if (res?.ok) { const d = await res.json(); setPushed(d.pushed); setTimeout(() => setPushed(null), 4000); load() }
  }

  // Téléverse le .bin sur CE serveur : il sera servi en HTTPS sous
  // /uploads/firmware/… et l'URL est appliquée automatiquement à la cible OTA.
  async function uploadBin(file) {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    if (cfg.version) fd.append('version', cfg.version)
    const res = await apiUpload('/admin/firmware/upload', fd)
    setUploading(false)
    if (res?.ok) {
      const d = await res.json()
      setCfg(c => ({ ...c, url: d.url }))
      setFlash(`Firmware téléversé (${Math.round(d.taille / 1024)} Ko)`)
      setTimeout(() => setFlash(null), 4000)
      load()
    } else {
      const e = await res?.json().catch(() => ({}))
      setFlash(e?.error ?? 'Téléversement impossible')
      setTimeout(() => setFlash(null), 4000)
    }
  }

  // Exécute l'action confirmée (reset distant / libération / suppression).
  async function runAction() {
    if (!confirm) return
    setBusy(true)
    const { mac, action } = confirm
    let res
    if (action === 'factory-reset') res = await apiFetch(`/admin/firmware/buzzers/${mac}/factory-reset`, { method: 'POST' })
    else if (action === 'release')  res = await apiFetch(`/admin/firmware/buzzers/${mac}/release`, { method: 'POST' })
    else if (action === 'forget')   res = await apiFetch(`/admin/firmware/buzzers/${mac}`, { method: 'DELETE' })
    setBusy(false)
    if (res?.ok) {
      const msg = action === 'factory-reset' ? 'Reset envoyé au buzzer'
        : action === 'release' ? 'Buzzer libéré' : 'Buzzer supprimé'
      setFlash(msg); setTimeout(() => setFlash(null), 3500)
      setConfirm(null); load()
    } else {
      const e = await res?.json().catch(() => ({}))
      setFlash(e?.error ?? 'Action impossible'); setTimeout(() => setFlash(null), 4000)
      setConfirm(null)
    }
  }

  if (!data) return <AdminLayout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: 'var(--text-dim)' }} /></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Parc de buzzers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
            Journal de tous les buzzers connus (MAC, propriétaire, batterie, signal), OTA et réinitialisation.
          </p>
        </div>
        {flash && (
          <span className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}>
            {flash}
          </span>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: 'var(--input-bg)' }}>
        {[['parc', 'Parc', Radio], ['journal', 'Journal', ScrollText]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{ background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--text)' : 'var(--text-dim)', boxShadow: tab === k ? 'var(--shadow)' : 'none' }}>
            <Icon size={13} />{l}
          </button>
        ))}
      </div>

      {tab === 'journal' ? <JournalTab apiFetch={apiFetch} /> : <>

      {/* Résumé par statut */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {FILTRES.map(([k, l]) => {
          const st = STATUT[k]
          const active = filtre === k
          return (
            <button key={k} onClick={() => { setFiltre(k); pg.setPage(1) }}
              className="card p-3 text-left transition-all"
              style={{ border: `1px solid ${active ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, background: active ? 'rgba(99,102,241,0.08)' : undefined }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: st ? st.c : '#818CF8' }} />
                <span className="text-2xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{l}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{counts[k] ?? 0}</p>
            </button>
          )
        })}
      </div>

      {/* Cible OTA */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <UploadCloud size={16} style={{ color: '#818CF8' }} />Mise à jour firmware (OTA)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-end">
          <div>
            <label className="label">Version cible</label>
            <input value={cfg.version ?? ''} onChange={e => setCfg(c => ({ ...c, version: e.target.value }))} className="input w-full" placeholder="esp32-1.1" />
          </div>
          <div>
            <label className="label">URL du firmware (.bin)</label>
            <input value={cfg.url ?? ''} onChange={e => setCfg(c => ({ ...c, url: e.target.value }))} className="input w-full" placeholder="https://…/uploads/firmware/gbairai_buzzer.bin" />
          </div>
        </div>

        {/* Téléversement du binaire sur CE serveur (servi ensuite en HTTPS) */}
        <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.25)' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="btn-secondary btn-sm gap-1.5 shrink-0">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
              Téléverser un .bin
            </span>
            <input type="file" accept=".bin" className="hidden" disabled={uploading}
              onChange={e => { uploadBin(e.target.files?.[0]); e.target.value = '' }} />
            <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>
              Hébergé sur ce serveur en HTTPS — l'URL ci-dessus est remplie automatiquement.
            </span>
          </label>
        </div>
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))} className="flex items-center gap-2">
            <span className="w-9 h-5 rounded-full relative transition-all" style={{ background: cfg.enabled ? '#22C55E' : 'rgba(255,255,255,0.12)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: cfg.enabled ? '18px' : '2px' }} />
            </span>
            <span className="text-sm" style={{ color: 'var(--text)' }}>OTA activé</span>
          </button>
          <button onClick={saveCfg} disabled={saving} className="btn-primary gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Enregistrer
          </button>
          <button onClick={pushOta} disabled={!cfg.enabled || !data.otaEligible} className="btn-secondary gap-2">
            <UploadCloud size={14} />
            Pousser maintenant{data.otaEligible ? ` (${data.otaEligible})` : ''}
          </button>
          {pushed != null && <span className="text-sm" style={{ color: '#22C55E' }}>OTA poussé à {pushed} buzzer(s)</span>}
        </div>
        <p className="text-2xs mt-3" style={{ color: 'var(--text-dim)' }}>
          {data.otaEligible > 0
            ? <><strong style={{ color: '#F59E0B' }}>{data.otaEligible} buzzer(s) obsolète(s)</strong> recevront la mise à jour. </>
            : <>Aucun buzzer obsolète connecté pour l'instant. </>}
          L'OTA n'est proposé qu'aux buzzers <strong>connectés, au repos et obsolètes</strong> (jamais en pleine partie).
          Le résultat de chaque MAJ apparaît dans l'onglet <strong>Journal</strong>.
        </p>
      </div>

      {/* Parc / journal */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Buzzer / MAC', 'Propriétaire', 'Statut', 'Batterie', 'Signal', 'Firmware', 'Vu', 'Actions'].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pg.slice.map(b => {
              const st = STATUT[b.status] ?? STATUT.OFFLINE
              const low = b.battery != null && b.battery <= 15
              const outdated = data.config.enabled && data.config.version && b.firmware !== data.config.version
              const online = b.status === 'ONLINE' || b.status === 'IN_GAME'
              const inGame = b.status === 'IN_GAME'
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--input-bg)' }}>
                  <td className="px-3 py-3" style={{ color: 'var(--text)' }}>
                    <div className="font-medium text-xs">{b.nom || 'Sans nom'}</div>
                    <div className="font-mono text-2xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{b.mac}</div>
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{b.owner?.email ?? '—'}</td>
                  <td className="px-3 py-3"><span className="text-2xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.c + '22', color: st.c }}>{st.l}</span></td>
                  <td className="px-3 py-3 text-xs">
                    {b.battery == null ? <span style={{ color: 'var(--text-dim)' }}>—</span> : (
                      <span className="inline-flex items-center gap-1" style={{ color: low ? '#F87171' : 'var(--text-muted)' }}>
                        {low ? <BatteryLow size={13} /> : <Battery size={13} />}{b.battery}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {b.rssi == null ? '—' : <span className="inline-flex items-center gap-1"><Wifi size={12} />{b.rssi} dBm</span>}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span style={{ color: outdated ? '#F59E0B' : 'var(--text-muted)' }}>{b.firmware ?? '—'}{outdated ? ' ⟳' : ''}</span>
                  </td>
                  <td className="px-3 py-3 text-2xs" title={b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleString('fr-FR') : ''}
                    style={{ color: 'var(--text-dim)' }}>
                    {tempsRelatif(b.lastSeenAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button title="Reset d'usine à distance" disabled={!online}
                        onClick={() => setConfirm({ mac: b.mac, nom: b.nom || b.mac, action: 'factory-reset' })}
                        className="btn-ghost btn-sm" style={{ opacity: online ? 1 : 0.35 }}>
                        <RotateCcw size={14} />
                      </button>
                      <button title="Libérer (retirer le propriétaire)" disabled={!b.owner || inGame}
                        onClick={() => setConfirm({ mac: b.mac, nom: b.nom || b.mac, action: 'release' })}
                        className="btn-ghost btn-sm" style={{ opacity: (b.owner && !inGame) ? 1 : 0.35 }}>
                        <Unlink size={14} />
                      </button>
                      <button title="Oublier (supprimer l'enregistrement)" disabled={inGame}
                        onClick={() => setConfirm({ mac: b.mac, nom: b.nom || b.mac, action: 'forget' })}
                        className="btn-ghost btn-sm" style={{ opacity: inGame ? 0.35 : 1, color: '#F87171' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                <Radio size={24} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />
                {buzzers.length === 0 ? 'Aucun buzzer enregistré' : 'Aucun buzzer pour ce filtre'}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      <Pagination page={pg.page} pages={pg.pages} total={pg.total} perPage={pg.perPage} onPage={pg.setPage} />
      </>}

      {/* Modale de confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => !busy && setConfirm(null)}>
          <div className="card p-6 max-w-sm w-full animate-scaleIn" onClick={e => e.stopPropagation()}
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h3 className="font-semibold mb-1 flex items-center gap-2" style={{ color: '#F87171' }}>
              <AlertTriangle size={16} />
              {confirm.action === 'factory-reset' ? "Reset d'usine à distance"
                : confirm.action === 'release' ? 'Libérer ce buzzer ?' : 'Oublier ce buzzer ?'}
            </h3>
            <p className="text-sm mb-1 font-mono" style={{ color: 'var(--text)' }}>{confirm.nom}</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {confirm.action === 'factory-reset' && "Le buzzer efface son Wi-Fi et redémarre sur le portail de configuration (firmware ≥ esp32-1.1 requis)."}
              {confirm.action === 'release' && "Le propriétaire actuel perd le buzzer ; il redevient « à appairer » et pourra être réclamé par quelqu'un d'autre."}
              {confirm.action === 'forget' && "L'enregistrement est supprimé de la base. Le buzzer réapparaîtra s'il se reconnecte."}
            </p>
            <div className="flex gap-2">
              <button onClick={runAction} disabled={busy} className="btn-danger flex-1 gap-1.5">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Confirmer
              </button>
              <button onClick={() => setConfirm(null)} disabled={busy} className="btn-ghost flex-1 gap-1.5"><X size={13} />Annuler</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

// ── Onglet Journal ────────────────────────────────────────────────────────────
// Historique persistant des évènements buzzer (connexion, déconnexion, resets,
// appairage…). Survit à la suppression/réinitialisation d'un buzzer — ADMIN
// uniquement, jamais exposé aux users. IP + localité (best-effort) par évènement.
const EVENT_TYPE = {
  CONNECT:              { l: 'Connecté',              c: '#22C55E', Icon: LogIn },
  DISCONNECT:           { l: 'Déconnecté',             c: 'var(--text-dim)', Icon: LogOut },
  FACTORY_RESET_ADMIN:  { l: "Reset demandé (admin)",  c: '#F59E0B', Icon: RefreshCw },
  FACTORY_RESET_DEVICE: { l: "Reset confirmé (appareil)", c: '#EF4444', Icon: RotateCcw },
  CLAIM:                { l: 'Appairé',                c: '#818CF8', Icon: Link2 },
  RELEASE:              { l: 'Libéré (utilisateur)',   c: '#38BDF8', Icon: Unlink2 },
  RELEASE_ADMIN:        { l: 'Libéré (admin)',         c: '#38BDF8', Icon: Unlink2 },
  FORGET:               { l: 'Supprimé (admin)',       c: '#F87171', Icon: Ban },
  OTA_SUCCESS:          { l: 'MAJ réussie',            c: '#22C55E', Icon: UploadCloud },
  OTA_FAILED:           { l: 'MAJ échouée',            c: '#F87171', Icon: AlertTriangle },
}

function JournalTab({ apiFetch }) {
  const [data, setData] = useState(null)
  const [mac, setMac] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async (m, p) => {
    const qs = new URLSearchParams({ page: String(p) })
    if (m) qs.set('mac', m)
    const res = await apiFetch(`/admin/firmware/journal?${qs}`)
    if (res?.ok) setData(await res.json())
  }, [])
  useEffect(() => { load(mac, page) }, [load, mac, page])

  function onSearch(e) {
    e.preventDefault()
    setPage(1)
    load(mac, 1)
  }

  return (
    <div>
      <form onSubmit={onSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input value={mac} onChange={e => setMac(e.target.value.toUpperCase())}
            placeholder="Filtrer par MAC (AA:BB:CC:DD:EE:FF)"
            className="input pl-8 font-mono text-xs" />
        </div>
        <button type="submit" className="btn-secondary btn-sm">Filtrer</button>
        {mac && <button type="button" onClick={() => { setMac(''); setPage(1); load('', 1) }} className="btn-ghost btn-sm">Effacer</button>}
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Évènement', 'MAC', 'Origine', 'Firmware', 'Date'].map((h, i) => (
                  <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: 'var(--text-dim)' }} /></td></tr>
              ) : data.events.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                  <ScrollText size={22} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />Aucun évènement journalisé
                </td></tr>
              ) : data.events.map(ev => {
                const t = EVENT_TYPE[ev.type] ?? { l: ev.type, c: 'var(--text-dim)', Icon: ScrollText }
                const Icon = t.Icon
                return (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--input-bg)' }}>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: t.c + '22', color: t.c }}>
                        <Icon size={11} />{t.l}
                      </span>
                      {ev.meta?.error && (
                        <div className="text-2xs mt-1 font-mono" style={{ color: '#F87171' }}>{ev.meta.error}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs" style={{ color: 'var(--text)' }}>{ev.mac}</td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ev.ip ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} style={{ color: 'var(--text-dim)' }} />
                          {ev.ville || ev.pays ? `${ev.ville ?? ''}${ev.ville && ev.pays ? ', ' : ''}${ev.pays ?? ''}` : ev.ip}
                        </span>
                      ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{ev.firmware ?? '—'}</td>
                    <td className="px-3 py-3 text-2xs" style={{ color: 'var(--text-dim)' }}>
                      {new Date(ev.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {data && data.pages > 1 && (
        <Pagination page={data.page} pages={data.pages} total={data.total} perPage={data.perPage} onPage={setPage} />
      )}
    </div>
  )
}
