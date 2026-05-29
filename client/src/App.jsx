import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { WsProvider } from './context/WsContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CreatePartie from './pages/CreatePartie.jsx'
import SalleAttente from './pages/SalleAttente.jsx'
import AnimateurJeu from './pages/AnimateurJeu.jsx'
import EcranPrincipal from './pages/EcranPrincipal.jsx'
import MonCompte from './pages/MonCompte.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import RegisterGoogle from './pages/RegisterGoogle.jsx'
import Questions from './pages/Questions.jsx'
import AdminStats from './pages/admin/AdminStats.jsx'
import AdminQuestions from './pages/admin/AdminQuestions.jsx'
import AdminCategories from './pages/admin/AdminCategories.jsx'
import AdminImport from './pages/admin/AdminImport.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <WsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/google" element={<RegisterGoogle />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/parties/new" element={<CreatePartie />} />
            <Route path="/parties/:partieCode/attente" element={<SalleAttente />} />
            <Route path="/parties/:partieCode/jeu" element={<AnimateurJeu />} />
            <Route path="/parties/:partieCode/ecran" element={<EcranPrincipal />} />
            <Route path="/compte" element={<MonCompte />} />
            <Route path="/questions" element={<Questions />} />
          </Route>

          <Route path="/admin" element={<AdminRoute><AdminStats /></AdminRoute>} />
          <Route path="/admin/questions"  element={<AdminRoute><AdminQuestions /></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
          <Route path="/admin/import"     element={<AdminRoute><AdminImport /></AdminRoute>} />
          <Route path="/admin/users"      element={<AdminRoute><AdminUsers /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </WsProvider>
    </AuthProvider>
  )
}
