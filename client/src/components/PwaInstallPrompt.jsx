import React, { useState, useEffect } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

// Bannière d'installation PWA « Ajouter à l'écran d'accueil ».
//  • Android / Chrome : capte l'événement `beforeinstallprompt` → bouton natif.
//  • iOS / Safari : pas d'API → on affiche la marche à suivre (Partager → Ajouter).
//  • Masquée si l'app est déjà installée (mode standalone) ou déjà rejetée.
const DISMISS_KEY = 'gbairai_pwa_dismissed'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true // iOS
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    && !/crios|fxios/i.test(window.navigator.userAgent) // Safari iOS uniquement
}

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState(null) // événement Android
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch { /* stockage indispo */ }
    if (dismissed) return

    // Android / Chrome : l'événement arrive quand l'app est installable.
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari : aucun événement → on propose l'aide manuelle après un court délai.
    let t
    if (isIOS()) { t = setTimeout(() => setVisible(true), 1500) }

    function onInstalled() { setVisible(false) }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (t) clearTimeout(t)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') { setVisible(false); setDeferred(null) }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
      <div className="pointer-events-auto w-full max-w-md rounded-2xl p-4 flex items-center gap-3 animate-fadeUp"
        style={{ background: 'var(--surface, #1b1e28)', border: '1px solid var(--border, #2f3546)', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black"
          style={{ background: '#6366F1' }}>G</div>

        {iosHelp ? (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text, #eceef6)' }}>Installer sur iPhone</p>
            <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'var(--text-muted, #9aa0b6)' }}>
              Appuie sur <Share size={13} className="inline" /> puis <b>« Sur l'écran d'accueil »</b> <Plus size={12} className="inline" />
            </p>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text, #eceef6)' }}>Installer Gbairai</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted, #9aa0b6)' }}>
              Accès direct depuis l'écran d'accueil, comme une app.
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {deferred ? (
            <button onClick={install} className="btn-primary btn-sm gap-1.5">
              <Download size={14} />Installer
            </button>
          ) : !iosHelp ? (
            <button onClick={() => setIosHelp(true)} className="btn-primary btn-sm gap-1.5">
              <Download size={14} />Comment ?
            </button>
          ) : null}
          <button onClick={dismiss} className="btn-ghost btn-sm" aria-label="Fermer"><X size={15} /></button>
        </div>
      </div>
    </div>
  )
}
