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
  const userId = req.user.id
  const { valuation_id } = req.query
  const where = [eq(payments.userId, userId)]
  if (valuation_id) {
    where.push(eq(payments.valuationId, parseInt(valuation_id, 10)))
  }
  const rows = await db.select().from(payments).where(where.length === 1 ? where[0] : where[1]).orderBy(desc(payments.id))
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
    const userId = req.user.id
    const { valuationId, paymentDate, amount, mode, referenceNumber, notes } = req.body
    // Ensure valuation belongs to this user
    const valRow = await db.query.valuations.findFirst({ where: (v, { eq }) => eq(v.id, valuationId) })
    if (!valRow || valRow.userId !== userId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Valuation not found for this user.' })
    }
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
        userId,
        createdAt: new Date().toISOString(),
      })
      .returning()
    res.status(201).json(created)
  }
)

router.delete('/:id', async (req, res) => {
  const userId = req.user.id
  const id = parseInt(req.params.id, 10)
  await db.delete(payments).where(and(eq(payments.id, id), eq(payments.userId, userId)))
  res.status(204).end()
})

export default router
