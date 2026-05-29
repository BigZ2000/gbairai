import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { LayoutDashboard, HelpCircle, Tag, Upload, Users, BarChart2, LogOut, ChevronRight } from 'lucide-react'

const NAV = [
  { to: '/admin',            icon: BarChart2,     label: 'Statistiques', exact: true },
  { to: '/admin/questions',  icon: HelpCircle,    label: 'Questions' },
  { to: '/admin/categories', icon: Tag,           label: 'Catégories' },
  { to: '/admin/import',     icon: Upload,        label: 'Import CSV' },
  { to: '/admin/users',      icon: Users,         label: 'Utilisateurs' },
]

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="min-h-screen flex" style={{ background: '#0E0E12' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0"
        style={{ background: '#141418', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-5 flex items-center gap-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white"
            style={{ background: '#EF4444' }}>A</div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#ECECF0' }}>Admin</p>
            <p className="text-2xs" style={{ color: '#5A5A6E' }}>Gbairai</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Link key={to} to={to}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? 'rgba(239,68,68,0.1)' : 'transparent',
                  color: active ? '#F87171' : '#9090A0',
                }}>
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Link to="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-sm transition-all"
            style={{ color: '#5A5A6E' }}>
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: '#5A5A6E' }}>
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
