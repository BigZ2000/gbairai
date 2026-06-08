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
import PartieJeu from './pages/PartieJeu.jsx'
import EcranPrincipal from './pages/EcranPrincipal.jsx'
import MonCompte from './pages/MonCompte.jsx'
import Historique from './pages/Historique.jsx'
import HistoriquePartie from './pages/HistoriquePartie.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import RegisterGoogle from './pages/RegisterGoogle.jsx'
import RejoindrePartie from './pages/RejoindrePartie.jsx'
import BuzzerGuide from './pages/BuzzerGuide.jsx'
import VerifierEmail from './pages/VerifierEmail.jsx'
import VerifierTelephone from './pages/VerifierTelephone.jsx'
import Landing from './pages/Landing.jsx'
import GuestHome from './pages/GuestHome.jsx'
import RequireAccount from './components/RequireAccount.jsx'
import Questions from './pages/Questions.jsx'
import AdminStats from './pages/admin/AdminStats.jsx'
import AdminQuestions from './pages/admin/AdminQuestions.jsx'
import AdminCategories from './pages/admin/AdminCategories.jsx'
import AdminImport from './pages/admin/AdminImport.jsx'
import AdminMedia from './pages/admin/AdminMedia.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminSettings from './pages/admin/AdminSettings.jsx'
import AdminPacks from './pages/admin/AdminPacks.jsx'
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx'
import AdminOffres from './pages/admin/AdminOffres.jsx'
import AdminBuzzers from './pages/admin/AdminBuzzers.jsx'
import Abonnements from './pages/Abonnements.jsx'
import Checkout from './pages/Checkout.jsx'
import Confirmation from './pages/Confirmation.jsx'
import Paiements from './pages/Paiements.jsx'
import MonOrganisation from './pages/MonOrganisation.jsx'
import InvitationAccept from './pages/InvitationAccept.jsx'

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
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/google" element={<RegisterGoogle />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Jonction publique (cible du QR / lien d'invitation à une partie). */}
          <Route path="/rejoindre/:code" element={<RejoindrePartie />} />
          {/* Guide buzzers — public (cible du QR imprimé sous le boîtier). */}
          <Route path="/buzzer" element={<BuzzerGuide />} />
          {/* Vérification d'email — publique (le lien du mail peut être ouvert
              sur un appareil non connecté ; le jeton suffit). */}
          <Route path="/verifier-email" element={<VerifierEmail />} />
          <Route path="/verifier-telephone" element={<VerifierTelephone />} />

          <Route element={<ProtectedRoute />}>
            {/* Écran « maison » de l'invité (participant éphémère). */}
            <Route path="/invite" element={<GuestHome />} />

            {/* Écrans de JEU — accessibles aux invités. */}
            <Route path="/parties/:partieCode/attente" element={<SalleAttente />} />
            <Route path="/parties/:partieCode/jeu" element={<PartieJeu />} />
            <Route path="/parties/:partieCode/ecran" element={<EcranPrincipal />} />
            <Route path="/screen/:partieCode" element={<EcranPrincipal />} />
            <Route path="/projector/:partieCode" element={<EcranPrincipal />} />
            <Route path="/invitation/:token" element={<InvitationAccept />} />

            {/* Écrans UTILISATEUR — interdits aux invités (→ /invite). */}
            <Route path="/dashboard" element={<RequireAccount><Dashboard /></RequireAccount>} />
            <Route path="/parties/new" element={<RequireAccount><CreatePartie /></RequireAccount>} />
            <Route path="/compte" element={<RequireAccount><MonCompte /></RequireAccount>} />
            {/* Offres : consultables aussi par les invités (lecture seule + CTA création). */}
            <Route path="/abonnement" element={<Abonnements />} />
            <Route path="/abonnement/checkout" element={<RequireAccount><Checkout /></RequireAccount>} />
            <Route path="/abonnement/confirmation" element={<RequireAccount><Confirmation /></RequireAccount>} />
            <Route path="/paiements" element={<RequireAccount><Paiements /></RequireAccount>} />
            <Route path="/organisation" element={<RequireAccount><MonOrganisation /></RequireAccount>} />
            <Route path="/historique" element={<RequireAccount><Historique /></RequireAccount>} />
            <Route path="/historique/:id" element={<RequireAccount><HistoriquePartie /></RequireAccount>} />
          </Route>

          <Route path="/questions" element={<AdminRoute><Questions /></AdminRoute>} />

          <Route path="/admin" element={<AdminRoute><AdminStats /></AdminRoute>} />
          <Route path="/admin/packs"      element={<AdminRoute><AdminPacks /></AdminRoute>} />
          <Route path="/admin/analytics"  element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
          <Route path="/admin/offres"     element={<AdminRoute><AdminOffres /></AdminRoute>} />
          <Route path="/admin/buzzers"    element={<AdminRoute><AdminBuzzers /></AdminRoute>} />
          <Route path="/admin/questions"  element={<AdminRoute><AdminQuestions /></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
          <Route path="/admin/media"      element={<AdminRoute><AdminMedia /></AdminRoute>} />
          <Route path="/admin/import"     element={<AdminRoute><AdminImport /></AdminRoute>} />
          <Route path="/admin/users"      element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/reglages"   element={<AdminRoute><AdminSettings /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </WsProvider>
    </AuthProvider>
  )
}
