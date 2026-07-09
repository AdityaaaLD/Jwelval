import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

const BANK_SELECT = `SELECT id, bank_name AS bankName, branch, branch_code AS branchCode, rate_of_interest AS rateOfInterest, loan_ltv AS loanLtv, empanelment_id AS empanelmentId, manager_name AS managerName, address, app_id_prefix AS appIdPrefix, app_id_current_number AS appIdCurrentNumber, app_id_digits AS appIdDigits, valuation_series_id AS valuationSeriesId, certificate_rules AS certificateRules, created_at AS createdAt FROM bank_presets`

router.get('/banks', (req, res) => {
  const userId = req.user.id
  res.json(sqlite.prepare(`${BANK_SELECT} WHERE user_id = ? ORDER BY bank_name, branch`).all(userId))
})

router.post('/banks', (req, res) => {
  const userId = req.user.id
  const { bankName, branch, branchCode, rateOfInterest, loanLtv, empanelmentId, managerName, address, appIdPrefix, appIdDigits, valuationSeriesId, certificateRules } = req.body
  const parsedSeriesId = Number(valuationSeriesId)
  const finalSeriesId = Number.isInteger(parsedSeriesId) && parsedSeriesId > 0 ? parsedSeriesId : null
  if (finalSeriesId) {
    const ownSeries = sqlite.prepare('SELECT id FROM valuation_series WHERE id = ? AND user_id = ?').get(finalSeriesId, userId)
    if (!ownSeries) return res.status(400).json({ error: 'SERIES_NOT_FOUND', message: 'Selected valuation series does not belong to this account.' })
  }
  const r = sqlite.prepare(`
    INSERT INTO bank_presets (bank_name, branch, branch_code, rate_of_interest, loan_ltv, empanelment_id, manager_name, address, app_id_prefix, app_id_current_number, app_id_digits, valuation_series_id, certificate_rules, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(bankName, branch || '', branchCode || '', Number(rateOfInterest) || null, Number(loanLtv) || null, empanelmentId || '', managerName || '', address || '', appIdPrefix || '', 0, Number(appIdDigits) || 10, finalSeriesId, certificateRules || '', userId, new Date().toISOString())
  res.status(201).json(sqlite.prepare(`${BANK_SELECT} WHERE id = ?`).get(r.lastInsertRowid))
})

router.put('/banks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const { bankName, branch, branchCode, rateOfInterest, loanLtv, empanelmentId, managerName, address, appIdPrefix, appIdDigits, valuationSeriesId, certificateRules } = req.body
  const parsedSeriesId = Number(valuationSeriesId)
  const finalSeriesId = Number.isInteger(parsedSeriesId) && parsedSeriesId > 0 ? parsedSeriesId : null
  if (finalSeriesId) {
    const ownSeries = sqlite.prepare('SELECT id FROM valuation_series WHERE id = ? AND user_id = ?').get(finalSeriesId, userId)
    if (!ownSeries) return res.status(400).json({ error: 'SERIES_NOT_FOUND', message: 'Selected valuation series does not belong to this account.' })
  }
  sqlite.prepare(`
    UPDATE bank_presets SET bank_name=?, branch=?, branch_code=?, rate_of_interest=?, loan_ltv=?, empanelment_id=?, manager_name=?, address=?, app_id_prefix=?, app_id_digits=?, valuation_series_id=?, certificate_rules=? WHERE id=? AND user_id=?
  `).run(bankName, branch || '', branchCode || '', Number(rateOfInterest) || null, Number(loanLtv) || null, empanelmentId || '', managerName || '', address || '', appIdPrefix || '', Number(appIdDigits) || 10, finalSeriesId, certificateRules || '', id, userId)
  res.json(sqlite.prepare(`${BANK_SELECT} WHERE id = ?`).get(id))
})

router.delete('/banks/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  sqlite.prepare('DELETE FROM bank_presets WHERE id = ? AND user_id = ?').run(id, userId)
  res.status(204).end()
})

router.post('/banks/:id/next-app-id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const preset = sqlite.prepare('SELECT * FROM bank_presets WHERE id = ? AND user_id = ?').get(id, userId)
  if (!preset) return res.status(404).json({ error: 'Preset not found' })
  const nextNum = preset.app_id_current_number + 1
  sqlite.prepare('UPDATE bank_presets SET app_id_current_number = ? WHERE id = ? AND user_id = ?').run(nextNum, id, userId)
  const padded = String(nextNum).padStart(preset.app_id_digits || 10, '0')
  const appId = preset.app_id_prefix ? `${preset.app_id_prefix}${padded}` : padded
  res.json({ applicationId: appId, currentNumber: nextNum })
})

router.get('/banks/:id/preview-app-id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const preset = sqlite.prepare('SELECT * FROM bank_presets WHERE id = ? AND user_id = ?').get(id, userId)
  if (!preset) return res.status(404).json({ error: 'Preset not found' })
  const nextNum = preset.app_id_current_number + 1
  const padded = String(nextNum).padStart(preset.app_id_digits || 10, '0')
  const appId = preset.app_id_prefix ? `${preset.app_id_prefix}${padded}` : padded
  res.json({ applicationId: appId })
})

export default router
