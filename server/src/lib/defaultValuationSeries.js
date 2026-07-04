import { sqlite } from '../db/client.js'

export const DEFAULT_VALUATION_SERIES = [
  { seriesName: 'RUSH Default', prefix: 'RUSH', formatType: 'RUSHIKESH', numberOfDigits: 4, startingNumber: 1 },
  { seriesName: 'DNYAN Default', prefix: 'DNYAN', formatType: 'DNYANESHWARI', numberOfDigits: 4, startingNumber: 1 },
  { seriesName: 'BOM Default', prefix: 'BOM', formatType: 'BANK_OF_MAHA', numberOfDigits: 4, startingNumber: 1 },
  { seriesName: 'Digital Cert Default', prefix: 'GLCN', formatType: 'DIGITAL_CERT', numberOfDigits: 4, startingNumber: 1 },
]

export function ensureDefaultValuationSeriesForUser(userId, now = new Date().toISOString()) {
  const rows = sqlite
    .prepare('SELECT format_type FROM valuation_series WHERE user_id = ?')
    .all(userId)

  const existingFormats = new Set(rows.map((row) => row.format_type))
  const insert = sqlite.prepare(
    'INSERT INTO valuation_series (series_name, prefix, current_number, number_of_digits, format_type, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  let createdCount = 0
  for (const cfg of DEFAULT_VALUATION_SERIES) {
    if (existingFormats.has(cfg.formatType)) continue
    const currentNumber = Math.max(0, Number(cfg.startingNumber || 1) - 1)
    insert.run(
      cfg.seriesName,
      cfg.prefix,
      currentNumber,
      Number(cfg.numberOfDigits) || 4,
      cfg.formatType,
      userId,
      now
    )
    createdCount += 1
  }

  return createdCount
}
