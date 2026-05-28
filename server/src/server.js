import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import partiesRoutes from './routes/parties.js'
import buzzersRoutes from './routes/buzzers.js'
import { initWsServer } from './ws/wsServer.js'

const app = express()
const httpServer = createServer(app)

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/parties', partiesRoutes)
app.use('/api/buzzers', buzzersRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

initWsServer(httpServer)

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Gbairai server running on port ${PORT}`)
})
