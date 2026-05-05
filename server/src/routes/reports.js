import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/item-wise', (req, res) => {
  const { date_from, date_to, description, format_type } = req.query
  const where = []
  const args = []
  if (date_from) { where.push('v.valuation_date >= ?'); args.push(date_from) }
  if (date_to)   { where.push('v.valuation_date <= ?'); args.push(date_to) }
  if (description) { where.push('LOWER(i.description) LIKE ?'); args.push(`%${description.toLowerCase()}%`) }
  if (format_type && format_type !== 'ALL') { where.push('v.format_type = ?'); args.push(format_type) }

  const sql = `
    SELECT
      i.description AS description,
      COUNT(DISTINCT v.id) AS valuationCount,
      SUM(i.no_of_units) AS totalUnits,
      ROUND(SUM(i.gross_weight_gm), 3) AS totalGrossWt,
      ROUND(SUM(i.net_weight_gm), 3) AS totalNetWt,
      ROUND(SUM(i.net_24k_gold_gm), 3) AS total24kGm,
      ROUND(SUM(i.net_22k_gold_gm), 3) AS total22kGm,
      ROUND(SUM(i.approx_value_inr), 2) AS totalValue
    FROM valuation_items i
    JOIN valuations v ON v.id = i.valuation_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY i.description
    ORDER BY totalValue DESC
  `
  res.json(sqlite.prepare(sql).all(...args))
})

router.get('/customer-wise', (req, res) => {
  const { date_from, date_to, customer_id, status } = req.query
  const where = []
  const args = []
  if (date_from) { where.push('v.valuation_date >= ?'); args.push(date_from) }
  if (date_to)   { where.push('v.valuation_date <= ?'); args.push(date_to) }
  if (customer_id) { where.push('v.customer_id = ?'); args.push(parseInt(customer_id, 10)) }
  if (status && status !== 'ALL') { where.push('v.status = ?'); args.push(status) }

  const sql = `
    SELECT
      c.id AS customerId,
      c.customer_code AS customerCode,
      c.name AS customerName,
      c.mobile,
      COUNT(v.id) AS valuationCount,
      ROUND(COALESCE(SUM(v.market_value), 0), 2) AS totalMarketValue,
      ROUND(COALESCE(SUM(v.loan_amount), 0), 2) AS totalLoanAmount,
      ROUND(COALESCE(SUM(v.valuation_fee), 0), 2) AS totalValuationFee,
      ROUND(COALESCE(
        (SELECT SUM(p.amount)
         FROM payments p
         JOIN valuations v2 ON v2.id = p.valuation_id
         WHERE v2.customer_id = c.id
        ), 0
      ), 2) AS totalPayments
    FROM customers c
    JOIN valuations v ON v.customer_id = c.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY c.id
    ORDER BY totalMarketValue DESC
  `
  const rows = sqlite.prepare(sql).all(...args).map((r) => ({
    ...r,
    outstanding: +(r.totalValuationFee - r.totalPayments).toFixed(2),
  }))
  res.json(rows)
})

export default router
