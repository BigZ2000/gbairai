import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Faux AuthContext : on observe les appels à l'API, sans serveur.
const apiFetch = vi.fn()
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ apiFetch }) }))
const { default: LaunchSheet } = await import('../components/LaunchSheet.jsx')

const pack = { id: 'pk1', nom: 'Actu CI', emoji: '🇨🇮', nbManches: 1, nbQuestions: 10, modeRecommande: 'auto' }
const rep = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

function monter(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LaunchSheet pack={pack} onClose={() => {}} {...props} />} />
        <Route path="/parties/:code/jeu" element={<p>Écran de jeu</p>} />
        <Route path="/parties/:code/attente" element={<p>Salle d'attente</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('feuille de lancement', () => {
  beforeEach(() => apiFetch.mockReset())

  it('seul : crée la partie solo puis la démarre aussitôt', async () => {
    apiFetch.mockImplementation((url) => url === '/packs/pk1/start' ? rep(201, { id: 'p1', code: 'ABC123' }) : rep(200, {}))
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Jouer seul/ }))
    await screen.findByText('Écran de jeu')
    expect(apiFetch).toHaveBeenNthCalledWith(1, '/packs/pk1/start', { method: 'POST', body: { gameMode: 'auto', modeDistanciel: true, solo: true } })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/parties/p1/start', { method: 'POST', body: {} })
  })

  it('à plusieurs, en 3 équipes, sur grand écran : ouvre la salle d\'attente', async () => {
    apiFetch.mockImplementation(() => rep(201, { id: 'p2', code: 'XYZ789' }))
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Jouer à plusieurs/ }))
    fireEvent.click(screen.getByRole('button', { name: /Un grand écran/ }))
    fireEvent.click(screen.getByRole('button', { name: '3 équipes' }))
    expect(screen.getByRole('button', { name: '3 équipes' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir la salle/ }))
    await screen.findByText("Salle d'attente")
    expect(apiFetch).toHaveBeenCalledWith('/packs/pk1/start', {
      method: 'POST',
      body: { gameMode: 'auto', modeDistanciel: false, animateurJoue: false, equipes: 3 },
    })
  })

  it('pack réservé ou quota atteint : la main passe à l\'appelant (offre Premium)', async () => {
    apiFetch.mockImplementation(() => rep(402, { code: 'QUOTA_PARTIES' }))
    const onBlocked = vi.fn()
    monter({ onBlocked })
    fireEvent.click(screen.getByRole('button', { name: /Jouer seul/ }))
    await waitFor(() => expect(onBlocked).toHaveBeenCalledWith({ code: 'QUOTA_PARTIES' }))
  })

  it('erreur serveur : message lisible, on reste sur la feuille', async () => {
    apiFetch.mockImplementation(() => rep(500, { error: 'Pack indisponible' }))
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Jouer seul/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pack indisponible')
  })
})
