import { Router } from 'express'
import crypto from 'node:crypto'
import { sqlite } from '../db/client.js'

const router = Router()
const hash = (password) => crypto.createHash('sha256').update(password).digest('hex')

router.post('/login', (req, res) => {
  const { email, password } = req.body
  const user = sqlite.prepare('SELECT id, name, email, plan, password_hash FROM users WHERE email = ?').get(email)
  if (!user || user.password_hash !== hash(password || '')) {
    return res.status(401).json({ error: 'INVALID_LOGIN', message: 'Invalid email or password.' })
  }
  const token = crypto.randomBytes(24).toString('hex')
  const safeUser = { id: user.id, name: user.name, email: user.email, plan: user.plan }
  sqlite.prepare(
    'INSERT INTO sessions (token, user_id, user_json, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, user.id, JSON.stringify(safeUser), new Date().toISOString())
  res.json({ token, user: safeUser })
})

router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const row = sqlite.prepare('SELECT user_json FROM sessions WHERE token = ?').get(token)
  if (!row) return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Please login.' })
  res.json({ user: JSON.parse(row.user_json) })
})

router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (token) sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.status(204).end()
})

export default router
