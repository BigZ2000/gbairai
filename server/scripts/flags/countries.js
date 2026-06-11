// ──────────────────────────────────────────────────────────────────────────────
// Table des pays/territoires (ISO 3166-1 alpha-2) → nom FR + continent.
// Source de vérité pour le générateur du pack « Drapeaux du Monde » (W2560/).
// Continents : AF Afrique · EU Europe · AS Asie · AM Amérique · OC Océanie · AN territoires.
// ──────────────────────────────────────────────────────────────────────────────

export const CONTINENTS = {
  AF: { nom: 'Afrique',   tag: 'afrique' },
  EU: { nom: 'Europe',    tag: 'europe' },
  AS: { nom: 'Asie',      tag: 'asie' },
  AM: { nom: 'Amérique',  tag: 'amerique' },
  OC: { nom: 'Océanie',   tag: 'oceanie' },
  AN: { nom: 'Territoires', tag: 'territoires' },
}

// code → [nom FR, continent]
export const COUNTRIES = {
  ad: ['Andorre', 'EU'], ae: ['Émirats arabes unis', 'AS'], af: ['Afghanistan', 'AS'],
  ag: ['Antigua-et-Barbuda', 'AM'], ai: ['Anguilla', 'AM'], al: ['Albanie', 'EU'],
  am: ['Arménie', 'AS'], ao: ['Angola', 'AF'], aq: ['Antarctique', 'AN'], ar: ['Argentine', 'AM'],
  as: ['Samoa américaines', 'OC'], at: ['Autriche', 'EU'], au: ['Australie', 'OC'],
  aw: ['Aruba', 'AM'], ax: ['Îles Åland', 'EU'], az: ['Azerbaïdjan', 'AS'],
  ba: ['Bosnie-Herzégovine', 'EU'], bb: ['Barbade', 'AM'], bd: ['Bangladesh', 'AS'],
  be: ['Belgique', 'EU'], bf: ['Burkina Faso', 'AF'], bg: ['Bulgarie', 'EU'], bh: ['Bahreïn', 'AS'],
  bi: ['Burundi', 'AF'], bj: ['Bénin', 'AF'], bl: ['Saint-Barthélemy', 'AM'], bm: ['Bermudes', 'AM'],
  bn: ['Brunei', 'AS'], bo: ['Bolivie', 'AM'], bq: ['Pays-Bas caribéens', 'AM'], br: ['Brésil', 'AM'],
  bs: ['Bahamas', 'AM'], bt: ['Bhoutan', 'AS'], bv: ['Île Bouvet', 'AN'], bw: ['Botswana', 'AF'],
  by: ['Biélorussie', 'EU'], bz: ['Belize', 'AM'], ca: ['Canada', 'AM'], cc: ['Îles Cocos', 'OC'],
  cd: ['République démocratique du Congo', 'AF'], cf: ['République centrafricaine', 'AF'],
  cg: ['République du Congo', 'AF'], ch: ['Suisse', 'EU'], ci: ["Côte d'Ivoire", 'AF'],
  ck: ['Îles Cook', 'OC'], cl: ['Chili', 'AM'], cm: ['Cameroun', 'AF'], cn: ['Chine', 'AS'],
  co: ['Colombie', 'AM'], cr: ['Costa Rica', 'AM'], cu: ['Cuba', 'AM'], cv: ['Cap-Vert', 'AF'],
  cw: ['Curaçao', 'AM'], cx: ['Île Christmas', 'OC'], cy: ['Chypre', 'EU'], cz: ['Tchéquie', 'EU'],
  de: ['Allemagne', 'EU'], dj: ['Djibouti', 'AF'], dk: ['Danemark', 'EU'], dm: ['Dominique', 'AM'],
  do: ['République dominicaine', 'AM'], dz: ['Algérie', 'AF'], ec: ['Équateur', 'AM'],
  ee: ['Estonie', 'EU'], eg: ['Égypte', 'AF'], eh: ['Sahara occidental', 'AF'], er: ['Érythrée', 'AF'],
  es: ['Espagne', 'EU'], et: ['Éthiopie', 'AF'], fi: ['Finlande', 'EU'], fj: ['Fidji', 'OC'],
  fk: ['Îles Malouines', 'AM'], fm: ['Micronésie', 'OC'], fo: ['Îles Féroé', 'EU'], fr: ['France', 'EU'],
  ga: ['Gabon', 'AF'], gb: ['Royaume-Uni', 'EU'], 'gb-eng': ['Angleterre', 'EU'],
  'gb-nir': ['Irlande du Nord', 'EU'], 'gb-sct': ['Écosse', 'EU'], 'gb-wls': ['Pays de Galles', 'EU'],
  gd: ['Grenade', 'AM'], ge: ['Géorgie', 'AS'], gf: ['Guyane française', 'AM'], gg: ['Guernesey', 'EU'],
  gh: ['Ghana', 'AF'], gi: ['Gibraltar', 'EU'], gl: ['Groenland', 'AM'], gm: ['Gambie', 'AF'],
  gn: ['Guinée', 'AF'], gp: ['Guadeloupe', 'AM'], gq: ['Guinée équatoriale', 'AF'], gr: ['Grèce', 'EU'],
  gs: ['Géorgie du Sud', 'AN'], gt: ['Guatemala', 'AM'], gu: ['Guam', 'OC'], gw: ['Guinée-Bissau', 'AF'],
  gy: ['Guyana', 'AM'], hk: ['Hong Kong', 'AS'], hm: ['Îles Heard-et-MacDonald', 'AN'],
  hn: ['Honduras', 'AM'], hr: ['Croatie', 'EU'], ht: ['Haïti', 'AM'], hu: ['Hongrie', 'EU'],
  id: ['Indonésie', 'AS'], ie: ['Irlande', 'EU'], il: ['Israël', 'AS'], im: ['Île de Man', 'EU'],
  in: ['Inde', 'AS'], io: ["Territoire britannique de l'océan Indien", 'AS'], iq: ['Irak', 'AS'],
  ir: ['Iran', 'AS'], is: ['Islande', 'EU'], it: ['Italie', 'EU'], je: ['Jersey', 'EU'],
  jm: ['Jamaïque', 'AM'], jo: ['Jordanie', 'AS'], jp: ['Japon', 'AS'], ke: ['Kenya', 'AF'],
  kg: ['Kirghizistan', 'AS'], kh: ['Cambodge', 'AS'], ki: ['Kiribati', 'OC'], km: ['Comores', 'AF'],
  kn: ['Saint-Christophe-et-Niévès', 'AM'], kp: ['Corée du Nord', 'AS'], kr: ['Corée du Sud', 'AS'],
  kw: ['Koweït', 'AS'], ky: ['Îles Caïmans', 'AM'], kz: ['Kazakhstan', 'AS'], la: ['Laos', 'AS'],
  lb: ['Liban', 'AS'], lc: ['Sainte-Lucie', 'AM'], li: ['Liechtenstein', 'EU'], lk: ['Sri Lanka', 'AS'],
  lr: ['Libéria', 'AF'], ls: ['Lesotho', 'AF'], lt: ['Lituanie', 'EU'], lu: ['Luxembourg', 'EU'],
  lv: ['Lettonie', 'EU'], ly: ['Libye', 'AF'], ma: ['Maroc', 'AF'], mc: ['Monaco', 'EU'],
  md: ['Moldavie', 'EU'], me: ['Monténégro', 'EU'], mf: ['Saint-Martin', 'AM'], mg: ['Madagascar', 'AF'],
  mh: ['Îles Marshall', 'OC'], mk: ['Macédoine du Nord', 'EU'], ml: ['Mali', 'AF'],
  mm: ['Birmanie (Myanmar)', 'AS'], mn: ['Mongolie', 'AS'], mo: ['Macao', 'AS'],
  mp: ['Îles Mariannes du Nord', 'OC'], mq: ['Martinique', 'AM'], mr: ['Mauritanie', 'AF'],
  ms: ['Montserrat', 'AM'], mt: ['Malte', 'EU'], mu: ['Maurice', 'AF'], mv: ['Maldives', 'AS'],
  mw: ['Malawi', 'AF'], mx: ['Mexique', 'AM'], my: ['Malaisie', 'AS'], mz: ['Mozambique', 'AF'],
  na: ['Namibie', 'AF'], nc: ['Nouvelle-Calédonie', 'OC'], ne: ['Niger', 'AF'], nf: ['Île Norfolk', 'OC'],
  ng: ['Nigeria', 'AF'], ni: ['Nicaragua', 'AM'], nl: ['Pays-Bas', 'EU'], no: ['Norvège', 'EU'],
  np: ['Népal', 'AS'], nr: ['Nauru', 'OC'], nu: ['Niue', 'OC'], nz: ['Nouvelle-Zélande', 'OC'],
  om: ['Oman', 'AS'], pa: ['Panama', 'AM'], pe: ['Pérou', 'AM'], pf: ['Polynésie française', 'OC'],
  pg: ['Papouasie-Nouvelle-Guinée', 'OC'], ph: ['Philippines', 'AS'], pk: ['Pakistan', 'AS'],
  pl: ['Pologne', 'EU'], pm: ['Saint-Pierre-et-Miquelon', 'AM'], pn: ['Îles Pitcairn', 'OC'],
  pr: ['Porto Rico', 'AM'], ps: ['Palestine', 'AS'], pt: ['Portugal', 'EU'], pw: ['Palaos', 'OC'],
  py: ['Paraguay', 'AM'], qa: ['Qatar', 'AS'], re: ['La Réunion', 'AF'], ro: ['Roumanie', 'EU'],
  rs: ['Serbie', 'EU'], ru: ['Russie', 'EU'], rw: ['Rwanda', 'AF'], sa: ['Arabie saoudite', 'AS'],
  sb: ['Îles Salomon', 'OC'], sc: ['Seychelles', 'AF'], sd: ['Soudan', 'AF'], se: ['Suède', 'EU'],
  sg: ['Singapour', 'AS'], sh: ['Sainte-Hélène', 'AF'], si: ['Slovénie', 'EU'],
  sj: ['Svalbard et Jan Mayen', 'EU'], sk: ['Slovaquie', 'EU'], sl: ['Sierra Leone', 'AF'],
  sm: ['Saint-Marin', 'EU'], sn: ['Sénégal', 'AF'], so: ['Somalie', 'AF'], sr: ['Suriname', 'AM'],
  ss: ['Soudan du Sud', 'AF'], st: ['Sao Tomé-et-Principe', 'AF'], sv: ['Salvador', 'AM'],
  sx: ['Saint-Martin (Sint Maarten)', 'AM'], sy: ['Syrie', 'AS'], sz: ['Eswatini', 'AF'],
  tc: ['Îles Turques-et-Caïques', 'AM'], td: ['Tchad', 'AF'],
  tf: ['Terres australes et antarctiques françaises', 'AN'], tg: ['Togo', 'AF'], th: ['Thaïlande', 'AS'],
  tj: ['Tadjikistan', 'AS'], tk: ['Tokelau', 'OC'], tl: ['Timor oriental', 'AS'],
  tm: ['Turkménistan', 'AS'], tn: ['Tunisie', 'AF'], to: ['Tonga', 'OC'], tr: ['Turquie', 'AS'],
  tt: ['Trinité-et-Tobago', 'AM'], tv: ['Tuvalu', 'OC'], tw: ['Taïwan', 'AS'], tz: ['Tanzanie', 'AF'],
  ua: ['Ukraine', 'EU'], ug: ['Ouganda', 'AF'], um: ['Îles mineures des États-Unis', 'OC'],
  us: ['États-Unis', 'AM'], uy: ['Uruguay', 'AM'], uz: ['Ouzbékistan', 'AS'], va: ['Vatican', 'EU'],
  vc: ['Saint-Vincent-et-les-Grenadines', 'AM'], ve: ['Venezuela', 'AM'], vg: ['Îles Vierges britanniques', 'AM'],
  vi: ['Îles Vierges américaines', 'AM'], vn: ['Viêt Nam', 'AS'], vu: ['Vanuatu', 'OC'],
  wf: ['Wallis-et-Futuna', 'OC'], ws: ['Samoa', 'OC'], xk: ['Kosovo', 'EU'], ye: ['Yémen', 'AS'],
  yt: ['Mayotte', 'AF'], za: ['Afrique du Sud', 'AF'], zm: ['Zambie', 'AF'], zw: ['Zimbabwe', 'AF'],
}

