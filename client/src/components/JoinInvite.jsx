import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'

// Invitation à rejoindre une partie : QR scannable + code + lien copiable.
// Le QR pointe vers /rejoindre/<code> : le joueur scanne et joue sans compte.
/** Lien d'invitation joignable depuis un autre appareil (IP du réseau local en développement). */
export function useLienRejoindre(code) {
  const [base, setBase] = useState(window.location.origin)
  useEffect(() => {
    const h = window.location.hostname
    if (h !== 'localhost' && h !== '127.0.0.1') return
    fetch('/api/net').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.ip) setBase(`${window.location.protocol}//${d.ip}:${window.location.port || '5173'}`)
    }).catch(() => {})
  }, [])
  return `${base}/rejoindre/${code}`
}

export default function JoinInvite({ code, compact = false }) {
  const [copied, setCopied] = useState(false)
  const url = useLienRejoindre(code)


  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: 'rgba(242,106,27,0.05)', border: '1px solid rgba(242,106,27,0.15)' }}>
      <div className="bg-white rounded-xl p-2 shrink-0">
        <QRCodeSVG value={url} size={compact ? 96 : 112} level="M" includeMargin={false} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Scanne pour rejoindre</p>
        <p className="text-2xs mb-2" style={{ color: 'var(--text-dim)' }}>Pas besoin de compte — un pseudo suffit.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Code</span>
          <span className="font-mono font-black text-lg tracking-widest" style={{ color: 'var(--brand-text)' }}>{code}</span>
          <button onClick={copy} className="btn-ghost btn-sm gap-1 text-2xs">
            {copied ? <Check size={12} style={{ color: '#22C55E' }} /> : <Copy size={12} />}{copied ? 'Copié' : 'Copier le lien'}
          </button>
        </div>
      </div>
    </div>
  )
}
