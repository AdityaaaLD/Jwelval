import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/', (req, res) => {
  const userId = req.user.id
  res.json(sqlite.prepare('SELECT id, name, created_at AS createdAt FROM ornament_master WHERE user_id = ? ORDER BY name').all(userId))
})

router.post('/', (req, res) => {
  const userId = req.user.id
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  const r = sqlite.prepare('INSERT INTO ornament_master (name, user_id, created_at) VALUES (?, ?, ?)').run(name.trim(), userId, new Date().toISOString())
  res.status(201).json({ id: Number(r.lastInsertRowid), name: name.trim() })
})

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  sqlite.prepare('UPDATE ornament_master SET name = ? WHERE id = ? AND user_id = ?').run(name.trim(), id, userId)
  res.json({ id, name: name.trim() })
})

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  sqlite.prepare('DELETE FROM ornament_master WHERE id = ? AND user_id = ?').run(id, userId)
  res.status(204).end()
})

export default router
