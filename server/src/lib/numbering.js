import { eq, sql } from 'drizzle-orm'
import { sqlite, db } from '../db/client.js'
import { valuationSeries } from '../db/schema.js'

const pad = (n, digits) => String(n).padStart(digits, '0')

export const formatNext = (series) =>
  `${series.prefix}-${pad(series.currentNumber + 1, series.numberOfDigits)}`

export const formatCustomerCode = (n) => `CUST-${String(n).padStart(4, '0')}`

export function reserveNextCustomerCode(userId) {
  const txn = sqlite.transaction((id) => {
    const rows = sqlite
      .prepare('SELECT customer_code FROM customers WHERE user_id = ?')
      .all(id)
    let maxSeq = 0
    for (const row of rows) {
      const match = String(row.customer_code || '').match(/^CUST-(\d{1,10})$/)
      if (!match) continue
      const value = Number(match[1])
      if (Number.isInteger(value) && value > maxSeq) maxSeq = value
    }

    let next = maxSeq + 1
    let code = formatCustomerCode(next)
    let attempts = 0
    const check = sqlite.prepare('SELECT 1 FROM customers WHERE user_id = ? AND customer_code = ? LIMIT 1')
    while (check.get(id, code) && attempts < 100) {
      next += 1
      code = formatCustomerCode(next)
      attempts += 1
    }
    return code
  })

  return txn(userId)
}

// Atomically bump the series counter and return the new valuation number.
// Skips ahead if the generated number already exists (handles counter desync).
export function reserveNextValuationNumber(seriesId) {
  const txn = sqlite.transaction((id) => {
    const s = sqlite
      .prepare('SELECT * FROM valuation_series WHERE id = ?')
      .get(id)
    if (!s) throw new Error('Series not found')
    let next = (s.current_number || 0) + 1
    let number = `${s.prefix}-${String(next).padStart(s.number_of_digits, '0')}`
    // Skip numbers that already exist (prevents UNIQUE constraint collision)
    const check = sqlite.prepare('SELECT 1 FROM valuations WHERE valuation_number = ?')
    let attempts = 0
    while (check.get(number) && attempts < 100) {
      next++
      number = `${s.prefix}-${String(next).padStart(s.number_of_digits, '0')}`
      attempts++
    }
    sqlite
      .prepare('UPDATE valuation_series SET current_number = ? WHERE id = ?')
      .run(next, id)
    return {
      number,
      formatType: s.format_type,
    }
  })
  return txn(seriesId)
}

export async function previewNext(seriesId) {
  const [s] = await db.select().from(valuationSeries).where(eq(valuationSeries.id, seriesId))
  if (!s) return null
  return formatNext(s)
}

export { sql }