// ── Groupes politiques (tags transverses → sous-packs) ───────────────────────
export const GROUPES = {
  cedeao:       ['bj', 'bf', 'cv', 'ci', 'gm', 'gh', 'gn', 'gw', 'lr', 'ml', 'ne', 'ng', 'sn', 'sl', 'tg'],
  uemoa:        ['bj', 'bf', 'ci', 'gw', 'ml', 'ne', 'sn', 'tg'],
  g20:          ['ar', 'au', 'br', 'ca', 'cn', 'fr', 'de', 'in', 'id', 'it', 'jp', 'kr', 'mx', 'ru', 'sa', 'za', 'tr', 'gb', 'us'],
  // Francophonie : pays où le français est langue officielle/co-officielle (+ territoires FR).
  francophonie: ['fr', 'mc', 'lu', 'be', 'ch', 'ci', 'sn', 'ml', 'bf', 'ne', 'tg', 'bj', 'gn', 'cd', 'cg',
                 'ga', 'cm', 'td', 'cf', 'dj', 'km', 'mg', 'sc', 'ht', 'gq', 'bi', 'rw', 'ca', 'vu',
                 'gp', 'mq', 'gf', 're', 'yt', 'nc', 'pf', 'wf', 'bl', 'mf', 'pm'],
}

