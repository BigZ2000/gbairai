// Génère les icônes PWA (PNG) à partir du logo Gbairai.
// Les PNG sont versionnés (public/icons/*, apple-touch-icon.png) : ce script ne
// sert qu'à les RÉGÉNÉRER si le logo change. `sharp` n'est donc pas une dépendance
// permanente (build allégé). Prérequis ponctuel :
//     npm i -D sharp && node scripts/gen-pwa-icons.mjs   (depuis client/)   puis   npm uninstall sharp
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const icons = join(pub, 'icons')

const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#818CF8"/><stop offset="1" stop-color="#6366F1"/>
</linearGradient></defs>`
const G = (size) => `<text x="256" y="272" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif"
  font-size="${size}" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="central">G</text>`

// Coins arrondis (icône "any") — le "G" bien rempli.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${GRAD}<rect width="512" height="512" rx="116" fill="url(#g)"/>${G(336)}</svg>`
// Carré plein sans transparence — pour l'icône Apple (iOS arrondit lui-même).
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${GRAD}<rect width="512" height="512" fill="url(#g)"/>${G(336)}</svg>`
// Maskable — carré plein + "G" dans la zone de sécurité (80%), plus petit.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${GRAD}<rect width="512" height="512" fill="url(#g)"/>${G(288)}</svg>`

const jobs = [
  { svg: rounded,  size: 192, out: join(icons, 'icon-192.png') },
  { svg: rounded,  size: 512, out: join(icons, 'icon-512.png') },
  { svg: maskable, size: 512, out: join(icons, 'icon-maskable-512.png') },
  { svg: square,   size: 180, out: join(pub, 'apple-touch-icon.png') },
  { svg: rounded,  size: 32,  out: join(pub, 'favicon-32.png') },
]

await mkdir(icons, { recursive: true })
for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(j.out)
  console.log('✓', j.out.replace(root + '/', ''), `(${j.size}px)`)
}
console.log('Icônes PWA générées.')
