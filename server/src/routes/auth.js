import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { sqlite } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail } from '../mailer.js'
import { logEvent, logErrorEvent } from '../lib/logger.js'

const router = Router()
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5)
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)
const OTP_MAX_SENDS_PER_HOUR = Number(process.env.OTP_MAX_SENDS_PER_HOUR || 3)
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60)
const OTP_EMAIL_MAX_10_MIN = Number(process.env.OTP_EMAIL_MAX_10_MIN || 3)
const OTP_EMAIL_MAX_DAY = Number(process.env.OTP_EMAIL_MAX_DAY || 10)
const OTP_IP_MAX_HOUR = Number(process.env.OTP_IP_MAX_HOUR || 10)
const OTP_VERIFY_IP_MAX_HOUR = Number(process.env.OTP_VERIFY_IP_MAX_HOUR || 60)
const ALLOWED_OTP_PURPOSES = new Set(['LOGIN', 'VERIFY_EMAIL', 'RESET_PASSWORD'])
const REQUESTABLE_OTP_PURPOSES = new Set(['VERIFY_EMAIL', 'RESET_PASSWORD'])

// Legacy SHA-256 hash for migrating old passwords
const sha256 = (password) => crypto.createHash('sha256').update(password).digest('hex')

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const nowIso = () => new Date().toISOString()
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function countOtpVerifyAttemptsByIp(ip, sinceIso) {
  return sqlite.prepare(
    "SELECT COUNT(*) AS n FROM otp_request_audit WHERE ip = ? AND created_at >= ? AND outcome IN ('VERIFY_FAILED','VERIFY_SUCCESS')"
  ).get(ip, sinceIso).n
}

function ensureOtpVerifyRateLimit(ip) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const attempts = countOtpVerifyAttemptsByIp(ip, oneHourAgo)
  if (attempts >= OTP_VERIFY_IP_MAX_HOUR) {
    const error = new Error('Too many OTP verification attempts. Please try later.')
    error.status = 429
    error.code = 'OTP_RATE_LIMIT'
    error.retryAfterSeconds = 60 * 10
    throw error
  }
}

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0] || ''}***@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

function countOtpRequestsByEmail(email, sinceIso) {
  return sqlite.prepare(
    "SELECT COUNT(*) AS n FROM otp_request_audit WHERE email = ? AND created_at >= ? AND outcome IN ('SENT','REUSED')"
  ).get(email, sinceIso).n
}

function countOtpRequestsByIp(ip, sinceIso) {
  return sqlite.prepare(
    "SELECT COUNT(*) AS n FROM otp_request_audit WHERE ip = ? AND created_at >= ? AND outcome IN ('SENT','REUSED')"
  ).get(ip, sinceIso).n
}

function auditOtpRequest(email, ip, purpose, outcome, at = nowIso()) {
  sqlite.prepare(
    'INSERT INTO otp_request_audit (email, ip, purpose, created_at, outcome) VALUES (?, ?, ?, ?, ?)'
  ).run(email, ip, purpose, at, outcome)
}

function ensureOtpRequestLimits({ email, ip, purpose }) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const email10Min = countOtpRequestsByEmail(email, tenMinutesAgo)
  if (email10Min >= OTP_EMAIL_MAX_10_MIN) {
    const error = new Error('Too many OTP requests for this email. Please try later.')
    error.status = 429
    error.code = 'OTP_RATE_LIMIT'
    error.retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS
    throw error
  }

  const emailDay = countOtpRequestsByEmail(email, oneDayAgo)
  if (emailDay >= OTP_EMAIL_MAX_DAY) {
    const error = new Error('Daily OTP limit reached for this email. Try again tomorrow.')
    error.status = 429
    error.code = 'OTP_RATE_LIMIT'
    error.retryAfterSeconds = 60 * 60
    throw error
  }

  const ipHour = countOtpRequestsByIp(ip, oneHourAgo)
  if (ipHour >= OTP_IP_MAX_HOUR) {
    const error = new Error('Too many OTP requests from your network. Please try later.')
    error.status = 429
    error.code = 'OTP_RATE_LIMIT'
    error.retryAfterSeconds = 60 * 10
    throw error
  }
}

