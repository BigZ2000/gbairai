import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader2 } from 'lucide-react'
import AnimateurJeu from './AnimateurJeu.jsx'
import JoueurJeu from './JoueurJeu.jsx'

// Aiguilleur de l'écran de jeu : l'hôte (animateur OU créateur) voit la régie,
// tout autre participant voit l'écran joueur (gros bouton BUZZ).
// Toutes les entrées (Dashboard, SalleAttente, URL directe) passent par /jeu.
export default function PartieJeu() {
  const { partieCode } = useParams()
  const { user, apiFetch } = useAuth()
  const [isHost, setIsHost] = useState(null) // null = en cours de détermination

  useEffect(() => {
    let alive = true
    apiFetch(`/parties/by-code/${partieCode.toUpperCase()}`).then(r => r?.ok ? r.json() : null).then(p => {
      if (!alive) return
      const host = !!p && (p.animateurId === user?.id || (p.creatorId && p.creatorId === user?.id))
      setIsHost(host)
    }).catch(() => alive && setIsHost(false))
    return () => { alive = false }
  }, [partieCode, user?.id])

  if (isHost === null) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0E0E12' }}>
      <Loader2 size={26} className="animate-spin" style={{ color: '#6366F1' }} />
    </div>
  }
  return isHost ? <AnimateurJeu /> : <JoueurJeu />
}
