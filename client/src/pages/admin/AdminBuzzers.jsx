import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Loader2, Radio, BatteryLow, Battery, Wifi, UploadCloud, Check } from 'lucide-react'

const STATUT = {
  ONLINE:        { c: '#22C55E', l: 'En ligne' },
  IN_GAME:       { c: '#3B82F6', l: 'En jeu' },
  AWAITING_CLAIM:{ c: '#EAB308', l: 'À appairer' },
  OFFLINE:       { c: '#5A5A6E', l: 'Hors ligne' },
}

export default function AdminBuzzers() {
  const { apiFetch } = useAuth()
  const [data, setData] = useState(null)
  const [cfg, setCfg] = useState({ enabled: false, version: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [pushed, setPushed] = useState(null)

  const load = useCallback(async () => {
    const res = await apiFetch('/admin/firmware')
    if (res?.ok) { const d = await res.json(); setData(d); setCfg(d.config) }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [load])

  async function saveCfg() {
    setSaving(true)
    await apiFetch('/admin/firmware', { method: 'PUT', body: { enabled: !!cfg.enabled, version: cfg.version, url: cfg.url } })
    setSaving(false); load()
  }
  async function pushOta() {
    const res = await apiFetch('/admin/firmware/push', { method: 'POST' })
    if (res?.ok) { const d = await res.json(); setPushed(d.pushed); setTimeout(() => setPushed(null), 4000) }
  }

  if (!data) return <AdminLayout><Loader2 size={22} className="animate-spin mx-auto my-16" style={{ color: '#5A5A6E' }} /></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#ECECF0' }}>Parc de buzzers</h1>
        <p className="text-sm mt-0.5" style={{ color: '#5A5A6E' }}>Supervision (batterie, signal, firmware) & mises à jour OTA.</p>
      </div>

      {/* Cible OTA */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#ECECF0' }}>
          <UploadCloud size={16} style={{ color: '#818CF8' }} />Mise à jour firmware (OTA)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-end">
          <div>
            <label className="label">Version cible</label>
            <input value={cfg.version ?? ''} onChange={e => setCfg(c => ({ ...c, version: e.target.value }))} className="input w-full" placeholder="esp32-1.1" />
          </div>
          <div>
            <label className="label">URL du firmware (.bin)</label>
            <input value={cfg.url ?? ''} onChange={e => setCfg(c => ({ ...c, url: e.target.value }))} className="input w-full" placeholder="https://…/gbairai_buzzer.bin" />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))} className="flex items-center gap-2">
            <span className="w-9 h-5 rounded-full relative transition-all" style={{ background: cfg.enabled ? '#22C55E' : 'rgba(255,255,255,0.12)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: cfg.enabled ? '18px' : '2px' }} />
            </span>
            <span className="text-sm" style={{ color: '#ECECF0' }}>OTA activé</span>
          </button>
          <button onClick={saveCfg} disabled={saving} className="btn-primary gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Enregistrer
          </button>
          <button onClick={pushOta} disabled={!cfg.enabled} className="btn-secondary gap-2">
            <UploadCloud size={14} />Pousser maintenant
          </button>
          {pushed != null && <span className="text-sm" style={{ color: '#22C55E' }}>OTA poussé à {pushed} buzzer(s)</span>}
        </div>
        <p className="text-2xs mt-3" style={{ color: '#5A5A6E' }}>
          L'OTA n'est proposé qu'aux buzzers <strong>en ligne, au repos et obsolètes</strong> (jamais en pleine partie).
        </p>
      </div>

      {/* Parc */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Buzzer', 'Propriétaire', 'Statut', 'Batterie', 'Signal', 'Firmware', 'Vu'].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#5A5A6E' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.buzzers.map(b => {
              const st = STATUT[b.status] ?? STATUT.OFFLINE
              const low = b.battery != null && b.battery <= 15
              const outdated = data.config.enabled && data.config.version && b.firmware !== data.config.version
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-3 py-3 font-mono text-xs" style={{ color: '#ECECF0' }}>{b.nom || b.mac}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: '#9090A0' }}>{b.owner?.email ?? '—'}</td>
                  <td className="px-3 py-3"><span className="text-2xs font-semibold px-2 py-0.5 rounded-full" style={{ background: st.c + '22', color: st.c }}>{st.l}</span></td>
                  <td className="px-3 py-3 text-xs">
                    {b.battery == null ? <span style={{ color: '#5A5A6E' }}>—</span> : (
                      <span className="inline-flex items-center gap-1" style={{ color: low ? '#F87171' : '#9090A0' }}>
                        {low ? <BatteryLow size={13} /> : <Battery size={13} />}{b.battery}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs" style={{ color: '#9090A0' }}>
                    {b.rssi == null ? '—' : <span className="inline-flex items-center gap-1"><Wifi size={12} />{b.rssi} dBm</span>}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span style={{ color: outdated ? '#F59E0B' : '#9090A0' }}>{b.firmware ?? '—'}{outdated ? ' ⟳' : ''}</span>
                  </td>
                  <td className="px-3 py-3 text-2xs" style={{ color: '#5A5A6E' }}>
                    {b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              )
            })}
            {data.buzzers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: '#5A5A6E' }}>
                <Radio size={24} className="mx-auto mb-2" style={{ color: '#2A2A35' }} />Aucun buzzer enregistré
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
