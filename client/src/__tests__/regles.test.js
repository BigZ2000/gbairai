import { describe, it, expect, beforeEach } from 'vitest'
import { answersMatchClient } from '../pages/JoueurJeu.jsx'
import { flattenManches } from '../utils/manches.js'
import { applyTheme, currentTheme } from '../utils/theme.js'

describe('réponse libre côté joueur (même règle que le serveur)', () => {
  it.each([
    ['Attiéké', 'attieke', true],          // casse et accents
    ['cacoa', 'Cacao', true],               // deux lettres inversées
    ['Abidjn', 'Abidjan', true],            // une lettre oubliée
    ['Côte d\'Ivoire', 'La Côte d\'Ivoire', true],
    ['Mali', 'Malien', false],              // inclusion trop courte
    ['a', 'Abidjan', false],                // garde-fou 3 lettres
    ['Ghana', 'Togo', false],
  ])('« %s » contre « %s » → %s', (j, r, attendu) => {
    expect(answersMatchClient(j, r)).toBe(attendu)
  })
})

describe('déroulé des manches', () => {
  it('met les questions à plat dans l\'ordre des manches puis des questions', () => {
    const q = flattenManches([
      { id: 'm2', ordre: 2, nom: 'B', mancheQuestions: [{ ordre: 1, question: { id: 'q3' } }] },
      { id: 'm1', ordre: 1, nom: 'A', mancheQuestions: [{ ordre: 2, question: { id: 'q2' } }, { ordre: 1, question: { id: 'q1' } }] },
    ])
    expect(q.map(x => x.id)).toEqual(['q1', 'q2', 'q3'])
  })
})

describe('thème', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })
  it('clair par défaut, sombre sur demande et mémorisé', () => {
    expect(currentTheme()).toBe('light')
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(currentTheme()).toBe('dark')
  })
})
