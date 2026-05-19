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

const here = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const isProd = process.env.NODE_ENV === 'production'

if (isProd) app.set('trust proxy', 1)
app.use(cors({ origin: isProd ? true : 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '20mb' }))
app.use(morgan(isProd ? 'combined' : 'dev'))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'jewelval-server' }))
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/customers', customersRouter)
app.use('/api/series', seriesRouter)
app.use('/api/valuations', valuationsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/demo', demoRouter)
app.use('/api/rates', ratesRouter)
app.use('/api/profile', profileRouter)
app.use('/api/presets', presetsRouter)
app.use('/api/verify', verifyRouter)

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
