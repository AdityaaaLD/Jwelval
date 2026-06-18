import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(scriptDir, '..')
const dbPath = process.env.DB_PATH || resolve(serverDir, 'data', 'jewel_val.db')
const port = Number(process.env.RESTART_TEST_PORT || 3112)
const base = `http://127.0.0.1:${port}`
const RESTART_LEVELS = [1, 5, 10]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function seedUserAndSession() {
  const db = new Database(dbPath)
  const now = new Date().toISOString()
  const email = `restart.${Date.now()}@example.com`
  const passwordHash = bcrypt.hashSync('Restart123!', 10)
  const userResult = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_at)
     VALUES (?, ?, ?, 'user', 'PRO', ?, 'ACTIVE', 1, ?)`
  ).run('Restart User', email, passwordHash, now, now)
  const userId = Number(userResult.lastInsertRowid)
  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = { id: userId, name: 'Restart User', email, role: 'user', plan: 'PRO', status: 'ACTIVE', emailVerified: true }
  db.prepare('INSERT INTO sessions (token, user_id, user_json, created_at) VALUES (?, ?, ?, ?)').run(token, userId, JSON.stringify(safeUser), now)
  db.close()
  return { userId, token }
}

function cleanupUser(userId) {
  const db = new Database(dbPath)
  try {
    db.prepare('DELETE FROM otp_tokens WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM customers WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  } finally {
    db.close()
  }
}

function startServer(logs) {
  const child = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:5173',
      EMAIL_FROM: 'no-reply@example.com',
      MAIL_PROVIDER: 'stub',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))
  child.stderr.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))

  return child
}

async function waitForReady(timeoutMs = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return Date.now() - start
    } catch {}
    await sleep(250)
  }
  return null
}

async function trafficWorker(token, stopSignal, results) {
  while (!stopSignal.stop) {
    try {
      const reqs = await Promise.all([
        fetch(`${base}/api/auth/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'missing@example.com', purpose: 'RESET_PASSWORD' }),
        }),
        fetch(`${base}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'missing@example.com', purpose: 'RESET_PASSWORD', otp: '000000' }),
        }),
        fetch(`${base}/api/customers`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${base}/api/reports/summary`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      for (const res of reqs) {
        results.total += 1
        if (!res.ok) results.failures += 1
      }
    } catch {
      results.total += 4
      results.failures += 4
    }
    await sleep(80)
  }
}

function hasLifecycle(logs) {
  const raw = logs.join('\n')
  return {
    DEPLOYMENT_START: raw.includes('DEPLOYMENT_START'),
    SERVER_STARTING: raw.includes('SERVER_STARTING'),
    DATABASE_CONNECTED: raw.includes('DATABASE_CONNECTED'),
    APP_READY: raw.includes('APP_READY'),
    SERVER_READY: raw.includes('SERVER_READY'),
  }
}

async function runScenario(restarts, token) {
  const logs = []
  const trafficStats = { total: 0, failures: 0 }
  const stopSignal = { stop: false }

  let child = startServer(logs)
  const firstReady = await waitForReady()

  const traffic = Promise.all(Array.from({ length: 12 }, () => trafficWorker(token, stopSignal, trafficStats)))

  const startupDurations = [firstReady]
  let restartFailures = 0

  for (let i = 0; i < restarts; i += 1) {
    if (child.exitCode === null) {
      child.kill('SIGINT')
      await sleep(550)
    }
    child = startServer(logs)
    const readyMs = await waitForReady()
    startupDurations.push(readyMs)
    if (readyMs === null) restartFailures += 1
    await sleep(350)
  }

  stopSignal.stop = true
  await traffic

  if (child.exitCode === null) {
    child.kill('SIGINT')
    await sleep(450)
  }

  const lifecycle = hasLifecycle(logs)
  return {
    restarts,
    startupDurationsMs: startupDurations,
    startupFailureCount: startupDurations.filter((x) => x === null).length,
    restartFailures,
    trafficStats,
    failureRate: trafficStats.total ? Number((trafficStats.failures / trafficStats.total).toFixed(4)) : 0,
    lifecycle,
  }
}

async function main() {
  const { userId, token } = seedUserAndSession()
  try {
    const report = []
    for (const n of RESTART_LEVELS) {
      report.push(await runScenario(n, token))
    }
    console.log(JSON.stringify(report, null, 2))
  } finally {
    cleanupUser(userId)
  }
}

main().catch((error) => {
  console.error('Restart resilience test failed', error)
  process.exit(1)
})
