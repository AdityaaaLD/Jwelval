import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()
const today = () => new Date().toISOString().slice(0, 10)

router.get('/', (req, res) => {
  const date = req.query.date || today()
  const row = sqlite.prepare('SELECT rate_date AS rateDate, gold_rate_22k AS goldRate22k, gold_rate_24k AS goldRate24k FROM daily_rates WHERE rate_date = ?').get(date)
  res.json(row || { rateDate: date, goldRate22k: 0, goldRate24k: 0 })
})

router.post('/', (req, res) => {
  const rateDate = req.body.rateDate || today()
  const goldRate22k = Number(req.body.goldRate22k) || 0
  const goldRate24k = Number(req.body.goldRate24k) || +(goldRate22k * 24 / 22).toFixed(2)
  const now = new Date().toISOString()
  sqlite.prepare(`
    INSERT INTO daily_rates (rate_date, gold_rate_22k, gold_rate_24k, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(rate_date) DO UPDATE SET gold_rate_22k=excluded.gold_rate_22k, gold_rate_24k=excluded.gold_rate_24k, updated_at=excluded.updated_at
  `).run(rateDate, goldRate22k, goldRate24k, now, now)
  res.json({ rateDate, goldRate22k, goldRate24k })
})

export default router
