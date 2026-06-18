import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(scriptDir, '..')
const dbPath = process.env.DB_PATH || resolve(serverDir, 'data', 'jewel_val.db')
const port = Number(process.env.MEM_TEST_PORT || 3111)
const base = `http://127.0.0.1:${port}`

const SAMPLE_INTERVAL_MS = Number(process.env.MEM_SAMPLE_INTERVAL_MS || 2000)
const DURATION_MINUTES = Number(process.env.MEM_DURATION_MINUTES || 10)
const VUS = Number(process.env.MEM_VUS || 15)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function seedUserAndSession() {
  const db = new Database(dbPath)
  const now = new Date().toISOString()
  const email = `memtest.${Date.now()}@example.com`
  const passwordHash = bcrypt.hashSync('MemTest123!', 10)
  const userResult = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_at)
     VALUES (?, ?, ?, 'user', 'PRO', ?, 'ACTIVE', 1, ?)`
  ).run('Memory Test User', email, passwordHash, now, now)
  const userId = Number(userResult.lastInsertRowid)
  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = { id: userId, name: 'Memory Test User', email, role: 'user', plan: 'PRO', status: 'ACTIVE', emailVerified: true }
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

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return true
    } catch {}
    await sleep(300)
  }
  return false
}

async function trafficWorker(token, endAt) {
  while (Date.now() < endAt) {
    try {
      await fetch(`${base}/api/customers`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetch(`${base}/api/reports/summary`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetch(`${base}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com', purpose: 'RESET_PASSWORD' }),
      })
    } catch {}
    await sleep(120)
  }
}

function parseMemoryLogs(lines) {
  return lines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return null
      try {
        const item = JSON.parse(trimmed)
        if (item.event !== 'MEMORY_USAGE') return null
        return {
          ts: item.ts,
          rss: item.rss,
          heapTotal: item.heapTotal,
          heapUsed: item.heapUsed,
          external: item.external,
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function summarize(samples) {
  if (!samples.length) return { samples: 0 }
  const first = samples[0]
  const last = samples[samples.length - 1]
  const delta = {
    rss: last.rss - first.rss,
    heapTotal: last.heapTotal - first.heapTotal,
    heapUsed: last.heapUsed - first.heapUsed,
    external: last.external - first.external,
  }
  return { samples: samples.length, first, last, delta }
}

async function main() {
  const { userId, token } = seedUserAndSession()
  const logs = []

  const child = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:5173',
      EMAIL_FROM: 'no-reply@example.com',
      MAIL_PROVIDER: 'stub',
      MEMORY_LOG_INTERVAL_MS: String(SAMPLE_INTERVAL_MS),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))
  child.stderr.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))

  try {
    const healthy = await waitForHealth()
    if (!healthy) throw new Error('Server did not become healthy for memory test')

    const endAt = Date.now() + DURATION_MINUTES * 60 * 1000
    await Promise.all(Array.from({ length: VUS }, () => trafficWorker(token, endAt)))

    await sleep(1000)

    const samples = parseMemoryLogs(logs)
    const summary = summarize(samples)

    console.log(JSON.stringify({
      durationMinutes: DURATION_MINUTES,
      sampleIntervalMs: SAMPLE_INTERVAL_MS,
      virtualUsers: VUS,
      summary,
      samples,
    }, null, 2))
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGINT')
      await sleep(500)
    }
    cleanupUser(userId)
  }
}

main().catch((error) => {
  console.error('Memory test failed', error)
  process.exit(1)
})
