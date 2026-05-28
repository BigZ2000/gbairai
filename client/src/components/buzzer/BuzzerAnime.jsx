import React, { useState, useEffect, useRef } from 'react'

const SIZES = {
  sm: { outer: 80, ring: 8, label: 'text-xs', wifi: 10 },
  md: { outer: 110, ring: 10, label: 'text-sm', wifi: 12 },
  lg: { outer: 150, ring: 14, label: 'text-base', wifi: 14 },
  xl: { outer: 200, ring: 18, label: 'text-lg', wifi: 18 },
}

// Génère un dégradé légèrement plus clair depuis une couleur hex
function lighten(hex, amount = 30) {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (num >> 16) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

export default function BuzzerAnime({
  couleur = '#3B82F6',
  statut = 'offline',  // 'offline' | 'ready' | 'pressed' | 'winner' | 'locked'
  prenom = '',
  onPress = null,
  size = 'md',
}) {
  const s = SIZES[size] ?? SIZES.md
  const [ripples, setRipples] = useState([])
  const [stars, setStars] = useState([])
  const rippleId = useRef(0)

  const isOffline = statut === 'offline'
  const isReady = statut === 'ready'
  const isPressed = statut === 'pressed'
  const isWinner = statut === 'winner'
  const isLocked = statut === 'locked'

  const mainColor = isOffline ? '#6B7280' : isLocked ? '#EF4444' : couleur
  const lighterColor = lighten(mainColor)

  // Déclenche les ripples au press
  useEffect(() => {
    if (isPressed || isWinner) {
      const id = ++rippleId.current
      setRipples(r => [...r, id])
      const t = setTimeout(() => setRipples(r => r.filter(x => x !== id)), 700)
      return () => clearTimeout(t)
    }
  }, [isPressed, isWinner])

  // Génère les étoiles winner
  useEffect(() => {
    if (isWinner) {
      const generated = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        angle: (i / 8) * 360,
        distance: s.outer * 0.65,
      }))
      setStars(generated)
      const t = setTimeout(() => setStars([]), 900)
      return () => clearTimeout(t)
    }
  }, [isWinner])

  const outer = s.outer
  const center = outer / 2
  const domeR = outer * 0.38
  const ringW = s.ring

  // Animations CSS dynamiques
  let domeCls = 'transition-transform'
  if (isPressed || isWinner) domeCls += ' scale-[0.88] translate-y-1'
  if (isWinner) domeCls += ' animate-winner_bounce'
  if (isLocked) domeCls += ' animate-shake'

  let containerCls = 'select-none'
  if (isReady) containerCls += ' animate-pulse_glow'

  const glowOpacity = isOffline ? 0 : isWinner ? 1 : isReady ? 0.5 : isPressed ? 0.8 : 0.3
  const glowSize = isWinner ? outer * 0.9 : outer * 0.5
  const containerOpacity = isOffline ? 0.5 : 1

  return (
    <div
      className={`flex flex-col items-center gap-2 ${containerCls}`}
      style={{ opacity: containerOpacity }}
    >
      <div
        className="relative cursor-pointer"
        style={{ width: outer, height: outer }}
        onClick={onPress}
        role={onPress ? 'button' : undefined}
        aria-label={`Buzzer ${prenom}`}
      >
        {/* Glow externe */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none transition-all duration-300"
          style={{
            boxShadow: `0 0 ${glowSize}px ${mainColor}`,
            opacity: glowOpacity,
            borderRadius: '50%',
          }}
        />

        {/* Étoiles winner */}
        {stars.map(star => (
          <div
            key={star.id}
            className="absolute animate-star_burst pointer-events-none"
            style={{
              width: 8,
              height: 8,
              top: center - 4,
              left: center - 4,
              transformOrigin: `4px ${star.distance}px`,
              transform: `rotate(${star.angle}deg)`,
            }}
          >
            <svg viewBox="0 0 10 10" width="10" height="10">
              <polygon points="5,0 6.5,3.5 10,3.5 7,6 8,10 5,7.5 2,10 3,6 0,3.5 3.5,3.5"
                fill={mainColor} />
            </svg>
          </div>
        ))}

        {/* SVG du buzzer */}
        <svg width={outer} height={outer} viewBox={`0 0 ${outer} ${outer}`}>
          <defs>
            <radialGradient id={`dome-${prenom}`} cx="40%" cy="30%">
              <stop offset="0%" stopColor={lighterColor} />
              <stop offset="100%" stopColor={mainColor} />
            </radialGradient>
            <radialGradient id={`ring-${prenom}`} cx="50%" cy="50%">
              <stop offset="0%" stopColor={lighten(mainColor, 10)} />
              <stop offset="100%" stopColor={mainColor} stopOpacity="0.7" />
            </radialGradient>
          </defs>

          {/* Anneau extérieur */}
          <circle
            cx={center} cy={center} r={center - 2}
            fill={`url(#ring-${prenom})`}
            opacity={isOffline ? 0.4 : 0.9}
          />

          {/* Anneau intérieur (espace) */}
          <circle
            cx={center} cy={center} r={center - ringW}
            fill="#111827"
          />

          {/* Ombre du dôme (effet 3D) */}
          {!isPressed && !isWinner && (
            <ellipse
              cx={center} cy={center + domeR * 0.85}
              rx={domeR * 0.7} ry={domeR * 0.2}
              fill="rgba(0,0,0,0.5)"
            />
          )}

          {/* Dôme principal */}
          <g className={domeCls} style={{ transformOrigin: `${center}px ${center}px` }}>
            <circle
              cx={center}
              cy={isPressed || isWinner ? center + 4 : center}
              r={domeR}
              fill={`url(#dome-${prenom})`}
              className="transition-all duration-75"
            />
            {/* Highlight blanc (reflet) */}
            <ellipse
              cx={center - domeR * 0.2}
              cy={(isPressed || isWinner ? center + 4 : center) - domeR * 0.35}
              rx={domeR * 0.3}
              ry={domeR * 0.15}
              fill="rgba(255,255,255,0.35)"
            />
          </g>

          {/* "PREMIER !" quand winner */}
          {isWinner && (
            <text
              x={center} y={center + domeR + ringW + 12}
              textAnchor="middle"
              fill={mainColor}
              fontSize={s.outer * 0.095}
              fontWeight="bold"
              letterSpacing="1"
            >
              PREMIER !
            </text>
          )}
        </svg>

        {/* Ripples */}
        {ripples.map(id => (
          <div
            key={id}
            className="absolute inset-0 rounded-full animate-ripple pointer-events-none"
            style={{ border: `3px solid ${mainColor}` }}
          />
        ))}

        {/* Indicateur WiFi en haut à droite */}
        <div
          className="absolute top-0 right-0 rounded-full border-2 border-gray-900"
          style={{
            width: s.wifi,
            height: s.wifi,
            background: isOffline ? '#6B7280' : isWinner ? '#10B981' : mainColor,
            boxShadow: isOffline ? 'none' : `0 0 6px ${mainColor}`,
          }}
        />
      </div>

      {/* Prénom */}
      {prenom && (
        <span className={`${s.label} font-semibold text-gray-200 truncate max-w-[${outer}px]`}>
          {prenom}
        </span>
      )}
    </div>
  )
}
