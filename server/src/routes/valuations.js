import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { and, eq, desc, gte, lte } from 'drizzle-orm'
import { db, sqlite } from '../db/client.js'
import { valuations, valuationItems, customers, valuationSeries, payments } from '../db/schema.js'
import { reserveNextValuationNumber } from '../lib/numbering.js'
import { deriveItem, totalsFromItems, LOAN_LTV } from '../lib/compute.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

const isLocked = (status) => status === 'PRINTED' || status === 'LOCKED'

async function hydrate(valuationRow) {
  const items = await db
    .select()
    .from(valuationItems)
    .where(eq(valuationItems.valuationId, valuationRow.id))
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.valuationId, valuationRow.id))
  const [customer] = await db.select().from(customers).where(eq(customers.id, valuationRow.customerId))
  const [series] = await db.select().from(valuationSeries).where(eq(valuationSeries.id, valuationRow.seriesId))
  let ornamentPhotos = []
  try { ornamentPhotos = JSON.parse(valuationRow.ornamentPhotos || '[]') } catch {}
  return { ...valuationRow, ornamentPhotos, items, payments: pays, customer, series }
}

router.get('/', async (req, res) => {
  const { customer_id, status, format_type, date_from, date_to } = req.query
  const conds = []
  if (customer_id) conds.push(eq(valuations.customerId, parseInt(customer_id, 10)))
  if (status) conds.push(eq(valuations.status, status))
  if (format_type) conds.push(eq(valuations.formatType, format_type))
  if (date_from) conds.push(gte(valuations.valuationDate, date_from))
  if (date_to) conds.push(lte(valuations.valuationDate, date_to))

  const where = conds.length ? and(...conds) : undefined
  const rows = await db.select().from(valuations).where(where).orderBy(desc(valuations.id))
  const ids = rows.map((r) => r.customerId)
  const custs = ids.length
    ? sqlite.prepare(`SELECT id, customer_code, name, mobile FROM customers WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : []
  const byId = Object.fromEntries(custs.map((c) => [c.id, c]))
  res.json(
    rows.map((v) => ({
      ...v,
      customerName: byId[v.customerId]?.name || '',
      customerCode: byId[v.customerId]?.customer_code || '',
    }))
  )
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [v] = await db.select().from(valuations).where(eq(valuations.id, id))
  if (!v) return res.status(404).json({ error: 'Not found' })
  res.json(await hydrate(v))
})

router.post(
  '/',
  body('customerId').isInt(),
  body('seriesId').isInt(),
  body('goldRate22k').isFloat({ min: 0 }),
  body('items').isArray({ min: 1 }),
  validate,
  async (req, res) => {
    const {
      customerId,
      seriesId,
      branch,
      branchCode,
      acNo,
      applicationId,
      valuationDate,
      goldRate22k,
      goldRate24k,
      rateOfInterest,
      loanAmount,
      valuationFee,
      personPhoto,
      jewelleryPhoto,
      ornamentPhotos,
      items,
    } = req.body

    const reserved = reserveNextValuationNumber(seriesId)
    const derived = items.map((it) => deriveItem(it, goldRate22k))
    const totals = totalsFromItems(derived)
    const now = new Date().toISOString()
    const finalGoldRate24k = Number(goldRate24k) || +(Number(goldRate22k) * 24 / 22).toFixed(2)
    const finalLoan = loanAmount != null ? Number(loanAmount) : +(totals.marketValue * LOAN_LTV).toFixed(2)

    const [created] = await db
      .insert(valuations)
      .values({
        valuationNumber: reserved.number,
        seriesId,
        customerId,
        formatType: reserved.formatType,
        valuationDate: valuationDate || now.slice(0, 10),
        acNo: acNo || '',
        branch: branch || '',
        branchCode: branchCode || '',
        applicationId: applicationId || '',
        goldRate22k: Number(goldRate22k),
        goldRate24k: finalGoldRate24k,
        marketValue: +totals.marketValue.toFixed(2),
        loanAmount: finalLoan,
        valuationFee: valuationFee != null ? Number(valuationFee) : 0,
        rateOfInterest: rateOfInterest != null ? Number(rateOfInterest) : null,
        personPhoto: personPhoto || '',
        jewelleryPhoto: jewelleryPhoto || '',
        ornamentPhotos: JSON.stringify(ornamentPhotos || []),
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (derived.length) {
      await db.insert(valuationItems).values(
        derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: created.id, digitalId: it.digitalId || '' }))
      )
    }
    res.status(201).json(await hydrate(created))
  }
)

router.put('/:id', body('items').optional().isArray(), validate, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [existing] = await db.select().from(valuations).where(eq(valuations.id, id))
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (isLocked(existing.status)) {
    return res.status(403).json({
      error: 'DOCUMENT_LOCKED',
      message: 'This valuation has been printed and is permanently locked. No modifications are allowed.',
    })
  }
  const {
    branch,
    branchCode,
    acNo,
    applicationId,
    valuationDate,
    goldRate22k,
    goldRate24k,
    rateOfInterest,
    loanAmount,
    valuationFee,
    personPhoto,
    jewelleryPhoto,
    ornamentPhotos,
    items,
  } = req.body

  const rate22 = goldRate22k != null ? Number(goldRate22k) : existing.goldRate22k
  const rate24 = goldRate24k != null ? Number(goldRate24k) : existing.goldRate24k
  let derived = []
  let totals = { marketValue: existing.marketValue }
  if (Array.isArray(items)) {
    derived = items.map((it) => deriveItem(it, rate22))
    totals = totalsFromItems(derived)
  }

  await db
    .update(valuations)
    .set({
      branch: branch ?? existing.branch,
      branchCode: branchCode ?? existing.branchCode,
      acNo: acNo ?? existing.acNo,
      applicationId: applicationId ?? existing.applicationId,
      valuationDate: valuationDate ?? existing.valuationDate,
      goldRate22k: rate22,
      goldRate24k: rate24,
      rateOfInterest: rateOfInterest != null ? Number(rateOfInterest) : existing.rateOfInterest,
      personPhoto: personPhoto ?? existing.personPhoto,
      jewelleryPhoto: jewelleryPhoto ?? existing.jewelleryPhoto,
      ornamentPhotos: ornamentPhotos != null ? JSON.stringify(ornamentPhotos || []) : existing.ornamentPhotos,
      loanAmount: loanAmount != null ? Number(loanAmount) : +(totals.marketValue * LOAN_LTV).toFixed(2),
      valuationFee: valuationFee != null ? Number(valuationFee) : existing.valuationFee,
      marketValue: Array.isArray(items) ? +totals.marketValue.toFixed(2) : existing.marketValue,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(valuations.id, id))

  if (Array.isArray(items)) {
    await db.delete(valuationItems).where(eq(valuationItems.valuationId, id))
    if (derived.length) {
      await db.insert(valuationItems).values(
        derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: id, digitalId: it.digitalId || '' }))
      )
    }
  }

  const [v] = await db.select().from(valuations).where(eq(valuations.id, id))
  res.json(await hydrate(v))
})

router.post('/:id/duplicate', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [source] = await db.select().from(valuations).where(eq(valuations.id, id))
  if (!source) return res.status(404).json({ error: 'Not found' })
  const full = await hydrate(source)
  req.body = {
    customerId: req.body.customerId || full.customerId,
    seriesId: req.body.seriesId || full.seriesId,
    branch: full.branch,
    acNo: full.acNo,
    valuationDate: new Date().toISOString().slice(0, 10),
    goldRate22k: full.goldRate22k,
    goldRate24k: full.goldRate24k,
    rateOfInterest: full.rateOfInterest,
    valuationFee: full.valuationFee,
    loanAmount: full.loanAmount,
    items: full.items,
    personPhoto: '',
    jewelleryPhoto: '',
    ornamentPhotos: [],
  }
  const reserved = reserveNextValuationNumber(req.body.seriesId)
  const derived = req.body.items.map((it) => deriveItem(it, req.body.goldRate22k))
  const totals = totalsFromItems(derived)
  const now = new Date().toISOString()
  const [created] = await db.insert(valuations).values({
    valuationNumber: reserved.number,
    seriesId: req.body.seriesId,
    customerId: req.body.customerId,
    formatType: reserved.formatType,
    valuationDate: req.body.valuationDate,
    acNo: req.body.acNo || '',
    branch: req.body.branch || '',
    goldRate22k: Number(req.body.goldRate22k),
    goldRate24k: Number(req.body.goldRate24k),
    marketValue: +totals.marketValue.toFixed(2),
    loanAmount: +(totals.marketValue * LOAN_LTV).toFixed(2),
    valuationFee: Number(req.body.valuationFee) || 0,
    rateOfInterest: req.body.rateOfInterest != null ? Number(req.body.rateOfInterest) : null,
    personPhoto: '',
    jewelleryPhoto: '',
    ornamentPhotos: '[]',
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  }).returning()
  await db.insert(valuationItems).values(derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: created.id })))
  res.status(201).json(await hydrate(created))
})

router.post('/:id/mark-printed', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [existing] = await db.select().from(valuations).where(eq(valuations.id, id))
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const now = new Date().toISOString()
  await db
    .update(valuations)
    .set({ status: 'LOCKED', printedAt: now, updatedAt: now })
    .where(eq(valuations.id, id))
  console.log(`[lock] valuation ${id} printed by ${req.ip} at ${now}`)
  const [v] = await db.select().from(valuations).where(eq(valuations.id, id))
  res.json(await hydrate(v))
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const [existing] = await db.select().from(valuations).where(eq(valuations.id, id))
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'DRAFT') {
    return res.status(403).json({ error: 'NOT_DRAFT', message: 'Only DRAFT valuations can be deleted.' })
  }
  await db.delete(valuations).where(eq(valuations.id, id))
  res.status(204).end()
})

export default router
