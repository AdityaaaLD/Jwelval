const BASE_URL = (process.env.LOAD_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')
const EMAIL = process.env.LOAD_EMAIL || ''
const PASSWORD = process.env.LOAD_PASSWORD || ''

const LEVELS = [10, 25, 50, 100]
const RUN_SECONDS = Number(process.env.LOAD_RUN_SECONDS || 20)
const PAUSE_MS = Number(process.env.LOAD_PAUSE_MS || 300)

if (!EMAIL || !PASSWORD) {
  console.error('Set LOAD_EMAIL and LOAD_PASSWORD environment variables.')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(path, { method = 'GET', body } = {}) {
  const started = Date.now()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try { payload = await res.json() } catch {}
  return {
    ok: res.ok,
    status: res.status,
    ms: Date.now() - started,
    payload,
  }
}

function summarize(results) {
  const total = results.length
  const failed = results.filter((r) => !r.ok).length
  const rateLimited = results.filter((r) => r.status === 429).length
  const p95 = [...results].sort((a, b) => a.ms - b.ms)[Math.max(0, Math.floor(total * 0.95) - 1)]?.ms || 0
  const avg = total ? Math.round(results.reduce((sum, r) => sum + r.ms, 0) / total) : 0
  return { total, failed, rateLimited, avgMs: avg, p95Ms: p95 }
}

async function virtualUser(durationMs, results) {
  const endAt = Date.now() + durationMs
  while (Date.now() < endAt) {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD },
    })
    results.login.push(login)

    const reqOtp = await request('/api/auth/request-otp', {
      method: 'POST',
      body: { email: EMAIL, purpose: 'RESET_PASSWORD' },
    })
    results.requestOtp.push(reqOtp)

    const verify = await request('/api/auth/verify-otp', {
      method: 'POST',
      body: { email: EMAIL, purpose: 'RESET_PASSWORD', otp: '000000' },
    })
    results.verifyOtp.push(verify)

    await sleep(PAUSE_MS)
  }
}

async function runLevel(concurrency) {
  const durationMs = RUN_SECONDS * 1000
  const results = { login: [], requestOtp: [], verifyOtp: [] }
  const workers = Array.from({ length: concurrency }, () => virtualUser(durationMs, results))
  const started = Date.now()
  await Promise.all(workers)
  const elapsedMs = Date.now() - started

  return {
    concurrency,
    elapsedMs,
    login: summarize(results.login),
    requestOtp: summarize(results.requestOtp),
    verifyOtp: summarize(results.verifyOtp),
  }
}

async function main() {
  console.log(`Starting OTP load test against ${BASE_URL}`)
  const report = []
  for (const level of LEVELS) {
    console.log(`\nRunning concurrency=${level} for ${RUN_SECONDS}s ...`)
    const out = await runLevel(level)
    report.push(out)
    console.log(JSON.stringify(out, null, 2))
    await sleep(1200)
  }

  console.log('\nFINAL REPORT')
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error('Load test failed', error)
  process.exit(1)
})
