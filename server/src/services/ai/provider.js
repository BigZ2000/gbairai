// ── FOURNISSEUR IA (Claude par l'API Anthropic) ───────────────────────────────
// Seul point du code qui parle au modèle. Mêmes principes que l'intégration
// SIREXE/ORIGINE (ADR 0037), adaptés à Node :
//   • clé lue dans l'environnement (jamais dans le dépôt) ; sans clé → désactivé ;
//   • sortie STRUCTURÉE imposée par schéma JSON (jamais de texte libre à parser) ;
//   • refus du modèle et pannes distingués par des erreurs typées ;
//   • consommation (jetons) et coût estimé rendus à l'appelant, qui journalise.
// L'interface { nom, modele, generer(demande) } permet d'injecter un autre
// fournisseur (tests) sans toucher aux garde-fous, qui restent côté serveur.
import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'

/** Le modèle a décliné la demande : rien n'est inventé à sa place. */
export class IaRefus extends Error {}

/** Fournisseur indisponible ; `reessayable` pour une erreur passagère. */
export class IaIndisponible extends Error {
  constructor(message, reessayable = false) { super(message); this.reessayable = reessayable }
}

// Tarifs de référence en dollars par million de jetons (entrée, sortie) pour
// l'ESTIMATION du coût journalisé. À tenir à jour avec la grille Anthropic.
const TARIFS_USD_MTOK = {
  'claude-opus-5-5':   [4.0, 20.0],
  'claude-sonnet-5-5': [2.0, 10.0],
  'claude-haiku-5-5':  [0.1, 0.5],
}

export function coutEstimeUsd(modele, jetonsEntree, jetonsSortie) {
  const [e, s] = TARIFS_USD_MTOK[modele] ?? TARIFS_USD_MTOK['claude-opus-5-5']
  return (jetonsEntree * e + jetonsSortie * s) / 1e6
}

class FournisseurClaude {
  constructor({ cle, modele }) {
    // Délai 4 min (une génération complète tient en un appel) ; 1 reprise SDK
    // sur 408/429/5xx et erreurs réseau.
    this.client = new Anthropic({ apiKey: cle, timeout: 240_000, maxRetries: 1 })
    this.modele = modele
    this.nom = 'anthropic'
  }

  /**
   * @param {{ consignes: string, message: string, schema: object, maxJetons?: number }} d
   * @returns {Promise<{ sortie: object, jetonsEntree: number, jetonsSortie: number, coutEstimeUsd: number, modele: string }>}
   */
  async generer({ consignes, message, schema, maxJetons = 20000 }) {
    let r
    try {
      r = await this.client.beta.messages.parse({
        model: this.modele,
        max_tokens: maxJetons,
        system: consignes,
        messages: [{ role: 'user', content: message }],
        output_config: { format: jsonSchemaOutputFormat(schema) },
        // Repli côté serveur si le modèle demandé décline pour raison de
        // politique (sans effet sur un modèle qui ne le prend pas en charge).
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      })
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new IaIndisponible('Limite de débit du fournisseur atteinte', true)
      if (e instanceof Anthropic.AuthenticationError) throw new IaIndisponible('Clé d\'API refusée par le fournisseur', false)
      if (e instanceof Anthropic.APIConnectionError) throw new IaIndisponible('Fournisseur injoignable', true)
      if (e instanceof Anthropic.APIError) throw new IaIndisponible(`Le fournisseur a renvoyé une erreur (${e.status ?? '?'})`, (e.status ?? 0) >= 500)
      throw new IaIndisponible(e?.message ?? 'Réponse illisible', false)
    }

    const jetonsEntree = r.usage?.input_tokens ?? 0
    const jetonsSortie = r.usage?.output_tokens ?? 0
    const modele = r.model ?? this.modele
    const conso = { jetonsEntree, jetonsSortie, modele, coutEstimeUsd: coutEstimeUsd(modele, jetonsEntree, jetonsSortie) }

    if (r.stop_reason === 'refusal') {
      const err = new IaRefus('Le modèle a décliné cette demande'); err.conso = conso; throw err
    }
    if (r.stop_reason === 'max_tokens' || !r.parsed_output) {
      const err = new IaIndisponible(r.stop_reason === 'max_tokens' ? 'Réponse tronquée' : 'Réponse vide', false)
      err.conso = conso; throw err
    }
    return { sortie: r.parsed_output, ...conso }
  }
}

// ── Résolution du fournisseur ────────────────────────────────────────────────
let _injecte   // fournisseur injecté (tests uniquement)
let _instance

/** Fournisseur actif, ou null si la génération IA n'est pas configurée. */
export function getFournisseur() {
  if (_injecte !== undefined) return _injecte
  const cle = process.env.ANTHROPIC_API_KEY
  if (!cle) return null
  if (!_instance) _instance = new FournisseurClaude({ cle, modele: process.env.IA_MODELE || 'claude-haiku-5-5' })
  return _instance
}

/** Tests : remplace (ou retire avec `undefined`) le fournisseur. Jamais appelé en exploitation. */
export function setFournisseurPourTests(f) { _injecte = f }
