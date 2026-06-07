import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader2 } from 'lucide-react'
import AnimateurJeu from './AnimateurJeu.jsx'
import JoueurJeu from './JoueurJeu.jsx'

// Aiguilleur de l'écran de jeu.
//  • Seul le MAÎTRE DU JEU (participant isAnimateur=true) voit la RÉGIE.
//  • Tout le reste — joueurs, invités, créateur en auto/vote, animateur qui
//    « joue aussi » — voit l'écran JOUEUR (avec barre hôte si créateur).
export default function PartieJeu() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const [route, setRoute] = useState(null) // null | 'regie' | 'joueur'

  useEffect(() => {
    let alive = true
    apiFetch(`/parties/by-code/${partieCode.toUpperCase()}`).then(r => r?.ok ? r.json() : null).then(p => {
      if (!alive) return
      const me = p?.participants?.find(pp => pp.userId === user?.id)
      setRoute(me?.isAnimateur ? 'regie' : 'joueur')
    }).catch(() => alive && setRoute('joueur'))
    return () => { alive = false }
  }, [partieCode, user?.id])

  if (route === null) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <Loader2 size={26} className="animate-spin" style={{ color: '#6366F1' }} />
    </div>
  }
  return route === 'regie' ? <AnimateurJeu /> : <JoueurJeu />
}
