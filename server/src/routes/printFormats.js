import { Router } from 'express'
import { sqlite } from '../db/client.js'
import { logEvent } from '../lib/logger.js'
import { DOC_TYPES, PRINT_FORMATS, STANDARD_FORMAT, getFormat, isDocType, sanitizeOptions } from '../lib/printFormats.js'

/*
 * Print-format catalog and admin-only assignment of formats to users.
 * Users never choose their own format; only an admin can change assignments.
 */
const router = Router()

const forbidden = (res) => res.status(403).json({ error: 'FORBIDDEN', message: 'Only administrators can manage print formats.' })
const badRequest = (res, message) => res.status(400).json({ error: 'VALIDATION', message })

function parseJson(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function userPresets(userId) {
  return sqlite.prepare(`
    SELECT id, bank_name AS bankName, branch, branch_code AS branchCode
    FROM bank_presets WHERE user_id = ? ORDER BY bank_name, branch, id
  `).all(userId)
}

function userAssignments(userId) {
  return sqlite.prepare(`
    SELECT doc_type AS docType, bank_preset_id AS bankPresetId, format_id AS formatId, options_json AS optionsJson, updated_at AS updatedAt
    FROM print_format_assignments WHERE user_id = ? ORDER BY doc_type, bank_preset_id
  `).all(userId)
}

function userFormatState(userId) {
  const user = sqlite.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId)
  const presets = userPresets(userId)
  const presetIds = new Set(presets.map((p) => Number(p.id)))
  const assignments = userAssignments(userId)
    .filter((row) => isDocType(row.docType) && getFormat(row.docType, row.formatId))
    // Overrides for bank presets the user has since deleted are not shown.
    .filter((row) => Number(row.bankPresetId) === 0 || presetIds.has(Number(row.bankPresetId)))
    .map((row) => ({
      docType: row.docType,
      bankPresetId: Number(row.bankPresetId),
      formatId: row.formatId,
      options: sanitizeOptions(row.docType, row.formatId, parseJson(row.optionsJson)),
      updatedAt: row.updatedAt,
    }))
  return { user, bankPresets: presets, assignments }
}

// Catalog of available formats (labels + admin-editable options).
router.get('/', (_req, res) => {
  res.json({ standard: STANDARD_FORMAT, docTypes: DOC_TYPES, formats: PRINT_FORMATS })
})

// Admin: one line per user for the Manage Users list.
router.get('/summary', (req, res) => {
  if (req.user.role !== 'admin') return forbidden(res)
  const rows = sqlite.prepare(`
    SELECT user_id AS userId, doc_type AS docType, bank_preset_id AS bankPresetId, format_id AS formatId
    FROM print_format_assignments
  `).all()
  const summary = {}
  for (const row of rows) {
    if (!isDocType(row.docType) || !getFormat(row.docType, row.formatId)) continue
    const entry = summary[row.userId] || (summary[row.userId] = { VALUATION: STANDARD_FORMAT, SELL_BILL: STANDARD_FORMAT, bankOverrides: 0 })
    if (Number(row.bankPresetId) === 0) entry[row.docType] = row.formatId
    else entry.bankOverrides += 1
  }
  res.json(summary)
})

// Admin: a user's assignments plus their bank presets (for per-bank overrides).
router.get('/users/:userId', (req, res) => {
  if (req.user.role !== 'admin') return forbidden(res)
  const userId = parseInt(req.params.userId, 10)
  if (!Number.isInteger(userId) || userId <= 0) return badRequest(res, 'Invalid user id.')
  if (!sqlite.prepare('SELECT id FROM users WHERE id = ?').get(userId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })
  }
  res.json(userFormatState(userId))
})

/*
 * Admin: replace a user's assignments.
 * Body: { assignments: [{ docType, bankPresetId (0 = user default), formatId, options }] }
 * Scopes not listed are cleared (back to Standard / back to the user default).
 */
router.put('/users/:userId', (req, res) => {
  if (req.user.role !== 'admin') return forbidden(res)
  const userId = parseInt(req.params.userId, 10)
  if (!Number.isInteger(userId) || userId <= 0) return badRequest(res, 'Invalid user id.')
  const user = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' })

  const input = req.body?.assignments
  if (!Array.isArray(input)) return badRequest(res, 'assignments must be a list.')
  const presetIds = new Set(userPresets(userId).map((p) => Number(p.id)))
  if (input.length > DOC_TYPES.length * (presetIds.size + 1)) return badRequest(res, 'Too many assignments.')

  const clean = new Map()
  for (const entry of input) {
    const docType = String(entry?.docType || '')
    const bankPresetId = Number(entry?.bankPresetId) || 0
    const formatId = String(entry?.formatId || '')
    if (!isDocType(docType)) return badRequest(res, `Unknown document type "${docType}".`)
    if (!getFormat(docType, formatId)) return badRequest(res, `Unknown ${docType === 'VALUATION' ? 'valuation' : 'sell bill'} format "${formatId}".`)
    if (bankPresetId !== 0 && !presetIds.has(bankPresetId)) return badRequest(res, 'A selected bank preset does not belong to this user.')
    const key = `${docType}:${bankPresetId}`
    if (clean.has(key)) return badRequest(res, 'Each bank can have only one format per document type.')
    clean.set(key, { docType, bankPresetId, formatId, options: sanitizeOptions(docType, formatId, entry?.options) })
  }

  const now = new Date().toISOString()
  const upsert = sqlite.prepare(`
    INSERT INTO print_format_assignments (user_id, doc_type, bank_preset_id, format_id, options_json, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, doc_type, bank_preset_id) DO UPDATE SET
      format_id = excluded.format_id,
      options_json = excluded.options_json,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `)
  const clear = sqlite.prepare('DELETE FROM print_format_assignments WHERE id = ?')
  const save = sqlite.transaction(() => {
    for (const row of clean.values()) {
      upsert.run(userId, row.docType, row.bankPresetId, row.formatId, JSON.stringify(row.options), req.user.id, now, now)
    }
    // Configuration rows only (never document data): scopes no longer listed go back to the default.
    for (const row of sqlite.prepare('SELECT id, doc_type AS docType, bank_preset_id AS bankPresetId FROM print_format_assignments WHERE user_id = ?').all(userId)) {
      if (!clean.has(`${row.docType}:${Number(row.bankPresetId)}`)) clear.run(row.id)
    }
  })
  save.immediate()

  logEvent('PRINT_FORMATS_UPDATED', {
    adminId: req.user.id,
    userId,
    assignments: Array.from(clean.values()).map((row) => `${row.docType}:${row.bankPresetId}:${row.formatId}`),
  })
  res.json(userFormatState(userId))
})

export default router
