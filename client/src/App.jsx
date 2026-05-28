import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
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

export default function App() {
  return (
    <AuthProvider>
      <WsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/parties/new" element={<CreatePartie />} />
            <Route path="/parties/:partieCode/attente" element={<SalleAttente />} />
            <Route path="/parties/:partieCode/jeu" element={<AnimateurJeu />} />
            <Route path="/parties/:partieCode/ecran" element={<EcranPrincipal />} />
            <Route path="/compte" element={<MonCompte />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </WsProvider>
    </AuthProvider>
  )
}
