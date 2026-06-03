import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/:number', (req, res) => {
  const row = sqlite.prepare(`
    SELECT v.valuation_number AS valuationNumber, v.valuation_date AS valuationDate,
           v.status, v.printed_at AS printedAt, v.format_type AS formatType,
           v.user_id AS userId,
           c.name AS customerName, c.customer_code AS customerCode
    FROM valuations v
    JOIN customers c ON c.id = v.customer_id
    WHERE v.valuation_number = ?
  `).get(req.params.number)
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found.' })
  // Get valuer name from appraiser profile
  const profile = sqlite.prepare('SELECT appraiser_name FROM appraiser_profile WHERE user_id = ?').get(row.userId)
  const valuerName = profile?.appraiser_name || ''
  delete row.userId
  res.json({ ...row, valuerName, verified: row.status === 'LOCKED' || row.status === 'PRINTED' })
})

export default router
