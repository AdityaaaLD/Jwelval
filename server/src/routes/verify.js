import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/:number', (req, res) => {
  const row = sqlite.prepare(`
    SELECT v.valuation_number AS valuationNumber, v.valuation_date AS valuationDate,
           v.market_value AS marketValue, v.loan_amount AS loanAmount, v.status,
           v.printed_at AS printedAt, v.format_type AS formatType,
           c.name AS customerName, c.customer_code AS customerCode
    FROM valuations v
    JOIN customers c ON c.id = v.customer_id
    WHERE v.valuation_number = ?
  `).get(req.params.number)
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found.' })
  res.json({ ...row, verified: row.status === 'LOCKED' || row.status === 'PRINTED' })
})

export default router
