import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/banks', (_req, res) => {
  res.json(sqlite.prepare('SELECT id, bank_name AS bankName, branch, rate_of_interest AS rateOfInterest, loan_ltv AS loanLtv, manager_name AS managerName, address, created_at AS createdAt FROM bank_presets ORDER BY bank_name, branch').all())
})

router.post('/banks', (req, res) => {
  const { bankName, branch, rateOfInterest, loanLtv, managerName, address } = req.body
  const r = sqlite.prepare(`
    INSERT INTO bank_presets (bank_name, branch, rate_of_interest, loan_ltv, manager_name, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(bankName, branch, Number(rateOfInterest) || null, Number(loanLtv) || null, managerName || '', address || '', new Date().toISOString())
  res.status(201).json(sqlite.prepare('SELECT id, bank_name AS bankName, branch, rate_of_interest AS rateOfInterest, loan_ltv AS loanLtv, manager_name AS managerName, address, created_at AS createdAt FROM bank_presets WHERE id = ?').get(r.lastInsertRowid))
})

export default router
