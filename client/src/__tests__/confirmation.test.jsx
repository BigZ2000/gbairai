import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const apiFetch = vi.fn()
const setUser = vi.fn()
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ apiFetch, setUser, user: { prenom: 'Ali' } }) }))
// La page s'affiche dans le gabarit de l'application : inutile ici.
vi.mock('../components/Layout.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
const { default: Confirmation } = await import('../pages/Confirmation.jsx')

const rep = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
const monter = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/abonnement/confirmation" element={<Confirmation />} /></Routes>
  </MemoryRouter>,
)

describe('retour de paiement', () => {
  beforeEach(() => { apiFetch.mockReset(); setUser.mockReset() })

  it('affiche « réglé » seulement quand le serveur confirme, et met le plan à jour', async () => {
    apiFetch.mockImplementation((url) => url.startsWith('/billing/paiements/')
      ? rep(200, { reference: 'GBR-1', statut: 'SUCCESS', montant: 5000, description: 'Pass Premium (30 jours)' })
      : rep(200, { plan: 'PRO' }))
    monter('/abonnement/confirmation?ref=GBR-1')
    expect(await screen.findByText("C'est réglé !")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/billing/paiements/GBR-1')
    await vi.waitFor(() => expect(setUser).toHaveBeenCalled())
  })

  it('paiement en attente : invite à valider sur le téléphone', async () => {
    apiFetch.mockImplementation(() => rep(200, { reference: 'GBR-2', statut: 'PENDING', montant: 5000 }))
    monter('/abonnement/confirmation?ref=GBR-2')
    expect(await screen.findByText('Paiement en cours de confirmation')).toBeInTheDocument()
    expect(screen.queryByText("C'est réglé !")).not.toBeInTheDocument()
  })

  it('paiement refusé : rien n\'est présenté comme actif', async () => {
    apiFetch.mockImplementation(() => rep(200, { reference: 'GBR-3', statut: 'FAILED', montant: 5000 }))
    monter('/abonnement/confirmation?ref=GBR-3')
    expect(await screen.findByText('Paiement non abouti')).toBeInTheDocument()
    expect(setUser).not.toHaveBeenCalled()
  })

  it('arrivée sans référence : « introuvable », aucun appel', () => {
    monter('/abonnement/confirmation')
    expect(screen.getByText('Paiement introuvable')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
