import { eq, sql } from 'drizzle-orm'
import { sqlite, db } from '../db/client.js'
import { valuationSeries } from '../db/schema.js'

const pad = (n, digits) => String(n).padStart(digits, '0')

export const formatNext = (series) =>
  `${series.prefix}-${pad(series.currentNumber + 1, series.numberOfDigits)}`

export const formatCustomerCode = (n) => `CUST-${String(n).padStart(4, '0')}`

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
