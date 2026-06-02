import React, { useEffect, useRef, useState } from 'react'
import { Play, Volume2, AlertTriangle, RotateCw } from 'lucide-react'

// Extrait l'ID d'une URL YouTube (watch, youtu.be, embed, shorts).
export function youtubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/)
  return m ? m[1] : null
}

export function isUploadedFile(url = '') {
  return url.startsWith('/uploads') || url.startsWith('blob:')
}

// Tolérance de désynchronisation (s) au-delà de laquelle on recale la lecture.
const SYNC_TOLERANCE = 0.6

/**
 * Affichage + synchronisation du média d'une question en jeu.
 * - IMAGE : grande image centrée (optimisée TV / vidéoprojecteur)
 * - AUDIO : lecture pilotée par l'horloge serveur + indicateur visuel
 * - VIDEO : fichier (<video>) ou YouTube (iframe), avec début/fin
 *
 * Props :
 *  - question   : objet question public (type, mediaUrl, audioUrl, videoUrl, videoDebut, videoFin)
 *  - autoplay   : lecture auto par défaut (si pas de mediaState fourni)
 *  - compact    : version réduite (aperçu animateur)
 *  - mediaState : { playing, position, seq } — directive de synchro serveur.
 *                 Quand fourni, la lecture suit cette référence (position/play/pause)
 *                 plutôt que l'autoplay local. `seq` change à chaque commande.
 */
export default function QuestionMedia({ question: q, autoplay = false, compact = false, mediaState = null }) {
  if (!q) return null

  if (q.type === 'IMAGE' && q.mediaUrl) {
    return (
      <div className={compact ? 'mt-3 flex justify-center' : 'mt-6 flex justify-center'}>
        <img
          src={q.mediaUrl}
          alt="Question"
          className="rounded-2xl object-contain shadow-2xl"
          style={{ maxHeight: compact ? 220 : '55vh', maxWidth: '100%', background: 'rgba(0,0,0,0.25)' }}
        />
      </div>
    )
  }

  if (q.type === 'AUDIO' && q.audioUrl) {
    return <AudioQuestion url={q.audioUrl} autoplay={autoplay} compact={compact} mediaState={mediaState} />
  }

  if (q.type === 'VIDEO' && q.videoUrl) {
    return (
      <VideoQuestion
        url={q.videoUrl}
        debut={q.videoDebut ?? 0}
        fin={q.videoFin ?? null}
        autoplay={autoplay}
        compact={compact}
        mediaState={mediaState}
      />
    )
  }

  return null
}

