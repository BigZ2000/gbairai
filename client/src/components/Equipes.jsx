import React from 'react'
import { Trophy, Users } from 'lucide-react'

// ── Jeu par équipes : éléments partagés ──────────────────────────────────────
// Le serveur envoie le classement des équipes déjà calculé ({ index, nom,
// couleur, score, membres, rang }) dans participant_update et game_ended.

export const NOMBRES_EQUIPES = [2, 3, 4]

/** Équipe d'un joueur, d'après la liste de la partie. */
export function equipeDe(partie, participant) {
  const eq = partie?.equipes
  if (!Array.isArray(eq) || participant?.equipe == null) return null
  const e = eq[participant.equipe]
  return e ? { ...e, index: participant.equipe } : null
}

/** Classement calculé côté client (avant le premier participant_update). */
export function classementLocal(partie, participants) {
  const eq = partie?.equipes
  if (!Array.isArray(eq) || eq.length < 2) return null
  const lignes = eq.map((e, index) => ({ index, nom: e.nom, couleur: e.couleur, score: 0, membres: 0 }))
  for (const p of participants ?? []) {
    if (p.isAnimateur) continue
    const l = lignes[p.equipe]
    if (l) { l.score += p.score ?? 0; l.membres++ }
  }
  lignes.sort((a, b) => b.score - a.score || a.membres - b.membres || a.index - b.index)
  return lignes.map((l, i) => ({ ...l, rang: i + 1 }))
}

/** Pastille « Équipe Soleil ». */
export function PastilleEquipe({ equipe, taille = 'sm' }) {
  if (!equipe) return null
  const grand = taille === 'lg'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${grand ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-2xs'}`}
      style={{ background: `${equipe.couleur}22`, color: equipe.couleur, border: `1px solid ${equipe.couleur}55` }}>
      <span className={`rounded-full ${grand ? 'w-2.5 h-2.5' : 'w-2 h-2'}`} style={{ background: equipe.couleur }} />
      {equipe.nom}
    </span>
  )
}

/**
 * Classement des équipes.
 * variant : 'tv' (écran public), 'bar' (bandeau bas d'écran), 'liste' (page / téléphone).
 */
export function ClassementEquipes({ equipes, variant = 'liste', maEquipe = null }) {
  if (!equipes?.length) return null
  const max = Math.max(1, ...equipes.map(e => e.score))

  if (variant === 'bar') {
    return (
      <div className="flex justify-center gap-8 flex-wrap">
        {equipes.map(e => (
          <div key={e.index} className="flex items-center gap-3">
            {e.rang === 1 && e.score > 0 && <Trophy size={20} style={{ color: '#D99A00' }} />}
            <span className="w-3.5 h-3.5 rounded-full" style={{ background: e.couleur }} />
            <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>{e.nom}</span>
            <span className="text-xl font-black tabular-nums" style={{ color: e.couleur }}>{e.score} pts</span>
          </div>
        ))}
      </div>
    )
  }

  const tv = variant === 'tv'
  return (
    <div className={`w-full ${tv ? 'max-w-3xl space-y-4' : 'space-y-2'}`}>
      {equipes.map(e => {
        const moi = maEquipe != null && e.index === maEquipe
        return (
          <div key={e.index} className={`rounded-2xl ${tv ? 'px-7 py-5' : 'px-4 py-3'}`}
            style={{
              background: 'var(--surface)',
              border: `${moi ? 2 : 1}px solid ${moi ? e.couleur : 'var(--border)'}`,
            }}>
            <div className="flex items-center gap-3">
              <span className={`${tv ? 'text-3xl w-10' : 'text-base w-6'} font-black text-center`} style={{ color: e.rang === 1 ? '#D99A00' : 'var(--text-dim)' }}>
                {e.rang}
              </span>
              <span className={`${tv ? 'w-5 h-5' : 'w-3 h-3'} rounded-full shrink-0`} style={{ background: e.couleur }} />
              <span className={`${tv ? 'text-3xl' : 'text-sm'} font-bold flex-1 min-w-0 truncate`} style={{ color: 'var(--text)' }}>
                {e.nom}{moi && <span className="text-2xs font-semibold ml-2" style={{ color: e.couleur }}>ton équipe</span>}
              </span>
              <span className={`${tv ? 'text-base' : 'text-2xs'} flex items-center gap-1 shrink-0`} style={{ color: 'var(--text-dim)' }}>
                <Users size={tv ? 16 : 11} />{e.membres}
              </span>
              <span className={`${tv ? 'text-3xl' : 'text-base'} font-black tabular-nums shrink-0`} style={{ color: e.couleur }}>
                {e.score}<span className={tv ? 'text-lg' : 'text-2xs'}> pts</span>
              </span>
            </div>
            <div className={`${tv ? 'h-3 mt-3' : 'h-1.5 mt-2'} rounded-full overflow-hidden`} style={{ background: 'var(--hover-overlay)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(e.score / max) * 100}%`, background: e.couleur }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
