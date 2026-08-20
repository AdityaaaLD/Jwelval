import { sqlite } from '../db/client.js'

/**
 * Ensures a default sell-bill series exists for the given user for the current
 * calendar year, e.g. "SELL-2026". This guarantees the Sell Bill form always
 * has at least one selectable series so bills can be created, and it rolls over
 * automatically each new year without any manual setup.
 *
 * Returns the number of series created (0 or 1).
 */
export function ensureDefaultBillSeriesForUser(userId, now = new Date().toISOString()) {
  const year = new Date(now).getFullYear() || new Date().getFullYear()
  const seriesName = `SELL-${year}`

  const existing = sqlite
    .prepare('SELECT id FROM bill_series WHERE user_id = ? AND series_name = ?')
    .get(userId, seriesName)
  if (existing) return 0

  sqlite
    .prepare(
      'INSERT INTO bill_series (series_name, prefix, current_number, number_of_digits, user_id, created_at) VALUES (?, ?, 0, 3, ?, ?)'
    )
    .run(seriesName, '', userId, now)
  return 1
}
