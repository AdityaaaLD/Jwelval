import { sqlite } from '../db/client.js'

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Please login.' })
  }

  const row = sqlite.prepare('SELECT user_id, user_json, created_at FROM sessions WHERE token = ?').get(token)
  if (!row) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Session expired. Please login again.' })
  }

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

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    plan: user.plan,
    status: user.status,
    emailVerified: Boolean(user.email_verified),
  }
  sqlite.prepare('UPDATE sessions SET user_json = ? WHERE token = ?').run(JSON.stringify(safeUser), token)
  req.user = safeUser
  next()
}
