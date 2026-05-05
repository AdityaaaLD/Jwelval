import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { payments } from '../db/schema.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

router.get('/', async (req, res) => {
  const { valuation_id } = req.query
  let rows
  if (valuation_id) {
    rows = await db
      .select()
      .from(payments)
      .where(eq(payments.valuationId, parseInt(valuation_id, 10)))
      .orderBy(desc(payments.id))
  } else {
    rows = await db.select().from(payments).orderBy(desc(payments.id))
  }
  res.json(rows)
})

router.post(
  '/',
  body('valuationId').isInt(),
  body('paymentDate').isString().notEmpty(),
  body('amount').isFloat({ gt: 0 }),
    body('mode').isIn(['RECEIVABLE_FROM_BANK', 'CASH', 'UPI']),
  validate,
  async (req, res) => {
    const { valuationId, paymentDate, amount, mode, referenceNumber, notes } = req.body
    if (mode === 'UPI' && !referenceNumber) {
      return res.status(400).json({ error: 'REFERENCE_REQUIRED', message: 'UPI reference number required.' })
    }
    const [created] = await db
      .insert(payments)
      .values({
        valuationId,
        paymentDate,
        amount: Number(amount),
        mode,
        referenceNumber: referenceNumber || '',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      })
      .returning()
    res.status(201).json(created)
  }
)

router.delete('/:id', async (req, res) => {
  await db.delete(payments).where(eq(payments.id, parseInt(req.params.id, 10)))
  res.status(204).end()
})

export default router
