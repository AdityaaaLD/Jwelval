import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const rootDir = resolve(process.cwd())
const serverDir = resolve(rootDir, 'server')
const dbPath = resolve(serverDir, 'data', 'jewel_val.db')
const port = Number(process.env.SMOKE_PORT || 3106)
const base = `http://127.0.0.1:${port}/api`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const hashOtp = (otp) => sha256(`otp:${otp}`)

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(payload?.message || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = payload
    throw err
  }
  return payload
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return
    } catch {}
    await sleep(250)
  }
  throw new Error('Server did not become healthy in time.')
}

async function run() {
  const child = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`))

  const db = new Database(dbPath)
  let testUserId = null

  try {
    await waitForHealth()

    const email = `smoke.${Date.now()}@example.com`
    const password = 'SmokeTest123!'
    const now = new Date().toISOString()

    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_at)
       VALUES (?, ?, ?, 'user', 'PRO', ?, 'ACTIVE', 1, ?)`
    )
    const result = insertUser.run('Smoke User', email, bcrypt.hashSync(password, 10), now, now)
    testUserId = Number(result.lastInsertRowid)

    const hiddenReset = await request('/auth/request-otp', {
      method: 'POST',
      body: { email: `missing.${Date.now()}@example.com`, purpose: 'RESET_PASSWORD' },
    })

    const loginStart = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
    })

    const loginOtp = '111111'
    db.prepare(
      `UPDATE otp_tokens
       SET otp_hash = ?, attempts = 0, consumed_at = NULL, expires_at = ?
       WHERE id = (
         SELECT id FROM otp_tokens
         WHERE user_id = ? AND purpose = 'LOGIN'
         ORDER BY created_at DESC LIMIT 1
       )`
    ).run(hashOtp(loginOtp), new Date(Date.now() + 10 * 60 * 1000).toISOString(), testUserId)

    const loginVerified = await request('/auth/verify-otp', {
      method: 'POST',
      body: { email, purpose: 'LOGIN', otp: loginOtp },
    })

    const resetRequest = await request('/auth/request-otp', {
      method: 'POST',
      body: { email, purpose: 'RESET_PASSWORD' },
    })

    const resetOtp = '222222'
    db.prepare(
      `UPDATE otp_tokens
       SET otp_hash = ?, attempts = 0, consumed_at = NULL, expires_at = ?
       WHERE id = (
         SELECT id FROM otp_tokens
         WHERE user_id = ? AND purpose = 'RESET_PASSWORD'
         ORDER BY created_at DESC LIMIT 1
       )`
    ).run(hashOtp(resetOtp), new Date(Date.now() + 10 * 60 * 1000).toISOString(), testUserId)

    const resetVerified = await request('/auth/verify-otp', {
      method: 'POST',
      body: { email, purpose: 'RESET_PASSWORD', otp: resetOtp },
    })

    const resetDone = await request('/auth/reset-password', {
      method: 'POST',
      body: { email, resetToken: resetVerified.resetToken, newPassword: 'NewSmoke123!' },
    })

    const loginAfterReset = await request('/auth/login', {
      method: 'POST',
      body: { email, password: 'NewSmoke123!' },
    })

    console.log('\n✅ OTP smoke test passed')
    console.log(JSON.stringify({
      hiddenReset,
      loginStart,
      loginVerified: { hasToken: Boolean(loginVerified?.token), user: loginVerified?.user?.email },
      resetRequest,
      resetVerified: { verified: resetVerified?.verified, hasResetToken: Boolean(resetVerified?.resetToken) },
      resetDone,
      loginAfterReset,
    }, null, 2))
  } finally {
    if (testUserId) {
      try {
        db.prepare('DELETE FROM otp_tokens WHERE user_id = ?').run(testUserId)
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(testUserId)
        db.prepare('DELETE FROM users WHERE id = ?').run(testUserId)
      } catch {}
    }
    db.close()
    child.kill('SIGINT')
    await sleep(300)
  }
}

run().catch((error) => {
  console.error('\n❌ OTP smoke test failed')
  console.error(error)
  process.exit(1)
})
