import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import os from 'os'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import googleAuthRoutes from './routes/auth.google.js'
import partiesRoutes from './routes/parties.js'
import buzzersRoutes from './routes/buzzers.js'
import categoriesRoutes from './routes/categories.js'
import questionsRoutes from './routes/questions.js'
import mediaRoutes from './routes/media.js'
import importRoutes from './routes/import.js'
import packsRoutes from './routes/packs.js'
import adminRoutes from './routes/admin.js'
import adminPacksRoutes from './routes/adminPacks.js'
import profileRoutes from './routes/profile.js'
import historyRoutes from './routes/history.js'
import billingRoutes from './routes/billing.js'
import organisationsRoutes from './routes/organisations.js'
import adminOffresRoutes from './routes/adminOffres.js'
import adminFirmwareRoutes from './routes/adminFirmware.js'
import { initWsServer } from './ws/wsServer.js'

// Filet de sécurité : une promesse rejetée non capturée (ex. minuteur de jeu sur
// une partie supprimée) ne doit jamais faire tomber le serveur.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message ?? err)
})

const app = express()
const httpServer = createServer(app)

// CORS : on reflète l'origine de la requête (origin: true). L'authentification
// est par jeton Bearer (aucun cookie) → pas de risque CSRF, et l'accès
// multi-appareils sur le réseau local (téléphone / tablette / PC / simulateur)
// fonctionne sans configuration. Mettre CORS_STRICT=true + CLIENT_URL pour
// verrouiller en production.
const corsOrigin = process.env.CORS_STRICT === 'true' ? (process.env.CLIENT_URL || true) : true
app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Serve uploaded media files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/auth/google', googleAuthRoutes)
app.use('/api/parties', partiesRoutes)
app.use('/api/buzzers', buzzersRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/questions', questionsRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/import', importRoutes)
app.use('/api/packs', packsRoutes)
app.use('/api/admin/packs', adminPacksRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/organisations', organisationsRoutes)
app.use('/api/admin/offres', adminOffresRoutes)
app.use('/api/admin/firmware', adminFirmwareRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Adresse IPv4 LAN du serveur — sert à construire des QR/lien joignables depuis
// les autres appareils même si l'hôte a ouvert l'app via « localhost ».
function lanIp() {
  const ifs = os.networkInterfaces()
  const addrs = []
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === 'IPv4' && !i.internal) addrs.push(i.address)
    }
  }
  // Préfère les plages privées classiques (192.168.* puis 10.* puis 172.*).
  return addrs.find(a => a.startsWith('192.168.')) || addrs.find(a => a.startsWith('10.'))
    || addrs.find(a => a.startsWith('172.')) || addrs[0] || null
}
app.get('/api/net', (_req, res) => res.json({ ip: lanIp() }))

initWsServer(httpServer)

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Gbairai server running on port ${PORT}`)
})