// Applique une directive de synchro (position + play/pause) à un élément média
// <audio>/<video>, en gérant le cas « média pas encore chargé » (seek différé)
// et les erreurs de lecture (autoplay bloqué). Renvoie un état d'UI.
function useMediaSync(ref, { url, mediaState, autoplay, debut, fin }) {
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  // Position cible en attente (si les métadonnées ne sont pas encore prêtes).
  const pending = useRef(null)

  // Applique la position/lecture cible sur l'élément.
  function apply(el, target) {
    if (!el) return
    const want = target ?? mediaState
    if (!want) {
      // Pas de synchro serveur : repli sur l'autoplay local.
      if (autoplay) el.play().then(() => setPlaying(true)).catch(() => setBlocked(true))
      return
    }
    const pos = Math.max(0, want.position ?? 0)
    const seek = () => {
      // Ne recale que si l'écart dépasse la tolérance (évite les micro-sauts).
      if (Number.isFinite(el.duration) && pos > el.duration + 1) return
      if (Math.abs((el.currentTime || 0) - pos) > SYNC_TOLERANCE) {
        try { el.currentTime = pos } catch { /* pas encore seekable */ }
      }
    }
    if (el.readyState >= 1) {
      seek()
    } else {
      pending.current = want
      return
    }
    if (want.playing) {
      el.play().then(() => { setPlaying(true); setBlocked(false) }).catch(() => setBlocked(true))
    } else {
      el.pause(); setPlaying(false)
    }
  }

  // Recalage à chaque nouvelle commande serveur (seq) ou changement d'URL.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setError(false)
    apply(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mediaState?.seq, mediaState?.playing, autoplay])

  // Gestion des évènements de l'élément (chargement, erreurs, fin).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onLoaded = () => {
      // Applique un seek différé (média chargé après réception de la commande).
      if (pending.current) { const p = pending.current; pending.current = null; apply(el, p) }
      else if (!mediaState && debut) el.currentTime = debut
    }
    const onTime = () => { if (fin && el.currentTime >= fin) el.pause() }
    const onError = () => setError(true)
    const onPlay = () => { setPlaying(true); setBlocked(false) }
    const onPause = () => setPlaying(false)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('loadeddata', onLoaded)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('error', onError)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('loadeddata', onLoaded)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('error', onError)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, fin, debut, mediaState])

  // Lecture manuelle (déblocage autoplay) : on recale d'abord à la position serveur.
  function manualPlay() {
    const el = ref.current
    if (!el) return
    if (mediaState && mediaState.position != null) {
      try { el.currentTime = Math.max(0, mediaState.position) } catch { /* noop */ }
    }
    el.play().then(() => { setPlaying(true); setBlocked(false) }).catch(() => {})
  }

  // Déblocage automatique : si l'autoplay est refusé par le navigateur (aucune
  // interaction préalable), on rejoue le média synchronisé au tout premier geste
  // du joueur n'importe où sur la page (ex. appui buzzer), sans qu'il ait à
  // trouver le bouton « Lire ». La synchro serveur est conservée (position).
  useEffect(() => {
    if (!blocked) return
    const onGesture = () => { manualPlay() }
    document.addEventListener('pointerdown', onGesture, { once: true, capture: true })
    document.addEventListener('keydown', onGesture, { once: true, capture: true })
    return () => {
      document.removeEventListener('pointerdown', onGesture, { capture: true })
      document.removeEventListener('keydown', onGesture, { capture: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, mediaState?.seq])

  // Recharge le média après une erreur réseau, puis recale.
  function retry() {
    const el = ref.current
    if (!el) return
    setError(false)
    try { el.load() } catch { /* noop */ }
    apply(el)
  }

  return { blocked, error, playing, manualPlay, retry }
}

function AudioQuestion({ url, autoplay, compact, mediaState }) {
  const ref = useRef(null)
  const { blocked, error, playing, manualPlay, retry } = useMediaSync(ref, { url, mediaState, autoplay })

  const barCount = compact ? 12 : 28
  return (
    <div className={compact ? 'mt-3' : 'mt-8'}>
      <div className="flex items-end justify-center gap-1 mx-auto"
        style={{ height: compact ? 48 : 120 }}>
        {Array.from({ length: barCount }).map((_, i) => (
          <span key={i}
            style={{
              width: compact ? 4 : 8,
              borderRadius: 4,
              background: 'linear-gradient(to top, #7C3AED, #C084FC)',
              height: '100%',
              transformOrigin: 'bottom',
              animation: playing ? `eqbar 0.9s ease-in-out ${i * 0.06}s infinite alternate` : 'none',
              opacity: playing ? 1 : 0.35,
            }} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-4">
        <Volume2 size={compact ? 14 : 18} style={{ color: '#C084FC' }} />
        <span className="uppercase tracking-widest font-semibold"
          style={{ color: '#C084FC', fontSize: compact ? 11 : 14 }}>
          {error ? 'Erreur de chargement' : blocked ? 'Cliquez pour écouter' : playing ? 'Écoute en cours…' : 'En pause'}
        </span>
      </div>
      {error && (
        <div className="flex justify-center mt-3">
          <button onClick={retry} className="btn-secondary btn-sm gap-2">
            <RotateCw size={14} />Réessayer
          </button>
        </div>
      )}
      {!error && blocked && (
        <div className="flex justify-center mt-3">
          <button onClick={manualPlay} className="btn-primary gap-2">
            <Play size={16} />Lire l'extrait
          </button>
        </div>
      )}
      <audio ref={ref} src={url} controls className="mt-4 mx-auto" style={{ width: compact ? '100%' : 480, maxWidth: '100%' }} />
      <style>{`@keyframes eqbar { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }`}</style>
    </div>
  )
}

function VideoQuestion({ url, debut, fin, autoplay, compact, mediaState }) {
  const ytId = youtubeId(url)
  const ref = useRef(null)
  // Hook de synchro uniquement pour les fichiers <video> (YouTube = iframe).
  const { blocked, error, manualPlay, retry } = useMediaSync(
    ytId ? { current: null } : ref,
    { url, mediaState, autoplay, debut, fin },
  )

  const maxH = compact ? 220 : '60vh'

  if (ytId) {
    // YouTube : synchro fine impossible sans l'API JS ; on positionne au début
    // et on laisse la lecture suivre. Le `seq` force le rechargement de l'iframe
    // pour rejouer/recaler quand l'animateur agit.
    const wantPlay = mediaState ? mediaState.playing : autoplay
    const start = Math.floor(mediaState?.position ?? debut ?? 0)
    const params = new URLSearchParams({
      autoplay: wantPlay ? '1' : '0',
      rel: '0',
      modestbranding: '1',
      ...(start ? { start: String(start) } : {}),
      ...(fin ? { end: String(fin) } : {}),
    })
    return (
      <div className={compact ? 'mt-3' : 'mt-6'} style={{ width: '100%' }}>
        <div className="relative mx-auto rounded-2xl overflow-hidden shadow-2xl"
          style={{ maxWidth: compact ? 420 : 960, aspectRatio: '16 / 9', background: '#000' }}>
          <iframe
            key={mediaState?.seq ?? 'yt'}
            src={`https://www.youtube.com/embed/${ytId}?${params}`}
            title="Question vidéo"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={compact ? 'mt-3 flex flex-col items-center' : 'mt-6 flex flex-col items-center'}>
      <video ref={ref} src={url} controls playsInline
        className="rounded-2xl shadow-2xl" style={{ maxHeight: maxH, maxWidth: '100%', background: '#000' }} />
      {error && (
        <button onClick={retry} className="btn-secondary btn-sm gap-2 mt-3">
          <AlertTriangle size={14} />Vidéo indisponible — Réessayer
        </button>
      )}
      {!error && blocked && (
        <button onClick={manualPlay} className="btn-primary gap-2 mt-3">
          <Play size={16} />Lire la vidéo
        </button>
      )}
    </div>
  )
}
