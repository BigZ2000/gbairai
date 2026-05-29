import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import googleAuthRoutes from './routes/auth.google.js'
import partiesRoutes from './routes/parties.js'
import buzzersRoutes from './routes/buzzers.js'
import categoriesRoutes from './routes/categories.js'
import questionsRoutes from './routes/questions.js'
import adminRoutes from './routes/admin.js'
import { initWsServer } from './ws/wsServer.js'

const app = express()
const httpServer = createServer(app)

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// Serve uploaded media files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/auth/google', googleAuthRoutes)
app.use('/api/parties', partiesRoutes)
app.use('/api/buzzers', buzzersRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/questions', questionsRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

initWsServer(httpServer)

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Gbairai server running on port ${PORT}`)
})
