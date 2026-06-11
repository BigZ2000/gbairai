import React from 'react'
import { Trophy, Medal, Crown } from 'lucide-react'

// Podium spectaculaire de fin de partie.
// `classement` : [{ id, prenom, score, couleur, rang }] trié par score décroissant.
// `variant` : 'tv' (grand écran plateau) ou 'compact' (animateur).
export default function Podium({ classement = [], variant = 'tv', onClose, title = 'Partie terminée' }) {
  const top3 = classement.slice(0, 3)
  const rest = classement.slice(3)

  // Ordre d'affichage du podium : 2e — 1er — 3e
  const order = [top3[1], top3[0], top3[2]].filter(Boolean)
  const heights = { 1: 200, 2: 150, 3: 110 }
  const medals = {
    1: { color: '#F59E0B', label: 'Champion', icon: Crown },
    2: { color: '#9CA3AF', label: '2e place', icon: Medal },
    3: { color: '#A16207', label: '3e place', icon: Medal },
  }
  const big = variant === 'tv'

  return (
    <div className={`flex flex-col items-center w-full ${big ? 'gap-10' : 'gap-6'} animate-fadeUp`}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy size={big ? 40 : 26} style={{ color: '#F59E0B' }} />
          <h2 className={`${big ? 'text-5xl' : 'text-2xl'} font-black`} style={{ color: 'var(--text)' }}>
            {title}
          </h2>
        </div>
        {top3[0] && (
          <p className={`${big ? 'text-2xl' : 'text-base'} font-semibold`} style={{ color: '#F59E0B' }}>
            {top3[0].prenom} remporte la partie !
          </p>
        )}
      </div>

      {/* Podium top 3 */}
      <div className={`flex items-end justify-center ${big ? 'gap-6' : 'gap-3'}`}>
        {order.map(p => {
          const m = medals[p.rang]
          const Icon = m.icon
          const h = big ? heights[p.rang] : heights[p.rang] * 0.55
          return (
            <div key={p.id} className="flex flex-col items-center animate-scaleIn" style={{ animationDelay: `${p.rang * 80}ms` }}>
              <div className="rounded-full flex items-center justify-center mb-3 font-black text-white shadow-lg"
                style={{
                  width: big ? (p.rang === 1 ? 88 : 68) : (p.rang === 1 ? 56 : 44),
                  height: big ? (p.rang === 1 ? 88 : 68) : (p.rang === 1 ? 56 : 44),
                  background: p.couleur,
                  fontSize: big ? (p.rang === 1 ? '2rem' : '1.5rem') : '1.1rem',
                  boxShadow: `0 0 24px ${p.couleur}55`,
                }}>
                {p.prenom?.[0]?.toUpperCase() ?? '?'}
              </div>
              <Icon size={big ? 26 : 18} style={{ color: m.color }} />
              <p className={`${big ? 'text-xl' : 'text-sm'} font-bold mt-1 text-center max-w-[10rem] truncate`}
                style={{ color: 'var(--text)' }}>{p.prenom}</p>
              <p className={`${big ? 'text-lg' : 'text-xs'} font-black`} style={{ color: '#F59E0B' }}>
                {p.score} pt{p.score !== 1 ? 's' : ''}
              </p>
              <div className="rounded-t-xl mt-2 flex items-start justify-center pt-3 transition-all"
                style={{
                  width: big ? 130 : 78,
                  height: h,
                  background: `linear-gradient(180deg, ${m.color}33, ${m.color}11)`,
                  border: `1px solid ${m.color}55`,
                  borderBottom: 'none',
                }}>
                <span className={`${big ? 'text-5xl' : 'text-2xl'} font-black`} style={{ color: m.color }}>
                  {p.rang}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reste du classement */}
      {rest.length > 0 && (
        <div className={`w-full ${big ? 'max-w-xl' : 'max-w-sm'} space-y-1.5`}>
          {rest.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg px-4 py-2"
              style={{ background: 'var(--hover-overlay)', border: '1px solid var(--border)' }}>
              <span className={`${big ? 'text-base' : 'text-sm'} font-bold w-6`} style={{ color: 'var(--text-dim)' }}>
                {p.rang}
              </span>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: p.couleur }}>
                {p.prenom?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className={`${big ? 'text-base' : 'text-sm'} font-medium flex-1 truncate`} style={{ color: 'var(--text)' }}>
                {p.prenom}
              </span>
              <span className={`${big ? 'text-base' : 'text-sm'} font-black`} style={{ color: '#F59E0B' }}>
                {p.score} pt{p.score !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <button onClick={onClose} className="btn-primary mt-2">
          Retour au tableau de bord
        </button>
      )}
    </div>
  )
}
