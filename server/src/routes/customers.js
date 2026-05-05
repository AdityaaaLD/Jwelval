import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { eq, sql, desc } from 'drizzle-orm'
import { db, sqlite } from '../db/client.js'
import { customers, valuations } from '../db/schema.js'
import { formatCustomerCode } from '../lib/numbering.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

router.get('/', async (_req, res) => {
  const rows = sqlite.prepare(`
    SELECT c.id, c.customer_code AS customerCode, c.name, c.mobile,
           c.aadhar_number AS aadharNumber,
           c.aadhar_photo AS aadharPhoto,
           COUNT(v.id) AS valuationCount
    FROM customers c
    LEFT JOIN valuations v ON v.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.id DESC
  `).all()
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [c] = await db.select().from(customers).where(eq(customers.id, id))
  if (!c) return res.status(404).json({ error: 'Not found' })
  const vals = await db
    .select()
    .from(valuations)
    .where(eq(valuations.customerId, id))
    .orderBy(desc(valuations.id))
  res.json({ ...c, valuations: vals })
})

router.post(
  '/',
  body('name').isString().trim().notEmpty(),
  body('mobile').optional({ nullable: true }).isString(),
  validate,
  async (req, res) => {
    const now = new Date().toISOString()
    const { name, mobile, address, aadharNumber, aadharPhoto, savingsAcNo, bankName, branch } = req.body

    const txn = sqlite.transaction(() => {
      const row = sqlite.prepare('SELECT MAX(id) AS m FROM customers').get()
      const nextId = (row?.m || 0) + 1
      const code = formatCustomerCode(nextId)
      const insert = sqlite.prepare(`
        INSERT INTO customers (customer_code, name, address, mobile, aadhar_number, aadhar_photo,
                               savings_ac_no, bank_name, branch, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(code, name, address || '', mobile || '', aadharNumber || '', aadharPhoto || '',
             savingsAcNo || '', bankName || '', branch || '', now)
      return insert.lastInsertRowid
    })

    const id = txn()
    const [created] = await db.select().from(customers).where(eq(customers.id, id))
    res.status(201).json(created)
  }
)

router.put('/:id', body('name').isString().trim().notEmpty(), validate, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const locked = sqlite.prepare(
    `SELECT COUNT(*) AS n FROM valuations WHERE customer_id = ? AND status IN ('PRINTED','LOCKED')`
  ).get(id)
  if (locked.n > 0) {
    return res.status(403).json({
      error: 'CUSTOMER_LOCKED',
      message: 'Customer has printed/locked valuations and cannot be edited.',
    })
  }
  const { name, mobile, address, aadharNumber, aadharPhoto, savingsAcNo, bankName, branch } = req.body
  await db
    .update(customers)
    .set({
      name,
      mobile: mobile || '',
      address: address || '',
      aadharNumber: aadharNumber || '',
      aadharPhoto: aadharPhoto || '',
      savingsAcNo: savingsAcNo || '',
      bankName: bankName || '',
      branch: branch || '',
    })
    .where(eq(customers.id, id))
  const [updated] = await db.select().from(customers).where(eq(customers.id, id))
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const has = sqlite.prepare('SELECT COUNT(*) AS n FROM valuations WHERE customer_id = ?').get(id)
  if (has.n > 0) {
    return res.status(403).json({ error: 'HAS_VALUATIONS', message: 'Customer has valuations.' })
  }
  await db.delete(customers).where(eq(customers.id, id))
  res.status(204).end()
})

export default router
