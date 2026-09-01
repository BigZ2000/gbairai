import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `host: true` → le serveur de dev écoute sur toutes les interfaces (0.0.0.0),
// donc accessible depuis les autres appareils du réseau local (téléphone,
// tablette, PC). Vite affiche alors « Network: http://<ton-ip>:5173/ ».
// Le proxy /api + /ws vers localhost:4000 reste correct : il s'exécute sur la
// machine de dev, à côté du backend.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Le service worker ne prend PAS en charge /api ni /ws (temps réel) : on ne
      // met en cache que l'app (shell) pour un démarrage rapide et hors-ligne.
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/uploads/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gbairai — Jeux concours',
        short_name: 'Gbairai',
        description: 'Quiz et buzzers connectés. Scanner, jouer, s\'amuser.',
        lang: 'fr',
        theme_color: '#6366F1',
        background_color: '#14161d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,                 // écoute 0.0.0.0 → accessible en LAN (IP ET nom .local)
    port: 5173,
    strictPort: true,
    // Autorise l'accès via le nom d'hôte mDNS du Mac
    // (ex. http://MacBook-M2-Pro-de-ZADI.local:5173). Sans ça, Vite renvoie
    // « Blocked request. This host is not allowed » pour tout hôte non-IP.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
      '/ws': { target: 'ws://localhost:4000', ws: true },
    },
  },
})
