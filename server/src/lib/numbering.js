import { eq, sql } from 'drizzle-orm'
import { sqlite, db } from '../db/client.js'
import { valuationSeries } from '../db/schema.js'

const pad = (n, digits) => String(n).padStart(digits, '0')

export const formatNext = (series) =>
  `${series.prefix}-${pad(series.currentNumber + 1, series.numberOfDigits)}`

export const formatCustomerCode = (n) => `CUST-${String(n).padStart(4, '0')}`

// Atomically bump the series counter and return the new valuation number.
export function reserveNextValuationNumber(seriesId) {
  const txn = sqlite.transaction((id) => {
    const s = sqlite
      .prepare('SELECT * FROM valuation_series WHERE id = ?')
      .get(id)
    if (!s) throw new Error('Series not found')
    const next = (s.current_number || 0) + 1
    sqlite
      .prepare('UPDATE valuation_series SET current_number = ? WHERE id = ?')
      .run(next, id)
    return {
      number: `${s.prefix}-${String(next).padStart(s.number_of_digits, '0')}`,
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
