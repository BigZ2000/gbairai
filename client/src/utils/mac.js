// Met en forme une adresse MAC à la saisie : ne garde que les caractères hex,
// passe en majuscules, limite à 6 octets et insère les « : » automatiquement.
//   "aabbccddeeff" → "AA:BB:CC:DD:EE:FF"
//   "aab"          → "AA:B"   (le « : » apparaît dès le 3ᵉ caractère)
// Tolère le copier-coller (avec ou sans séparateurs « : » ou « - »).
export function formatMac(value) {
  const hex = (value || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12)
  return hex.match(/.{1,2}/g)?.join(':') ?? ''
}

// true si la chaîne est une MAC complète et valide (6 octets).
export function isValidMac(value) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test((value || '').toUpperCase())
}
