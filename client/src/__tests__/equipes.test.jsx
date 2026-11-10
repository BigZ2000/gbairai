import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassementEquipes, PastilleEquipe, classementLocal, equipeDe } from '../components/Equipes.jsx'

const partie = { equipes: [{ nom: 'Soleil', couleur: '#F26A1B' }, { nom: 'Feuille', couleur: '#12995F' }] }

describe('équipes', () => {
  it('retrouve l\'équipe d\'un joueur, et aucune sans équipes', () => {
    expect(equipeDe(partie, { equipe: 1 })).toMatchObject({ nom: 'Feuille', index: 1 })
    expect(equipeDe(partie, { equipe: null })).toBeNull()
    expect(equipeDe({ equipes: null }, { equipe: 0 })).toBeNull()
  })

  it('classe localement : somme des scores, maître du jeu exclu, petite équipe devant à égalité', () => {
    const c = classementLocal(partie, [
      { equipe: 0, score: 50 }, { equipe: 0, score: 50 },
      { equipe: 1, score: 100 },
      { equipe: null, score: 900, isAnimateur: true },
    ])
    expect(c.map(e => [e.nom, e.score, e.membres, e.rang])).toEqual([['Feuille', 100, 1, 1], ['Soleil', 100, 2, 2]])
    expect(classementLocal({ equipes: [{ nom: 'Seule', couleur: '#000' }] }, [])).toBeNull()
  })

  it('affiche le classement et signale l\'équipe du joueur', () => {
    const equipes = classementLocal(partie, [{ equipe: 0, score: 300 }, { equipe: 1, score: 120 }])
    render(<ClassementEquipes equipes={equipes} maEquipe={1} />)
    expect(screen.getByText('Soleil')).toBeInTheDocument()
    expect(screen.getByText('ton équipe')).toBeInTheDocument()
    // Feuille (2e) porte la mention « ton équipe », pas Soleil (1re).
    expect(screen.getByText('ton équipe').parentElement.textContent).toContain('Feuille')
  })

  it('n\'affiche rien sans équipes', () => {
    const { container } = render(<ClassementEquipes equipes={null} />)
    expect(container).toBeEmptyDOMElement()
    expect(render(<PastilleEquipe equipe={null} />).container).toBeEmptyDOMElement()
  })
})
