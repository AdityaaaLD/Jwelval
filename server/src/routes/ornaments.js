import { Router } from 'express'
import { sqlite } from '../db/client.js'
import { DEFAULT_ORNAMENTS } from '../lib/defaultOrnaments.js'

const router = Router()

router.get('/', (req, res) => {
  const userId = req.user.id
  // Ensure the baseline defaults exist for this user on every fetch. This is
  // idempotent and keeps each list isolated (rows scoped by user_id).
  const now = new Date().toISOString()
  const insertOrn = sqlite.prepare('INSERT OR IGNORE INTO ornament_master (name, user_id, created_at) VALUES (?, ?, ?)')
  const tx = sqlite.transaction(() => {
    for (const name of DEFAULT_ORNAMENTS) insertOrn.run(name, userId, now)
  })
  tx()

  const rows = sqlite.prepare('SELECT id, name, created_at AS createdAt FROM ornament_master WHERE user_id = ? ORDER BY name').all(userId)

  res.json(rows)
})

router.post('/', (req, res) => {
  const userId = req.user.id
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'VALIDATION', message: 'Ornament name is required.' })
  if (name.length > 80) return res.status(400).json({ error: 'VALIDATION', message: 'Ornament name is too long (max 80 characters).' })

  const dup = sqlite.prepare('SELECT id FROM ornament_master WHERE user_id = ? AND name = ? COLLATE NOCASE').get(userId, name)
  if (dup) return res.status(409).json({ error: 'DUPLICATE', message: 'This ornament already exists in your list.' })

  const r = sqlite.prepare('INSERT INTO ornament_master (name, user_id, created_at) VALUES (?, ?, ?)').run(name, userId, new Date().toISOString())
  res.status(201).json({ id: Number(r.lastInsertRowid), name })
})

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const name = String(req.body?.name || '').trim()
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'VALIDATION', message: 'Invalid ornament id.' })
  if (!name) return res.status(400).json({ error: 'VALIDATION', message: 'Ornament name is required.' })
  if (name.length > 80) return res.status(400).json({ error: 'VALIDATION', message: 'Ornament name is too long (max 80 characters).' })

  const existing = sqlite.prepare('SELECT id FROM ornament_master WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Ornament not found.' })

  const dup = sqlite.prepare('SELECT id FROM ornament_master WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?').get(userId, name, id)
  if (dup) return res.status(409).json({ error: 'DUPLICATE', message: 'This ornament already exists in your list.' })

  sqlite.prepare('UPDATE ornament_master SET name = ? WHERE id = ? AND user_id = ?').run(name, id, userId)
  res.json({ id, name })
})

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'VALIDATION', message: 'Invalid ornament id.' })

  const existing = sqlite.prepare('SELECT id FROM ornament_master WHERE id = ? AND user_id = ?').get(id, userId)
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Ornament not found.' })

  sqlite.prepare('DELETE FROM ornament_master WHERE id = ? AND user_id = ?').run(id, userId)
  res.status(204).end()
})

export default router
