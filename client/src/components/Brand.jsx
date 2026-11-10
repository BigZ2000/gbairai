import React from 'react'

// Marque Gbairai : une bulle (le « gbairai », la causerie) dont le cœur est un
// buzzer. Dessinée en SVG pour rester nette à toutes les tailles.
export function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <path d="M20 3C10.6 3 3 9.9 3 18.5c0 4.300 1.900 8.200 5 11L6.500 36.500l8.300-3.300c1.700.5 3.400.7 5.200.7 9.400 0 17-6.900 17-15.400S29.400 3 20 3Z" fill="var(--brand)" />
      <circle cx="20" cy="18.500" r="8" fill="#fff" />
      <circle cx="20" cy="18.500" r="4.600" fill="var(--mango)" />
    </svg>
  )
}

export default function Brand({ size = 30, withName = true }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark size={size} />
      {withName && (
        <span className="font-display font-extrabold tracking-tight" style={{ color: 'var(--text)', fontSize: size * 0.62 }}>
          Gbairai
        </span>
      )}
    </span>
  )
}
