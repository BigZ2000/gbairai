// ──────────────────────────────────────────────────────────────────────────────
// Charts légers en SVG pur (aucune dépendance). Thémables via les tokens CSS.
// BarChart · LineChart · Donut — responsives (viewBox + width 100%).
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'

const AXIS = 'var(--text-dim)'
const GRID = 'var(--border)'

// ── Histogramme vertical ──────────────────────────────────────────────────────
// data : [{ label, value }]
export function BarChart({ data = [], color = '#6366F1', height = 180, format = v => v }) {
  if (!data.length) return <Empty height={height} />
  const W = 520, H = height, padB = 26, padT = 12, padX = 8
  const max = Math.max(...data.map(d => d.value), 1)
  const bw = (W - padX * 2) / data.length
  const barW = Math.min(bw * 0.62, 46)
  const scale = v => (H - padB - padT) * (v / max)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      {/* lignes de grille */}
      {[0.25, 0.5, 0.75, 1].map(t => {
        const y = padT + (H - padB - padT) * (1 - t)
        return <line key={t} x1={padX} y1={y} x2={W - padX} y2={y} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
      })}
      {data.map((d, i) => {
        const h = scale(d.value)
        const x = padX + i * bw + (bw - barW) / 2
        const y = H - padB - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx="4" fill={color}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">
                {format(d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="9.5" fill={AXIS}>
              {String(d.label).length > 8 ? String(d.label).slice(0, 7) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Courbe (avec aire dégradée) ───────────────────────────────────────────────
// data : [{ label, value }]
export function LineChart({ data = [], color = '#22C55E', height = 180, format = v => v }) {
  if (data.length < 2) return <Empty height={height} />
  const W = 520, H = height, padB = 24, padT = 14, padX = 14
  const max = Math.max(...data.map(d => d.value), 1)
  const min = Math.min(...data.map(d => d.value), 0)
  const span = max - min || 1
  const x = i => padX + (W - padX * 2) * (i / (data.length - 1))
  const y = v => padT + (H - padB - padT) * (1 - (v - min) / span)
  const pts = data.map((d, i) => [x(i), y(d.value)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L${pts[0][0].toFixed(1)} ${H - padB} Z`
  const gid = 'lg' + color.replace('#', '')
  const step = Math.ceil(data.length / 7)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(t => {
        const yy = padT + (H - padB - padT) * t
        return <line key={t} x1={padX} y1={yy} x2={W - padX} y2={yy} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color}>
          <title>{`${data[i].label}: ${format(data[i].value)}`}</title>
        </circle>
      ))}
      {data.map((d, i) => i % step === 0 && (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="9" fill={AXIS}>{d.label}</text>
      ))}
    </svg>
  )
}

// ── Donut + légende ───────────────────────────────────────────────────────────
// data : [{ label, value, color }]
export function Donut({ data = [], size = 150, format = v => v }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <Empty height={size} />
  const r = size / 2, ir = r * 0.62, cx = r, cy = r
  let acc = 0
  const arc = (frac) => {
    const a0 = acc * 2 * Math.PI - Math.PI / 2
    acc += frac
    const a1 = acc * 2 * Math.PI - Math.PI / 2
    const large = frac > 0.5 ? 1 : 0
    const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
    const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r)
    const [x2, y2] = p(a1, ir), [x3, y3] = p(a0, ir)
    return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`
  }
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {data.map((d, i) => <path key={i} d={arc(d.value / total)} fill={d.color}><title>{`${d.label}: ${format(d.value)}`}</title></path>)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{format(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill={AXIS}>Total</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{format(d.value)}</span>
            <span className="text-2xs" style={{ color: 'var(--text-dim)' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty({ height }) {
  return (
    <div className="flex items-center justify-center text-sm" style={{ height, color: 'var(--text-dim)' }}>
      Pas encore de données
    </div>
  )
}
