import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `host: true` → le serveur de dev écoute sur toutes les interfaces (0.0.0.0),
// donc accessible depuis les autres appareils du réseau local (téléphone,
// tablette, PC). Vite affiche alors « Network: http://<ton-ip>:5173/ ».
// Le proxy /api + /ws vers localhost:4000 reste correct : il s'exécute sur la
// machine de dev, à côté du backend.
export default defineConfig({
  plugins: [react()],
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
