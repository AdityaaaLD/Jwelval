import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { eq, and, desc } from 'drizzle-orm'
import { db, sqlite } from '../db/client.js'
import { customers, valuations } from '../db/schema.js'
import { formatCustomerCode } from '../lib/numbering.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

router.get('/', async (req, res) => {
  const userId = req.user.id
  const rows = sqlite.prepare(`
    SELECT c.id, c.customer_code AS customerCode, c.name, c.mobile,
           c.aadhar_number AS aadharNumber, c.savings_ac_no AS savingsAcNo,
           COUNT(v.id) AS valuationCount
    FROM customers c
    LEFT JOIN valuations v ON v.customer_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.id DESC
  `).all(userId)
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)))
  if (!c) return res.status(404).json({ error: 'Not found' })
  const vals = await db
    .select()
    .from(valuations)
    .where(and(eq(valuations.customerId, id), eq(valuations.userId, userId)))
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
    const userId = req.user.id
    const {
      name,
      mobile,
      alternateMobile,
      address,
      aadharNumber,
      aadharPhoto,
      aadharPhotoBack,
      panPhoto,
      customerPhoto,
      savingsAcNo,
      bankName,
      branch,
    } = req.body

    const txn = sqlite.transaction(() => {
      const row = sqlite.prepare('SELECT COUNT(*) AS n FROM customers WHERE user_id = ?').get(userId)
      const nextNum = (row?.n || 0) + 1
      const code = formatCustomerCode(nextNum)
      // If code already exists (edge case), append user id to make unique
      const exists = sqlite.prepare('SELECT 1 FROM customers WHERE customer_code = ?').get(code)
      const finalCode = exists ? `${code}-U${userId}` : code
      const insert = sqlite.prepare(`
        INSERT INTO customers (customer_code, name, address, mobile, alternate_mobile, aadhar_number, aadhar_photo,
                               aadhar_photo_back, pan_photo, customer_photo, savings_ac_no, bank_name, branch, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(finalCode, name, address || '', mobile || '', alternateMobile || '', aadharNumber || '', aadharPhoto || '',
             aadharPhotoBack || '', panPhoto || '', customerPhoto || '', savingsAcNo || '', bankName || '', branch || '', userId, now)
      return insert.lastInsertRowid
    })

    const id = txn()
    const [created] = await db.select().from(customers).where(eq(customers.id, id))
    res.status(201).json(created)
  }
)

router.put('/:id', body('name').isString().trim().notEmpty(), validate, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  // Verify ownership
  const [own] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)))
  if (!own) return res.status(404).json({ error: 'Not found' })

  const {
    name,
    mobile,
    alternateMobile,
    address,
    aadharNumber,
    aadharPhoto,
    aadharPhotoBack,
    panPhoto,
    customerPhoto,
    savingsAcNo,
    bankName,
    branch,
  } = req.body
  await db
    .update(customers)
    .set({
      name,
      mobile: mobile || '',
      alternateMobile: alternateMobile || '',
      address: address || '',
      aadharNumber: aadharNumber || '',
      aadharPhoto: aadharPhoto || '',
      aadharPhotoBack: aadharPhotoBack || '',
      panPhoto: panPhoto || '',
      customerPhoto: customerPhoto || '',
      savingsAcNo: savingsAcNo || '',
      bankName: bankName || '',
      branch: branch || '',
    })
    .where(and(eq(customers.id, id), eq(customers.userId, userId)))
  const [updated] = await db.select().from(customers).where(eq(customers.id, id))
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const has = sqlite.prepare('SELECT COUNT(*) AS n FROM valuations WHERE customer_id = ? AND user_id = ?').get(id, userId)
  if (has.n > 0) {
    return res.status(403).json({ error: 'HAS_VALUATIONS', message: 'Customer has valuations.' })
  }
  await db.delete(customers).where(and(eq(customers.id, id), eq(customers.userId, userId)))
  res.status(204).end()
})

export default router
