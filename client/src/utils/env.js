// Google OAuth ne fonctionne que sur localhost/127.0.0.1 (cas spécial Google)
// ou sur un domaine HTTPS. Sur un hôte LAN (.local / IP), Google refuse le
// redirect_uri → on masque le bouton et on oriente vers le pseudo / l'email.
export function googleAuthAvailable() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return window.location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1'
}
