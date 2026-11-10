// ── JEU PAR ÉQUIPES ───────────────────────────────────────────────────────────
// Une couche au-dessus du moteur, sans barème propre : chaque joueur marque
// comme d'habitude, le score d'une équipe est la SOMME des scores de ses
// membres. Les équipes sont décrites sur la partie (`Partie.equipes`, liste
// { nom, couleur }) et chaque joueur porte l'index de la sienne
// (`Participant.equipe`). L'animateur « maître du jeu » n'appartient à aucune.
import { prisma } from '../utils/prisma.js'

export const EQUIPES_MAX = 6

// Noms et couleurs par défaut : courts, lisibles de loin, sans ambiguïté.
export const EQUIPES_DEFAUT = [
  { nom: 'Soleil',  couleur: '#F26A1B' },
  { nom: 'Feuille', couleur: '#12995F' },
  { nom: 'Lagune',  couleur: '#0E7FC2' },
  { nom: 'Bissap',  couleur: '#B4235A' },
  { nom: 'Mangue',  couleur: '#D99A00' },
  { nom: 'Cacao',   couleur: '#7A4A2A' },
]

/**
 * Construit la liste des équipes à enregistrer sur une partie.
 * @param {number} nombre 0 (chacun pour soi) ou 2 à 6
 * @param {string[]} [noms] noms personnalisés (facultatifs, dans l'ordre)
 * @returns {Array<{nom: string, couleur: string}> | null}
 */
export function construireEquipes(nombre, noms = []) {
  const n = Math.min(EQUIPES_MAX, Math.max(0, Math.trunc(Number(nombre) || 0)))
  if (n < 2) return null
  return EQUIPES_DEFAUT.slice(0, n).map((e, i) => ({
    nom: String(noms[i] ?? '').trim().slice(0, 24) || e.nom,
    couleur: e.couleur,
  }))
}

/** Liste valide des équipes d'une partie (tolère un JSON inattendu). */
export function equipesDe(partie) {
  const eq = partie?.equipes
  return Array.isArray(eq) && eq.length >= 2 ? eq : null
}

/** Index de l'équipe la moins remplie (à égalité : la première). */
export function equipeLaMoinsRemplie(equipes, joueurs) {
  const effectifs = equipes.map(() => 0)
  for (const j of joueurs) if (Number.isInteger(j.equipe) && j.equipe < effectifs.length) effectifs[j.equipe]++
  let best = 0
  for (let i = 1; i < effectifs.length; i++) if (effectifs[i] < effectifs[best]) best = i
  return best
}

/** Équipe à attribuer à un nouveau joueur (null si la partie est sans équipes). */
export async function equipePourNouveauJoueur(partieId) {
  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { equipes: true } })
  const equipes = equipesDe(partie)
  if (!equipes) return null
  const joueurs = await prisma.participant.findMany({
    where: { partieId, isAnimateur: false }, select: { equipe: true },
  })
  return equipeLaMoinsRemplie(equipes, joueurs)
}

/**
 * Remet chaque joueur dans une équipe valide : appelé au lancement et quand le
 * nombre d'équipes change. Les joueurs déjà placés dans une équipe existante
 * gardent leur place ; les autres comblent les équipes les moins remplies.
 * Sans équipes, retire toute affectation.
 */
export async function repartirJoueurs(partieId) {
  const partie = await prisma.partie.findUnique({ where: { id: partieId }, select: { equipes: true } })
  const equipes = equipesDe(partie)
  const joueurs = await prisma.participant.findMany({
    where: { partieId }, orderBy: { joinedAt: 'asc' },
    select: { id: true, equipe: true, isAnimateur: true },
  })
  if (!equipes) {
    const places = joueurs.filter(j => j.equipe != null).map(j => j.id)
    if (places.length) await prisma.participant.updateMany({ where: { id: { in: places } }, data: { equipe: null } })
    return
  }
  const valides = []
  const aPlacer = []
  for (const j of joueurs) {
    if (j.isAnimateur) {
      if (j.equipe != null) await prisma.participant.update({ where: { id: j.id }, data: { equipe: null } })
      continue
    }
    if (Number.isInteger(j.equipe) && j.equipe >= 0 && j.equipe < equipes.length) valides.push(j)
    else aPlacer.push(j)
  }
  for (const j of aPlacer) {
    const e = equipeLaMoinsRemplie(equipes, valides)
    await prisma.participant.update({ where: { id: j.id }, data: { equipe: e } })
    valides.push({ ...j, equipe: e })
  }
}

/**
 * Classement des équipes. Score = somme des scores des membres ; à égalité,
 * l'équipe la plus petite passe devant (elle a marqué autant avec moins de bras).
 * @param {Array<{nom, couleur}>} equipes
 * @param {Array<{equipe: number|null, score: number, isAnimateur?: boolean}>} joueurs
 */
export function classementEquipes(equipes, joueurs) {
  if (!equipes) return null
  const lignes = equipes.map((e, index) => ({ index, nom: e.nom, couleur: e.couleur, score: 0, membres: 0 }))
  for (const j of joueurs) {
    if (j.isAnimateur) continue
    const l = lignes[j.equipe]
    if (!l) continue
    l.score += j.score ?? 0
    l.membres++
  }
  lignes.sort((a, b) => b.score - a.score || a.membres - b.membres || a.index - b.index)
  return lignes.map((l, i) => ({ ...l, rang: i + 1 }))
}
