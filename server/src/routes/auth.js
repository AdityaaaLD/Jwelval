import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { sqlite } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Legacy SHA-256 hash for migrating old passwords
const sha256 = (password) => crypto.createHash('sha256').update(password).digest('hex')

// Public signup — only allowed if NO users exist yet (first user becomes admin/owner)
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Name, email and password are required.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters.' })
  }

  // Check if any users exist — if yes, public signup is disabled
  const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n
  if (userCount > 0) {
    return res.status(403).json({ error: 'SIGNUP_DISABLED', message: 'Public signup is disabled. Contact the administrator to get an account.' })
  }

  const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  // First user gets 'admin' role
  const result = sqlite.prepare(
    'INSERT INTO users (name, email, password_hash, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email, passwordHash, 'admin', 'PRO', now)
  const userId = result.lastInsertRowid

  // Auto-login after signup
  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = { id: userId, name, email, role: 'admin', plan: 'PRO' }
  sqlite.prepare(
    'INSERT INTO sessions (token, user_id, user_json, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, JSON.stringify(safeUser), now)

  // Seed default data for the new user
  seedDefaultsForUser(userId, now)

  res.status(201).json({ token, user: safeUser })
})

// Check if signup is available (no users yet)
router.get('/signup-status', (_req, res) => {
  const userCount = sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n
  res.json({ signupOpen: userCount === 0 })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = sqlite.prepare('SELECT id, name, email, role, plan, password_hash FROM users WHERE email = ?').get(email)
  if (!user) {
    return res.status(401).json({ error: 'INVALID_LOGIN', message: 'Invalid email or password.' })
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

  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role || 'user', plan: user.plan }
  sqlite.prepare(
    'INSERT INTO sessions (token, user_id, user_json, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, user.id, JSON.stringify(safeUser), new Date().toISOString())
  res.json({ token, user: safeUser })
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

  res.json({ user: JSON.parse(row.user_json) })
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
  const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  const result = sqlite.prepare(
    'INSERT INTO users (name, email, password_hash, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email, passwordHash, 'user', 'PRO', now)
  const userId = Number(result.lastInsertRowid)

  // Seed default data for the new user
  seedDefaultsForUser(userId, now)

  res.status(201).json({ id: userId, name, email, role: 'user', plan: 'PRO' })
})

// Admin-only: list all users
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can view users.' })
  }
  const users = sqlite.prepare('SELECT id, name, email, role, plan, created_at AS createdAt FROM users ORDER BY id').all()
  res.json(users)
})

// Admin-only: delete a user
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can delete users.' })
  }
  const id = parseInt(req.params.id, 10)
  if (id === req.user.id) {
    return res.status(400).json({ error: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account.' })
  }
  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
  sqlite.prepare('DELETE FROM users WHERE id = ?').run(id)
  res.status(204).end()
})

export default router
