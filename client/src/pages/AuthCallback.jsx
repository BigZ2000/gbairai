import React, { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const { loginWithTokens } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const access = params.get('access')
    const refresh = params.get('refresh')
    const error = params.get('error')

    if (error || !access || !refresh) {
      navigate('/login?error=' + (error ?? 'oauth_failed'), { replace: true })
      return
    }

    loginWithTokens(access, refresh)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/login?error=oauth_failed', { replace: true }))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0E0E12' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
          style={{ background: '#6366F1' }}>G</div>
        <Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }} />
        <p className="text-sm" style={{ color: '#9090A0' }}>Connexion en cours…</p>
      </div>
    </div>
  )
}
