import 'dotenv/config'
import express from 'express' 
import cors from 'cors'
import morgan from 'morgan'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

import { verifyDatabaseConnection, closeDatabaseConnection, dbPath } from './db/client.js'
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
import subscriptionsRouter from './routes/subscriptions.js'
import ornamentsRouter from './routes/ornaments.js'
import sellBillsRouter from './routes/sellBills.js'
import { requireAuth } from './middleware/auth.js'
import { authRateLimit, rateLimit, subscriptionRateLimit } from './middleware/rateLimit.js'
import { getMailerHealth, validateMailerConfiguration } from './mailer.js'
import { logEvent, logErrorEvent } from './lib/logger.js'

const here = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const isProd = process.env.NODE_ENV === 'production'
const startupAt = Date.now()
let appReady = false
let startupError = null
const memoryLogIntervalMs = Number(process.env.MEMORY_LOG_INTERVAL_MS || 0)
let memoryLogTimer = null
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

function verifyRequiredEnv() {
  const missing = []
  if (isProd && !process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS')
  if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM')
  if (missing.length) {
    const error = new Error(`Missing required environment variables: ${missing.join(', ')}`)
    error.code = 'ENV_MISSING'
    throw error
  }
}

function runStartupChecks() {
  logEvent('SERVER_STARTING', { port: PORT, nodeEnv: process.env.NODE_ENV || 'development', dbPath })
  verifyRequiredEnv()
  logEvent('ENV_LOADED', { corsOriginsConfigured: configuredOrigins.length > 0, dbPath })

  verifyDatabaseConnection()
  logEvent('DATABASE_CONNECTED', { dbPath })

  validateMailerConfiguration()
  const mailerHealth = getMailerHealth()
  logEvent('MAILER_READY', mailerHealth)

  return {
    database: 'connected',
    email: mailerHealth.configured ? 'configured' : 'not_configured',
    mailer: mailerHealth,
  }
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
app.get('/api/health', (_req, res) => {
  const uptimeSeconds = Math.floor(process.uptime())
  if (!appReady) {
    return res.status(503).json({
      status: 'starting',
      database: 'unknown',
      email: 'unknown',
      uptime: `${uptimeSeconds}s`,
      error: startupError?.message,
    })
  }
  return res.json({
    status: 'healthy',
    database: 'connected',
    email: 'configured',
    uptime: `${uptimeSeconds}s`,
  })
})
app.use('/api/auth', authRateLimit, authRouter)
app.use('/api/verify', verifyRouter)
app.use('/api/subscriptions', subscriptionRateLimit, subscriptionsRouter)

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
let server = null

async function bootstrap() {
  try {
    logEvent('DEPLOYMENT_START', { startedAt: new Date(startupAt).toISOString() })
    await import('./db/migrate.js')
    const checks = runStartupChecks()

    server = app.listen(PORT, HOST, () => {
      appReady = true
      logEvent('APP_READY', {
        host: HOST,
        port: PORT,
        checks,
        startupMs: Date.now() - startupAt,
      })
      logEvent('SERVER_READY', { host: HOST, port: PORT })
      console.log(`JewelVal API listening on http://${HOST}:${PORT} (${isProd ? 'prod' : 'dev'})`)
    })

    server.keepAliveTimeout = 65000
    server.headersTimeout = 66000
    server.requestTimeout = 30000

    if (memoryLogIntervalMs > 0) {
      memoryLogTimer = setInterval(() => {
        const usage = process.memoryUsage()
        logEvent('MEMORY_USAGE', {
          rss: usage.rss,
          heapTotal: usage.heapTotal,
          heapUsed: usage.heapUsed,
          external: usage.external,
        })
      }, memoryLogIntervalMs)
      memoryLogTimer.unref()
    }

    if (String(process.env.TEST_TRIGGER_UNHANDLED_REJECTION || '').trim() === 'true') {
      setTimeout(() => Promise.reject(new Error('Injected test unhandled rejection')), 300)
    }

    if (String(process.env.TEST_TRIGGER_UNCAUGHT_EXCEPTION || '').trim() === 'true') {
      setTimeout(() => {
        throw new Error('Injected test uncaught exception')
      }, 300)
    }
  } catch (error) {
    startupError = error
    logErrorEvent('DATABASE_FAILED', error, { phase: 'bootstrap' })
    logErrorEvent('SERVER_START_FAILED', error)
    process.exit(1)
  }
}

const shutdown = (signal) => {
  logEvent('SERVER_SHUTDOWN', { signal })
  console.log(`\n[${signal}] Shutting down gracefully...`)
  if (!server) {
    if (memoryLogTimer) clearInterval(memoryLogTimer)
    closeDatabaseConnection()
    process.exit(0)
    return
  }
  server.close(() => {
    try {
      if (memoryLogTimer) clearInterval(memoryLogTimer)
      closeDatabaseConnection()
    } catch {}
    process.exit(0)
  })
  setTimeout(() => {
    try { closeDatabaseConnection() } catch {}
    process.exit(1)
  }, 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  logErrorEvent('UNHANDLED_REJECTION', reason instanceof Error ? reason : new Error(String(reason)))
})
process.on('uncaughtException', (error) => {
  logErrorEvent('UNCAUGHT_EXCEPTION', error)
  shutdown('UNCAUGHT_EXCEPTION')
})

bootstrap()