// ── Difficulté indicative ────────────────────────────────────────────────────
const FACILE = new Set(['fr', 'us', 'gb', 'de', 'it', 'es', 'pt', 'be', 'nl', 'ch', 'ca', 'br', 'ar',
  'mx', 'jp', 'cn', 'in', 'ru', 'au', 'za', 'ng', 'ci', 'sn', 'gh', 'ma', 'dz', 'eg', 'sa', 'kr', 'tr', 'gr', 'se', 'no'])
const DIFFICILE = new Set(['aq', 'bv', 'hm', 'gs', 'tf', 'um', 'io', 'cc', 'cx', 'nf', 'tk', 'nu', 'pn',
  'sh', 'sj', 'wf', 'bl', 'mf', 'pm', 'ms', 'ai', 'vg', 'vi', 'ky', 'tc', 'fk', 'gi', 'fo', 'ax', 'gg',
  'je', 'im', 'bq', 'cw', 'sx', 'aw', 'as', 'gu', 'mp', 'um', 'eh'])

export function difficulteOf(code) {
  if (FACILE.has(code)) return 'FACILE'
  if (DIFFICILE.has(code)) return 'DIFFICILE'
  return 'MOYEN'
}

// Slug « parlant » à partir d'un libellé (accents/apostrophes → tirets).
// Ex. "Côte d'Ivoire" → "cote-d-ivoire", "États-Unis" → "etats-unis".
export function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Tags d'un pays : drapeaux + continent + groupes d'appartenance.
export function tagsOf(code) {
  const cont = COUNTRIES[code]?.[1]
  const tags = ['drapeaux']
  if (cont && CONTINENTS[cont]) tags.push(CONTINENTS[cont].tag)
  for (const [g, list] of Object.entries(GROUPES)) if (list.includes(code)) tags.push(g)
  return tags
}
