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

// ── Capitales (FR) — sous-ensemble fiable (États souverains principalement).
// Les codes absents ne génèrent pas de question « capitale ». ⚠️ quelques cas
// peuvent prêter à débat (capitales multiples) ; à ajuster si besoin.
export const CAPITALS = {
  ad: 'Andorre-la-Vieille', ae: 'Abou Dabi', af: 'Kaboul', ag: "Saint John's", al: 'Tirana',
  am: 'Erevan', ao: 'Luanda', ar: 'Buenos Aires', at: 'Vienne', au: 'Canberra', az: 'Bakou',
  ba: 'Sarajevo', bb: 'Bridgetown', bd: 'Dacca', be: 'Bruxelles', bf: 'Ouagadougou', bg: 'Sofia',
  bh: 'Manama', bi: 'Gitega', bj: 'Porto-Novo', bn: 'Bandar Seri Begawan', bo: 'Sucre',
  br: 'Brasília', bs: 'Nassau', bt: 'Thimphou', bw: 'Gaborone', by: 'Minsk', bz: 'Belmopan',
  ca: 'Ottawa', cd: 'Kinshasa', cf: 'Bangui', cg: 'Brazzaville', ch: 'Berne', ci: 'Yamoussoukro',
  cl: 'Santiago', cm: 'Yaoundé', cn: 'Pékin', co: 'Bogota', cr: 'San José', cu: 'La Havane',
  cv: 'Praia', cy: 'Nicosie', cz: 'Prague', de: 'Berlin', dj: 'Djibouti', dk: 'Copenhague',
  dm: 'Roseau', do: 'Saint-Domingue', dz: 'Alger', ec: 'Quito', ee: 'Tallinn', eg: 'Le Caire',
  er: 'Asmara', es: 'Madrid', et: 'Addis-Abeba', fi: 'Helsinki', fj: 'Suva', fm: 'Palikir',
  fr: 'Paris', ga: 'Libreville', gb: 'Londres', gd: "Saint-Georges", ge: 'Tbilissi', gh: 'Accra',
  gm: 'Banjul', gn: 'Conakry', gq: 'Malabo', gr: 'Athènes', gt: 'Guatemala', gw: 'Bissau',
  gy: 'Georgetown', hn: 'Tegucigalpa', hr: 'Zagreb', ht: 'Port-au-Prince', hu: 'Budapest',
  id: 'Jakarta', ie: 'Dublin', il: 'Jérusalem', in: 'New Delhi', iq: 'Bagdad', ir: 'Téhéran',
  is: 'Reykjavik', it: 'Rome', jm: 'Kingston', jo: 'Amman', jp: 'Tokyo', ke: 'Nairobi',
  kg: 'Bichkek', kh: 'Phnom Penh', ki: 'Tarawa-Sud', km: 'Moroni', kn: 'Basseterre',
  kp: 'Pyongyang', kr: 'Séoul', kw: 'Koweït', kz: 'Astana', la: 'Vientiane', lb: 'Beyrouth',
  lc: 'Castries', li: 'Vaduz', lk: 'Colombo', lr: 'Monrovia', ls: 'Maseru', lt: 'Vilnius',
  lu: 'Luxembourg', lv: 'Riga', ly: 'Tripoli', ma: 'Rabat', mc: 'Monaco', md: 'Chișinău',
  me: 'Podgorica', mg: 'Antananarivo', mh: 'Majuro', mk: 'Skopje', ml: 'Bamako', mm: 'Naypyidaw',
  mn: 'Oulan-Bator', mr: 'Nouakchott', mt: 'La Valette', mu: 'Port-Louis', mv: 'Malé',
  mw: 'Lilongwe', mx: 'Mexico', my: 'Kuala Lumpur', mz: 'Maputo', na: 'Windhoek', ne: 'Niamey',
  ng: 'Abuja', ni: 'Managua', nl: 'Amsterdam', no: 'Oslo', np: 'Katmandou', nr: 'Yaren',
  nz: 'Wellington', om: 'Mascate', pa: 'Panama', pe: 'Lima', pg: 'Port Moresby', ph: 'Manille',
  pk: 'Islamabad', pl: 'Varsovie', ps: 'Ramallah', pt: 'Lisbonne', pw: 'Ngerulmud', py: 'Asunción',
  qa: 'Doha', ro: 'Bucarest', rs: 'Belgrade', ru: 'Moscou', rw: 'Kigali', sa: 'Riyad',
  sb: 'Honiara', sc: 'Victoria', sd: 'Khartoum', se: 'Stockholm', sg: 'Singapour', si: 'Ljubljana',
  sk: 'Bratislava', sl: 'Freetown', sm: 'Saint-Marin', sn: 'Dakar', so: 'Mogadiscio',
  sr: 'Paramaribo', ss: 'Djouba', st: 'São Tomé', sv: 'San Salvador', sy: 'Damas', sz: 'Mbabane',
  td: "N'Djaména", tg: 'Lomé', th: 'Bangkok', tj: 'Douchanbé', tl: 'Dili', tm: 'Achgabat',
  tn: 'Tunis', to: "Nuku'alofa", tr: 'Ankara', tt: "Port-d'Espagne", tv: 'Funafuti', tw: 'Taipei',
  tz: 'Dodoma', ua: 'Kiev', ug: 'Kampala', us: 'Washington', uy: 'Montevideo', uz: 'Tachkent',
  va: 'Cité du Vatican', vc: 'Kingstown', ve: 'Caracas', vn: 'Hanoï', vu: 'Port-Vila', ws: 'Apia',
  xk: 'Pristina', ye: 'Sanaa', za: 'Pretoria', zm: 'Lusaka', zw: 'Harare',
}

// ── Sous-régions AFRICAINES (UN) — code → libellé. (Autres continents : niveau
// continent uniquement pour l'instant ; extensible.)
const SOUSREGION_AF = {
  nord:     ['dz', 'eg', 'ly', 'ma', 'tn', 'sd', 'eh'],
  ouest:    ['bj', 'bf', 'cv', 'ci', 'gm', 'gh', 'gn', 'gw', 'lr', 'ml', 'mr', 'ne', 'ng', 'sn', 'sl', 'tg', 'sh'],
  centrale: ['ao', 'cm', 'cf', 'td', 'cg', 'cd', 'gq', 'ga', 'st'],
  est:      ['bi', 'km', 'dj', 'er', 'et', 'ke', 'mg', 'mw', 'mu', 'yt', 'mz', 're', 'rw', 'sc', 'so', 'ss', 'tz', 'ug', 'zm', 'zw'],
  australe: ['bw', 'sz', 'ls', 'na', 'za'],
}
const SOUSREGION_LABEL = {
  nord: "Afrique du Nord", ouest: "Afrique de l'Ouest", centrale: 'Afrique centrale',
  est: "Afrique de l'Est", australe: 'Afrique australe',
}

export function capitaleOf(code) { return CAPITALS[code] ?? null }

// Renvoie { tag, nom } de la sous-région, ou null.
export function sousRegionOf(code) {
  for (const [k, list] of Object.entries(SOUSREGION_AF)) {
    if (list.includes(code)) return { tag: `afrique-${k}`, nom: SOUSREGION_LABEL[k] }
  }
  return null
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
  const sr = sousRegionOf(code)
  if (sr) tags.push(sr.tag)
  for (const [g, list] of Object.entries(GROUPES)) if (list.includes(code)) tags.push(g)
  return tags
}
