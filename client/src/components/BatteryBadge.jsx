import React from 'react'

// Indicateur de batterie compact : pastille verte >60 · jaune 30-60 · rouge <30.
// % exact au survol.
export default function BatteryBadge({ battery, showPct = true }) {
  if (battery == null) return null
  const color = battery > 60 ? '#22C55E' : battery >= 30 ? '#EAB308' : '#F87171'
  return (
    <span title={`Batterie : ${battery}%`} className="inline-flex items-center gap-1"
      style={{ color, fontSize: '0.68rem', fontWeight: 600 }}>
      <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, background: color }} />
      {showPct ? `${battery}%` : ''}
    </span>
  )
}
