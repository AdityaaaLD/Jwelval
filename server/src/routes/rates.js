import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()
const today = () => new Date().toISOString().slice(0, 10)

router.get('/', (req, res) => {
  const userId = req.user.id
  const date = req.query.date || today()
  const row = sqlite.prepare('SELECT rate_date AS rateDate, gold_rate_22k AS goldRate22k, gold_rate_24k AS goldRate24k FROM daily_rates WHERE rate_date = ? AND user_id = ?').get(date, userId)
  res.json(row || { rateDate: date, goldRate22k: 0, goldRate24k: 0 })
})

router.post('/', (req, res) => {
  const userId = req.user.id
  const rateDate = req.body.rateDate || today()
  const goldRate22k = Number(req.body.goldRate22k) || 0
  const goldRate24k = Number(req.body.goldRate24k) || +(goldRate22k * 24 / 22).toFixed(2)
  const now = new Date().toISOString()
  // Check if rate exists for this user+date
  const existing = sqlite.prepare('SELECT rowid FROM daily_rates WHERE rate_date = ? AND user_id = ?').get(rateDate, userId)
  if (existing) {
    sqlite.prepare('UPDATE daily_rates SET gold_rate_22k = ?, gold_rate_24k = ?, updated_at = ? WHERE rate_date = ? AND user_id = ?').run(goldRate22k, goldRate24k, now, rateDate, userId)
  } else {
    sqlite.prepare('INSERT INTO daily_rates (rate_date, gold_rate_22k, gold_rate_24k, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(rateDate, goldRate22k, goldRate24k, userId, now, now)
  }
  res.json({ rateDate, goldRate22k, goldRate24k })
})

export default router
