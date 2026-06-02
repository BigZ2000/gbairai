import React, { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { currentTheme, toggleTheme } from '../utils/theme.js'

// Bouton de bascule clair/sombre — utilisable partout, même déconnecté.
export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(currentTheme() === 'dark')
  return (
    <button
      type="button"
      onClick={() => setDark(toggleTheme() === 'dark')}
      title={dark ? 'Passer en clair' : 'Passer en sombre'}
      aria-label="Changer de thème"
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${className}`}
      style={{ background: 'var(--hover-overlay, rgba(255,255,255,0.05))', color: 'var(--text-muted, #9090A0)' }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
