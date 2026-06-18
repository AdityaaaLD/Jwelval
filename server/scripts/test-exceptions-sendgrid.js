import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(scriptDir, '..')
const dbPath = process.env.DB_PATH || resolve(serverDir, 'data', 'jewel_val.db')
const port = Number(process.env.EX_TEST_PORT || 3110)
const base = `http://127.0.0.1:${port}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForHealth(timeoutMs = 25000) {
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

function seedMailTestUser() {
  const db = new Database(dbPath)
  const now = new Date().toISOString()
  const email = `mailtest.${Date.now()}@example.com`
  const passwordHash = bcrypt.hashSync('MailTest123!', 10)
  const result = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_at)
     VALUES (?, ?, ?, 'user', 'PRO', ?, 'ACTIVE', 0, ?)`
  ).run('Mail Test User', email, passwordHash, now, now)
  db.close()
  return { userId: Number(result.lastInsertRowid), email }
}

function cleanupMailTestUser(userId) {
  const db = new Database(dbPath)
  try {
    db.prepare('DELETE FROM otp_tokens WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  } finally {
    db.close()
  }
}

async function postJson(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let payload = null
  try { payload = await res.json() } catch {}
  return { status: res.status, ok: res.ok, payload }
}

function startServer(env = {}) {
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
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))
  child.stderr.on('data', (d) => logs.push(...String(d).split(/\r?\n/).filter(Boolean)))

  return { child, logs }
}

async function stopServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGINT')
  await sleep(500)
}

async function runUnhandledRejectionCase() {
  const { child, logs } = startServer()
  const healthy = await waitForHealth()
  if (!healthy) {
    await stopServer(child)
    return {
      name: 'json-parse/validation-route-probe',
      healthy: false,
      aliveAfter: child.exitCode === null,
      probe: null,
      sawUnhandled: false,
      sawUncaught: false,
      startupLogs: logs.slice(-40),
    }
  }
  const probe = await postJson('/api/auth/verify-otp', { email: 'bad@example.com', purpose: 'LOGIN', otp: { bad: true } })
  await sleep(800)
  const aliveAfter = child.exitCode === null
  await stopServer(child)
  return {
    name: 'json-parse/validation-route-probe',
    healthy,
    aliveAfter,
    probe,
    sawUnhandled: logs.some((x) => x.includes('UNHANDLED_REJECTION')),
    sawUncaught: logs.some((x) => x.includes('UNCAUGHT_EXCEPTION')),
  }
}

async function runInjectedExceptionCases() {
  const cases = [
    { name: 'unhandled-rejection', env: { TEST_TRIGGER_UNHANDLED_REJECTION: 'true' } },
    { name: 'uncaught-exception', env: { TEST_TRIGGER_UNCAUGHT_EXCEPTION: 'true' } },
  ]

  const out = []
  for (const c of cases) {
    const { child, logs } = startServer(c.env)
    const healthy = await waitForHealth()
    await sleep(900)
    const aliveAfter = child.exitCode === null
    out.push({
      case: c.name,
      healthy,
      aliveAfter,
      sawUnhandled: logs.some((x) => x.includes('UNHANDLED_REJECTION')),
      sawUncaught: logs.some((x) => x.includes('UNCAUGHT_EXCEPTION')),
      sawShutdown: logs.some((x) => x.includes('SERVER_SHUTDOWN')),
      exitCode: child.exitCode,
    })
    await stopServer(child)
  }

  return out
}

async function runMailerRetryCases() {
  const cases = [
    { label: '429-then-ok', seq: '429,OK' },
    { label: '500-500-then-ok', seq: '500,500,OK' },
    { label: 'timeout-then-ok', seq: 'TIMEOUT,OK' },
    { label: 'network-ish-500x3', seq: '500,500,500' },
  ]

  const out = []
  for (const c of cases) {
    const seededUser = seedMailTestUser()
    const { child, logs } = startServer({
      MAIL_TEST_FAILURE_SEQUENCE: c.seq,
      MAIL_SEND_MAX_RETRIES: '3',
      MAIL_SEND_BACKOFF_MS: '50',
      MAIL_TEST_TIMEOUT_MS: '100',
    })

    const healthy = await waitForHealth()
    if (!healthy) {
      out.push({
        case: c.label,
        seq: c.seq,
        healthy: false,
        otpStatus: null,
        otpOk: false,
        aliveAfter: child.exitCode === null,
        retrySignals: 0,
        sentSignals: 0,
        startupLogs: logs.slice(-40),
      })
      await stopServer(child)
      cleanupMailTestUser(seededUser.userId)
      continue
    }

    const otp = await postJson('/api/auth/request-otp', {
      email: seededUser.email,
      purpose: 'RESET_PASSWORD',
    })

    await sleep(1000)
    const aliveAfter = child.exitCode === null
    const retrySignals = logs.filter((x) => x.includes('OTP_FAILED')).length
    const sentSignals = logs.filter((x) => x.includes('OTP_SENT')).length

    out.push({
      case: c.label,
      seq: c.seq,
      healthy,
      otpStatus: otp.status,
      otpOk: otp.ok,
      aliveAfter,
      retrySignals,
      sentSignals,
    })

    await stopServer(child)
    cleanupMailTestUser(seededUser.userId)
  }

  return out
}

async function main() {
  const unhandled = await runUnhandledRejectionCase()
  const injected = await runInjectedExceptionCases()
  const mailer = await runMailerRetryCases()

  console.log(JSON.stringify({
    unhandledExceptionCheck: unhandled,
    injectedExceptionScenarios: injected,
    sendgridRetrySimulation: mailer,
  }, null, 2))
}

main().catch((error) => {
  console.error('Exception/mailer test failed', error)
  process.exit(1)
})
