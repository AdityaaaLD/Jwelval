import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { valuationSeries } from '../db/schema.js'
import { previewNext } from '../lib/numbering.js'
import { ensureDefaultValuationSeriesForUser } from '../lib/defaultValuationSeries.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

router.get('/', async (req, res) => {
  const userId = req.user.id
  ensureDefaultValuationSeriesForUser(userId)
  const rows = await db.select().from(valuationSeries).where(eq(valuationSeries.userId, userId)).orderBy(desc(valuationSeries.id))
  const enriched = await Promise.all(
    rows.map(async (s) => ({ ...s, nextNumber: await previewNext(s.id) }))
  )
  res.json(enriched)
})

router.post(
  '/',
  body('seriesName').isString().trim().notEmpty(),
  body('prefix').isString().trim().notEmpty(),
  body('formatType').isIn(['RUSHIKESH', 'DNYANESHWARI', 'BANK_OF_MAHA', 'DIGITAL_CERT']),
  body('startingNumber').optional().isInt({ min: 0 }),
  body('numberOfDigits').optional().isInt({ min: 3, max: 6 }),
  validate,
  async (req, res) => {
    const userId = req.user.id
    const { seriesName, prefix, formatType, startingNumber = 0, numberOfDigits = 4 } = req.body
    const [created] = await db
      .insert(valuationSeries)
      .values({
        seriesName,
        prefix,
        formatType,
        currentNumber: Math.max(0, startingNumber - 1),
        numberOfDigits,
        userId,
        createdAt: new Date().toISOString(),
      })
      .returning()
    res.status(201).json(created)
  }
)

router.put('/:id', body('seriesName').isString().trim().notEmpty(), validate, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  await db
    .update(valuationSeries)
    .set({ seriesName: req.body.seriesName })
    .where(and(eq(valuationSeries.id, id), eq(valuationSeries.userId, userId)))
  const [updated] = await db.select().from(valuationSeries).where(eq(valuationSeries.id, id))
  res.json(updated)
})

router.get('/:id/next', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const next = await previewNext(id)
  if (!next) return res.status(404).json({ error: 'Not found' })
  res.json({ next })
})

export default router
