import React, { useEffect, useRef } from 'react'
import { Volume2, Play, CheckCircle, XCircle } from 'lucide-react'

const LETTER = ['A', 'B', 'C', 'D', 'E', 'F']

const CHOICE_COLORS = [
  { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)', text: '#818CF8' },
  { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)',  text: '#4ADE80' },
  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)', text: '#FCD34D' },
  { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.3)',  text: '#F87171' },
  { bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.3)', text: '#C084FC' },
  { bg: 'rgba(20,184,166,0.10)', border: 'rgba(20,184,166,0.3)', text: '#2DD4BF' },
]

export default function QuestionDisplay({ question, revealed = false, showAnswer = false, size = 'md' }) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (question?.type === 'AUDIO' && question.audioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {})
    }
  }, [question?.id])

  if (!question) return null

  const enoneSize = size === 'xl' ? 'text-5xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'
  const padding   = size === 'xl' ? 'p-14' : size === 'lg' ? 'p-10' : 'p-7'

  return (
    <div className={`rounded-2xl w-full ${padding} text-center`}
      style={{ background: '#18181C', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Question text */}
      <p className={`font-bold leading-tight mb-6 ${enoneSize}`} style={{ color: '#ECECF0' }}>
        {question.enonce}
      </p>

      {/* Type-specific body */}
      {question.type === 'BUZZER' && (
        <p className="text-sm font-medium uppercase tracking-widest" style={{ color: '#5A5A6E' }}>
          Buzzer pour répondre
        </p>
      )}

      {question.type === 'QCM' && question.choix?.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {question.choix.map((c, i) => {
            const col = CHOICE_COLORS[i % CHOICE_COLORS.length]
            const isCorrect = revealed && question.reponse === LETTER[i]
            return (
              <div key={i}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                style={{
                  background: isCorrect ? 'rgba(34,197,94,0.15)' : col.bg,
                  border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.5)' : col.border}`,
                }}>
                <span className="text-lg font-black shrink-0" style={{ color: col.text }}>{LETTER[i]}</span>
                <span className="text-base font-medium" style={{ color: '#ECECF0' }}>{c}</span>
                {isCorrect && <CheckCircle size={16} style={{ color: '#4ADE80', marginLeft: 'auto' }} />}
              </div>
            )
          })}
        </div>
      )}

      {question.type === 'VRAI_FAUX' && (
        <div className="flex gap-4 justify-center mt-4">
          {[
            { val: 'Vrai', icon: CheckCircle, color: '#4ADE80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
            { val: 'Faux', icon: XCircle,    color: '#F87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
          ].map(({ val, icon: Icon, color, bg, border }) => {
            const isCorrect = revealed && question.reponse?.toLowerCase() === val.toLowerCase()
            return (
              <div key={val}
                className="flex items-center gap-3 rounded-xl px-8 py-5 text-2xl font-bold transition-all"
                style={{
                  background: isCorrect ? bg.replace('0.08', '0.18') : bg,
                  border: `2px solid ${isCorrect ? color : border}`,
                  color: isCorrect ? color : '#9090A0',
                  transform: isCorrect ? 'scale(1.05)' : 'none',
                }}>
                <Icon size={28} style={{ color }} />
                {val}
              </div>
            )
          })}
        </div>
      )}

      {question.type === 'IMAGE' && question.mediaUrl && (
        <div className="mt-4 flex justify-center">
          <img src={question.mediaUrl} alt="Question" className="max-h-72 rounded-xl object-contain" />
        </div>
      )}

      {question.type === 'AUDIO' && question.audioUrl && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-full px-5 py-3"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Volume2 size={18} style={{ color: '#818CF8' }} />
            <span className="text-sm font-medium" style={{ color: '#818CF8' }}>Audio en cours…</span>
          </div>
          <audio ref={audioRef} controls className="w-full max-w-sm" style={{ borderRadius: '8px' }}>
            <source src={question.audioUrl} />
          </audio>
        </div>
      )}

      {question.type === 'VIDEO' && question.videoUrl && (
        <div className="mt-4 flex justify-center">
          <div className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <iframe
              src={buildYouTubeEmbed(question.videoUrl, question.videoDebut, question.videoFin)}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Question vidéo"
            />
          </div>
        </div>
      )}

      {/* Revealed answer */}
      {revealed && showAnswer && question.reponse && (
        <div className="mt-6 rounded-xl px-5 py-4 animate-fadeUp"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4ADE80' }}>Réponse</p>
          <p className="text-xl font-bold" style={{ color: '#ECECF0' }}>{question.reponse}</p>
          {question.explication && (
            <p className="text-sm mt-2" style={{ color: '#9090A0' }}>{question.explication}</p>
          )}
        </div>
      )}
    </div>
  )
}

function buildYouTubeEmbed(url, start, end) {
  try {
    const u = new URL(url)
    let videoId = u.searchParams.get('v') ?? u.pathname.split('/').pop()
    let embed = `https://www.youtube.com/embed/${videoId}?autoplay=1`
    if (start) embed += `&start=${start}`
    if (end)   embed += `&end=${end}`
    return embed
  } catch {
    return url
  }
}
