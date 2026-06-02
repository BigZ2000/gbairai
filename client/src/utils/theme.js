// Thème clair/sombre — persistant en localStorage, applicable AVANT toute
// connexion (écran d'entrée, page de jonction, landing). La préférence de
// l'appareil prime ; à défaut on retombe sur le thème du compte, sinon « dark ».
const KEY = 'gbairai_theme'

export function storedTheme() {
  const t = localStorage.getItem(KEY)
  return t === 'light' || t === 'dark' ? t : null
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark'
}

export function applyTheme(t, persist = true) {
  const theme = t === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', theme)
  if (persist) localStorage.setItem(KEY, theme)
  return theme
}

// Au démarrage : applique la préférence appareil si elle existe (sinon dark).
export function initTheme() {
  applyTheme(storedTheme() ?? 'dark', false)
}

export function toggleTheme() {
  return applyTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}
