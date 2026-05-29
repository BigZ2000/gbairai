import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { HelpCircle, Users, Tag, Gamepad2 } from 'lucide-react'

export default function AdminStats() {
  const { apiFetch } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiFetch('/admin/stats').then(r => r?.json()).then(d => { if (d) setStats(d) })
  }, [])

  const cards = stats ? [
    { label: 'Utilisateurs',  value: stats.users,      icon: Users,     color: '#818CF8' },
    { label: 'Questions',     value: stats.questions,   icon: HelpCircle, color: '#4ADE80' },
    { label: 'Parties',       value: stats.parties,     icon: Gamepad2,  color: '#FCD34D' },
    { label: 'Catégories',    value: stats.categories,  icon: Tag,       color: '#F87171' },
  ] : []

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-8" style={{ color: '#ECECF0' }}>Statistiques</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="card p-6">
            <c.icon size={22} style={{ color: c.color }} className="mb-3" />
            <p className="text-3xl font-black mb-1" style={{ color: '#ECECF0' }}>{c.value}</p>
            <p className="text-sm" style={{ color: '#5A5A6E' }}>{c.label}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
