import React from 'react'

// Indicateur de batterie compact : 🟢 >60 · 🟡 30–60 · 🔴 <30. % exact au survol.
export default function BatteryBadge({ battery, showPct = true }) {
  if (battery == null) return null
  const color = battery > 60 ? '#22C55E' : battery >= 30 ? '#EAB308' : '#F87171'
  const dot = battery > 60 ? '🟢' : battery >= 30 ? '🟡' : '🔴'
  return (
    <span title={`Batterie : ${battery}%`} className="inline-flex items-center gap-0.5"
      style={{ color, fontSize: '0.68rem', fontWeight: 600 }}>
      {dot}{showPct ? ` ${battery}%` : ''}
    </span>
  )
}
