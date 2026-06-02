import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Réserve une page aux comptes complets : un INVITÉ (participant éphémère) est
// renvoyé vers son écran minimal /invite (jamais le menu utilisateur).
export default function RequireAccount({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.isGuest) return <Navigate to="/invite" replace />
  return children
}
