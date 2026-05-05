import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/', (_req, res) => {
  const monthStart = new Date()
  monthStart.setDate(1)
  const ymd = monthStart.toISOString().slice(0, 10)

  const totalCustomers = sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get().n
  const valuationsThisMonth = sqlite
    .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(market_value),0) AS v FROM valuations WHERE valuation_date >= ?')
    .get(ymd)
  const totalFee = sqlite.prepare('SELECT COALESCE(SUM(valuation_fee),0) AS v FROM valuations').get().v
  const totalPaid = sqlite.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM payments').get().v
  const recent = sqlite
    .prepare(`
      SELECT v.id, v.valuation_number AS valuationNumber, v.valuation_date AS valuationDate,
             v.market_value AS marketValue, v.status, v.format_type AS formatType,
             c.name AS customerName, c.customer_code AS customerCode
      FROM valuations v
      JOIN customers c ON c.id = v.customer_id
      ORDER BY v.id DESC
      LIMIT 10
    `)
    .all()

  res.json({
    totalCustomers,
    valuationsThisMonth: valuationsThisMonth.n,
    marketValueThisMonth: valuationsThisMonth.v,
    pendingPayments: +(totalFee - totalPaid).toFixed(2),
    recent,
  })
})

export default router
