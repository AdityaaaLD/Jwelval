import 'dotenv/config'
import express from 'express' 
import cors from 'cors'
import morgan from 'morgan'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

import './db/migrate.js'
import customersRouter from './routes/customers.js'
import seriesRouter from './routes/series.js'
import valuationsRouter from './routes/valuations.js'
import paymentsRouter from './routes/payments.js'
import reportsRouter from './routes/reports.js'
import dashboardRouter from './routes/dashboard.js'
import demoRouter from './routes/demo.js'
import ratesRouter from './routes/rates.js'
import profileRouter from './routes/profile.js'
import presetsRouter from './routes/presets.js'
import verifyRouter from './routes/verify.js'
import authRouter from './routes/auth.js'
import ornamentsRouter from './routes/ornaments.js'
import sellBillsRouter from './routes/sellBills.js'
import { requireAuth } from './middleware/auth.js'
import { authRateLimit, rateLimit } from './middleware/rateLimit.js'

const here = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const isProd = process.env.NODE_ENV === 'production'
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)

const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    const allowed = isProd ? configuredOrigins : devOrigins
    if (!allowed.length) {
      return callback(null, false)
    }
    if (allowed.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
}

if (isProd) app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(cors(corsOptions))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProd && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(morgan(isProd ? 'combined' : 'dev'))

// Public routes (no auth required)
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'jewelval-server' }))
app.use('/api/auth', authRateLimit, authRouter)
app.use('/api/verify', verifyRouter)

// Protected routes (auth required)
app.use('/api/dashboard', rateLimit, requireAuth, dashboardRouter)
app.use('/api/customers', rateLimit, requireAuth, customersRouter)
app.use('/api/series', rateLimit, requireAuth, seriesRouter)
app.use('/api/valuations', rateLimit, requireAuth, valuationsRouter)
app.use('/api/payments', rateLimit, requireAuth, paymentsRouter)
app.use('/api/reports', rateLimit, requireAuth, reportsRouter)
app.use('/api/demo', rateLimit, requireAuth, demoRouter)
app.use('/api/rates', rateLimit, requireAuth, ratesRouter)
app.use('/api/profile', rateLimit, requireAuth, profileRouter)
app.use('/api/presets', rateLimit, requireAuth, presetsRouter)
app.use('/api/ornaments', rateLimit, requireAuth, ornamentsRouter)
app.use('/api/sell-bills', rateLimit, requireAuth, sellBillsRouter)

if (isProd) {
  const distPath = resolve(here, '../../client/dist')
  if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(join(distPath, 'index.html'))
    })
  }
}

app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status || 500
  const message = isProd && status === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error')
  res.status(status).json({ error: err.code || 'INTERNAL', message })
})

const HOST = '0.0.0.0'
const server = app.listen(PORT, HOST, () => {
  console.log(`JewelVal API listening on http://${HOST}:${PORT} (${isProd ? 'prod' : 'dev'})`)
})

const shutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