function getActiveOtpToken(userId, purpose) {
  return sqlite.prepare(
    `SELECT id, created_at, expires_at, attempts, max_attempts
     FROM otp_tokens
     WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).get(userId, purpose, nowIso())
}
const buildSafeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  plan: user.plan,
  status: user.status || 'ACTIVE',
  emailVerified: Boolean(user.email_verified),
})

function respondOtpSendFailure(res, error, context) {
  logErrorEvent('OTP_FAILED', error, { context })
  const isRateLimited = error?.status === 429 || error?.code === 'OTP_RATE_LIMIT'
  if (isRateLimited) {
    const retryAfterSeconds = Number(error?.retryAfterSeconds || 0)
    if (retryAfterSeconds > 0) res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      error: 'OTP_RATE_LIMIT',
      message: error?.message || 'Too many OTP requests. Please try again later.',
      retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    })
  }
  return res.status(503).json({ error: 'OTP_SEND_FAILED', message: 'Unable to send OTP right now. Please try again.' })
}

function createSessionForUser(user, at = nowIso()) {
  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = buildSafeUser(user)
  sqlite.prepare(
    'INSERT INTO sessions (token, user_id, user_json, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, user.id, JSON.stringify(safeUser), at)
  return { token, user: safeUser }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashOtp(otp) {
  return sha256(`otp:${otp}`)
}

function validateOtpPurpose(purpose) {
  return ALLOWED_OTP_PURPOSES.has(purpose)
}

function ensureOtpRateLimit(userId, purpose) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const sentCount = sqlite.prepare(
    'SELECT COUNT(*) AS n FROM otp_tokens WHERE user_id = ? AND purpose = ? AND created_at >= ?'
  ).get(userId, purpose, oneHourAgo).n
  if (sentCount >= OTP_MAX_SENDS_PER_HOUR) {
    const error = new Error('Too many OTP requests. Please try again later.')
    error.status = 429
    error.code = 'OTP_RATE_LIMIT'
    throw error
  }
}

async function sendOtpForPurpose(user, purpose, context = {}) {
  const clientIp = context.ip || 'unknown'
  ensureOtpRateLimit(user.id, purpose)
  ensureOtpRequestLimits({ email: user.email, ip: clientIp, purpose })

  const active = getActiveOtpToken(user.id, purpose)
  if (active) {
    const ageSeconds = Math.floor((Date.now() - new Date(active.created_at).getTime()) / 1000)
    if (ageSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS - ageSeconds
      auditOtpRequest(user.email, clientIp, purpose, 'REUSED')
      logEvent('OTP_RATE_LIMITED', { reason: 'cooldown', purpose, email: maskEmail(user.email), retryAfterSeconds })
      const cooldownError = new Error(`OTP already sent. Please wait ${retryAfterSeconds}s before requesting again.`)
      cooldownError.status = 429
      cooldownError.code = 'OTP_RATE_LIMIT'
      cooldownError.retryAfterSeconds = retryAfterSeconds
      throw cooldownError
    }
  }

  const otp = generateOtp()
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  sqlite.transaction(() => {
    sqlite.prepare(
      'UPDATE otp_tokens SET consumed_at = ? WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL'
    ).run(createdAt, user.id, purpose)

    sqlite.prepare(
      'INSERT INTO otp_tokens (user_id, purpose, otp_hash, expires_at, attempts, max_attempts, created_at, consumed_at) VALUES (?, ?, ?, ?, 0, ?, ?, NULL)'
    ).run(user.id, purpose, hashOtp(otp), expiresAt, OTP_MAX_ATTEMPTS, createdAt)
  })()

  logEvent('OTP_GENERATED', { purpose, userId: user.id, email: maskEmail(user.email) })

  const subject = purpose === 'RESET_PASSWORD'
    ? 'JewelVal password reset OTP'
    : 'JewelVal verification OTP'
  const text = `Your JewelVal OTP is ${otp}. It will expire in ${OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`

  await sendEmail({ to: user.email, subject, text })
  auditOtpRequest(user.email, clientIp, purpose, 'SENT', createdAt)
}

function verifyOtp(userId, purpose, otp) {
  const token = sqlite.prepare(
    `SELECT id, otp_hash, expires_at, attempts, max_attempts
     FROM otp_tokens
     WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`
  ).get(userId, purpose)

  if (!token) {
    logEvent('OTP_FAILED', { userId, purpose, reason: 'not_found' }, 'warn')
    return { ok: false, code: 'OTP_NOT_FOUND', message: 'No active OTP found. Please request a new OTP.' }
  }
  if (token.attempts >= token.max_attempts) {
    logEvent('OTP_RATE_LIMITED', { userId, purpose, reason: 'max_attempts' }, 'warn')
    return { ok: false, code: 'OTP_TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Request a new OTP.' }
  }
  if (new Date(token.expires_at).getTime() < Date.now()) {
    sqlite.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso(), token.id)
    logEvent('OTP_EXPIRED', { userId, purpose })
    return { ok: false, code: 'OTP_EXPIRED', message: 'OTP expired. Please request a new OTP.' }
  }

  const matched = token.otp_hash === hashOtp(otp)
  if (!matched) {
    sqlite.prepare('UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?').run(token.id)
    logEvent('OTP_FAILED', { userId, purpose, reason: 'invalid' }, 'warn')
    return { ok: false, code: 'OTP_INVALID', message: 'Invalid OTP.' }
  }

  sqlite.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso(), token.id)
  logEvent('OTP_VERIFIED', { userId, purpose })
  return { ok: true }
}

function issueResetToken(userId) {
  const raw = crypto.randomBytes(24).toString('hex')
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  sqlite.prepare(
    'INSERT INTO otp_tokens (user_id, purpose, otp_hash, expires_at, attempts, max_attempts, created_at, consumed_at) VALUES (?, ?, ?, ?, 0, 1, ?, NULL)'
  ).run(userId, 'RESET_SESSION', hashOtp(raw), expiresAt, createdAt)
  return raw
}

function verifyResetToken(userId, token) {
  const row = sqlite.prepare(
    `SELECT id, otp_hash, expires_at
     FROM otp_tokens
     WHERE user_id = ? AND purpose = 'RESET_SESSION' AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`
  ).get(userId)
  if (!row) return false
  if (new Date(row.expires_at).getTime() < Date.now()) {
    sqlite.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso(), row.id)
    return false
  }
  if (row.otp_hash !== hashOtp(token)) return false
  sqlite.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso(), row.id)
  return true
}

// Public signup — first user becomes admin, all subsequent users stay pending until admin approval
router.post('/signup', async (req, res) => {
  const { name, password } = req.body
  const email = normalizeEmail(req.body.email)
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Name, email and password are required.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters.' })
  }

  // First user becomes admin and can login immediately.
  const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n

  const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const now = nowIso()

  if (userCount === 0) {
    const result = sqlite.prepare(
      `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_at)
       VALUES (?, ?, ?, 'admin', 'PRO', ?, 'ACTIVE', 1, ?)`
    ).run(name.trim(), email, passwordHash, now, now)
    const userId = Number(result.lastInsertRowid)
    const user = { id: userId, name: name.trim(), email, role: 'admin', plan: 'PRO', status: 'ACTIVE', email_verified: 1 }
    seedDefaultsForUser(userId, now)
    const session = createSessionForUser(user, now)
    return res.status(201).json(session)
  }

  sqlite.prepare(
    `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified)
     VALUES (?, ?, ?, 'user', 'PRO', ?, 'PENDING', 0)`
  ).run(name.trim(), email, passwordHash, now)

  res.status(201).json({
    pendingApproval: true,
    message: 'Signup successful. Your account is pending admin approval.',
  })
})

// Check if signup is available (no users yet)
router.get('/signup-status', (_req, res) => {
  const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n
  res.json({ signupOpen: true, firstUserMode: userCount === 0 })
})

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const { password } = req.body
  const clientIp = getClientIp(req)
  logEvent('OTP_REQUESTED', { purpose: 'LOGIN', email: maskEmail(email), ip: clientIp })
  const user = sqlite.prepare(
    'SELECT id, name, email, role, plan, password_hash, status, email_verified FROM users WHERE email = ?'
  ).get(email)

  if (!user) {
    return res.status(401).json({ error: 'INVALID_LOGIN', message: 'Invalid email or password.' })
  }
  if (user.status === 'PENDING') {
    return res.status(403).json({ error: 'ACCOUNT_PENDING', message: 'Your account is awaiting admin approval.' })
  }
  if (user.status === 'REJECTED') {
    return res.status(403).json({ error: 'ACCOUNT_REJECTED', message: 'Your account request was rejected. Contact admin.' })
  }

  // Support both bcrypt and legacy SHA-256 hashes (auto-upgrade on login)
  let valid = false
  if (user.password_hash.startsWith('$2')) {
    valid = await bcrypt.compare(password || '', user.password_hash)
  } else {
    valid = user.password_hash === sha256(password || '')
    // Auto-upgrade to bcrypt on successful login
    if (valid) {
      const newHash = await bcrypt.hash(password, 10)
      sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id)
    }
  }

  if (!valid) {
    return res.status(401).json({ error: 'INVALID_LOGIN', message: 'Invalid email or password.' })
  }

  if (!user.email_verified) {
    return res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: `Email not verified. Request OTP for ${maskEmail(user.email)} and verify your email first.`,
    })
  }

  try {
    await sendOtpForPurpose(user, 'LOGIN', { ip: clientIp })
  } catch (error) {
    return respondOtpSendFailure(res, error, 'login')
  }

  res.json({ otpRequired: true, purpose: 'LOGIN', email: user.email, message: 'OTP sent to your email.' })
})

router.post('/request-otp', async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const purpose = String(req.body.purpose || '')
  const clientIp = getClientIp(req)
  logEvent('OTP_REQUESTED', { purpose, email: maskEmail(email), ip: clientIp })
  if (!email || !REQUESTABLE_OTP_PURPOSES.has(purpose)) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Valid email and purpose are required.' })
  }

  const user = sqlite.prepare('SELECT id, email, status, email_verified FROM users WHERE email = ?').get(email)
  if (!user) {
    return res.json({ sent: true, message: 'If account exists, OTP has been sent.' })
  }

  if (user.status !== 'ACTIVE' || (purpose === 'VERIFY_EMAIL' && user.email_verified)) {
    return res.json({ sent: true, message: 'If account exists, OTP has been sent.' })
  }

  try {
    await sendOtpForPurpose(user, purpose, { ip: clientIp })
    res.json({ sent: true, expiresInMinutes: OTP_TTL_MINUTES })
  } catch (error) {
    respondOtpSendFailure(res, error, `request-otp:${purpose}`)
  }
})

router.post('/verify-otp', (req, res) => {
  const email = normalizeEmail(req.body.email)
  const purpose = String(req.body.purpose || '')
  const otp = String(req.body.otp || '').trim()
  const clientIp = getClientIp(req)

  if (!email || !validateOtpPurpose(purpose) || otp.length !== 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Email, purpose and 6-digit OTP are required.' })
  }

  try {
    ensureOtpVerifyRateLimit(clientIp)
  } catch (error) {
    return respondOtpSendFailure(res, error, 'verify-otp')
  }

  const user = sqlite.prepare(
    'SELECT id, name, email, role, plan, status, email_verified FROM users WHERE email = ?'
  ).get(email)
  if (!user) {
    auditOtpRequest(email, clientIp, purpose, 'VERIFY_FAILED')
    return res.status(400).json({ error: 'OTP_INVALID', message: 'Invalid OTP.' })
  }

  const verification = verifyOtp(user.id, purpose, otp)
  if (!verification.ok) {
    auditOtpRequest(email, clientIp, purpose, 'VERIFY_FAILED')
    return res.status(400).json({ error: verification.code, message: verification.message })
  }

  auditOtpRequest(email, clientIp, purpose, 'VERIFY_SUCCESS')

  if (purpose === 'VERIFY_EMAIL') {
    sqlite.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id)
    return res.json({ verified: true, message: 'Email verified successfully.' })
  }

  if (purpose === 'LOGIN') {
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'ACCOUNT_NOT_ACTIVE', message: 'Account is not active.' })
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first.' })
    }
    const session = createSessionForUser(user)
    return res.json(session)
  }

  const resetToken = issueResetToken(user.id)
  res.json({ verified: true, resetToken, expiresInMinutes: 15 })
})

router.post('/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const resetToken = String(req.body.resetToken || '')
  const newPassword = String(req.body.newPassword || '')

  if (!email || !resetToken || newPassword.length < 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Valid email, reset token and password are required.' })
  }

  const user = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (!user || !verifyResetToken(user.id, resetToken)) {
    return res.status(400).json({ error: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired.' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id)
  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  res.json({ ok: true, message: 'Password reset successful. Please login again.' })
})

router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const row = sqlite.prepare('SELECT user_id, user_json, created_at FROM sessions WHERE token = ?').get(token)
  if (!row) return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Please login.' })

  // Check session expiry
  const createdAt = new Date(row.created_at).getTime()
  if (Date.now() - createdAt > SESSION_MAX_AGE_MS) {
    sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Session expired. Please login again.' })
  }

  const user = sqlite.prepare(
    'SELECT id, name, email, role, plan, status, email_verified FROM users WHERE id = ?'
  ).get(row.user_id)
  if (!user || user.status !== 'ACTIVE') {
    sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Please login.' })
  }

  const safeUser = buildSafeUser(user)
  sqlite.prepare('UPDATE sessions SET user_json = ? WHERE token = ?').run(JSON.stringify(safeUser), token)
  res.json({ user: safeUser })
})

router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (token) sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.status(204).end()
})

function seedDefaultsForUser(userId, now) {
  // Default ornament master entries
  const defaultOrnaments = [
    'Mangalsutra', 'Bangles', 'Chain', 'Earring', 'Ring', 'Necklace',
    'Pendant', 'Bracelet', 'Anklet', 'Nose Pin', 'Waist Belt',
    'Toe Ring', 'Jhumka', 'Haar', 'Thali', 'Vanki', 'Kangan',
    'Bajuband', 'Coin', 'Bar', 'Biscuit',
  ]
  const insertOrn = sqlite.prepare('INSERT OR IGNORE INTO ornament_master (name, user_id, created_at) VALUES (?, ?, ?)')
  for (const name of defaultOrnaments) insertOrn.run(name, userId, now)

  // Default appraiser profile
  sqlite.prepare(
    `INSERT INTO appraiser_profile (user_id, appraiser_name, business_name, mobile, email, upi_id, address, updated_at)
     VALUES (?, 'Gold Appraiser', 'JewelVal Appraiser', '', '', '', '', ?)`
  ).run(userId, now)

  // Default valuation series
  const defaultSeries = [
    { seriesName: 'RUSH-2025', prefix: 'RUSH-2025', formatType: 'RUSHIKESH' },
    { seriesName: 'DNYAN-2025', prefix: 'DNYAN-2025', formatType: 'DNYANESHWARI' },
    { seriesName: 'BOM-2025', prefix: 'BOM-2025', formatType: 'BANK_OF_MAHA' },
    { seriesName: 'DIGITAL-2025', prefix: 'GLCN', formatType: 'DIGITAL_CERT' },
  ]
  const insertSeries = sqlite.prepare(
    'INSERT INTO valuation_series (series_name, prefix, current_number, number_of_digits, format_type, user_id, created_at) VALUES (?, ?, 0, 4, ?, ?, ?)'
  )
  for (const s of defaultSeries) insertSeries.run(s.seriesName, s.prefix, s.formatType, userId, now)

  // Default bill series
  sqlite.prepare(
    'INSERT INTO bill_series (series_name, prefix, current_number, number_of_digits, user_id, created_at) VALUES (?, ?, 0, 3, ?, ?)'
  ).run('SELL-2025', '', userId, now)
}

// Admin-only: create a new user account
router.post('/create-user', requireAuth, async (req, res) => {
  // Only admins can create users
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can create user accounts.' })
  }
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Name, email and password are required.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters.' })
  }
  const normalizedEmail = normalizeEmail(email)
  const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)
  if (existing) {
    return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  const result = sqlite.prepare(
    `INSERT INTO users (name, email, password_hash, role, plan, created_at, status, email_verified, approved_by, approved_at)
     VALUES (?, ?, ?, 'user', 'PRO', ?, 'ACTIVE', 0, ?, ?)`
  ).run(name, normalizedEmail, passwordHash, now, req.user.id, now)
  const userId = Number(result.lastInsertRowid)

  // Seed default data for the new user
  seedDefaultsForUser(userId, now)

  res.status(201).json({ id: userId, name, email: normalizedEmail, role: 'user', plan: 'PRO', status: 'ACTIVE', emailVerified: false })
})

// Admin-only: list all users
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can view users.' })
  }
  const users = sqlite.prepare(
    `SELECT id, name, email, role, plan, status, email_verified AS emailVerified,
            approved_at AS approvedAt, created_at AS createdAt
     FROM users
     ORDER BY id`
  ).all()
  res.json(users)
})

router.post('/users/:id/approve', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can approve users.' })
  }
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Invalid user id.' })
  }
  const user = sqlite.prepare('SELECT id, email, status, email_verified FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })

  sqlite.prepare('UPDATE users SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?').run('ACTIVE', req.user.id, nowIso(), id)

  if (!user.email_verified) {
    try {
      await sendOtpForPurpose({ id: user.id, email: user.email }, 'VERIFY_EMAIL', { ip: getClientIp(req) })
    } catch (error) {
      return respondOtpSendFailure(res, error, 'admin-approve')
    }
  }

  res.json({ ok: true, message: 'User approved successfully.' })
})

router.post('/users/:id/reject', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can reject users.' })
  }
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Invalid user id.' })
  }
  const user = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })

  sqlite.prepare('UPDATE users SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?').run('REJECTED', req.user.id, nowIso(), id)
  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
  res.json({ ok: true, message: 'User rejected.' })
})

router.post('/users/:id/send-verification-otp', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can send verification OTP.' })
  }
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Invalid user id.' })
  }
  const user = sqlite.prepare('SELECT id, email, status, email_verified FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
  if (user.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'ACCOUNT_NOT_ACTIVE', message: 'User is not active.' })
  }
  if (user.email_verified) {
    return res.status(400).json({ error: 'ALREADY_VERIFIED', message: 'Email already verified.' })
  }

  try {
    await sendOtpForPurpose(user, 'VERIFY_EMAIL', { ip: getClientIp(req) })
    res.json({ ok: true, message: 'Verification OTP sent.' })
  } catch (error) {
    respondOtpSendFailure(res, error, 'admin-send-verification-otp')
  }
})

// Admin-only: delete a user
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can delete users.' })
  }
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Invalid user id.' })
  }
  if (id === req.user.id) {
    return res.status(400).json({ error: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account.' })
  }
  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
  sqlite.prepare('DELETE FROM users WHERE id = ?').run(id)
  res.status(204).end()
})

export default router
