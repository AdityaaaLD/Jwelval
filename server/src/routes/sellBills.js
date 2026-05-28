import { Router } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { db, sqlite } from '../db/client.js'
import { sellBills, sellBillItems, customers, billSeries } from '../db/schema.js'

const router = Router()

function reserveNextBillNumber(seriesId) {
  const series = sqlite.prepare('SELECT * FROM bill_series WHERE id = ?').get(seriesId)
  if (!series) throw Object.assign(new Error('Bill series not found'), { status: 404 })
  const nextNum = series.current_number + 1
  sqlite.prepare('UPDATE bill_series SET current_number = ? WHERE id = ?').run(nextNum, seriesId)
  const padded = String(nextNum).padStart(series.number_of_digits, '0')
  return { number: series.prefix ? `${series.prefix}${padded}` : padded, seriesId }
}

async function hydrateBill(bill) {
  const items = await db.select().from(sellBillItems).where(eq(sellBillItems.billId, bill.id))
  const [customer] = await db.select().from(customers).where(eq(customers.id, bill.customerId))
  return { ...bill, items, customer }
}

router.get('/', async (req, res) => {
  const userId = req.user.id
  const rows = await db.select().from(sellBills).where(eq(sellBills.userId, userId)).orderBy(desc(sellBills.id))
  const ids = rows.map((r) => r.customerId)
  const custs = ids.length
    ? sqlite.prepare(`SELECT id, customer_code, name, mobile FROM customers WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : []
  const byId = Object.fromEntries(custs.map((c) => [c.id, c]))
  res.json(rows.map((b) => ({ ...b, customerName: byId[b.customerId]?.name || '' })))
})

router.get('/series', (req, res) => {
  const userId = req.user.id
  res.json(sqlite.prepare('SELECT id, series_name AS seriesName, prefix, current_number AS currentNumber, number_of_digits AS numberOfDigits FROM bill_series WHERE user_id = ? ORDER BY id').all(userId))
})

router.post('/series', (req, res) => {
  const userId = req.user.id
  const { seriesName, prefix, startingNumber = 0, numberOfDigits = 3 } = req.body
  if (!seriesName?.trim()) return res.status(400).json({ error: 'Series name required' })
  const r = sqlite.prepare('INSERT INTO bill_series (series_name, prefix, current_number, number_of_digits, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(seriesName.trim(), prefix || '', Math.max(0, startingNumber - 1), numberOfDigits, userId, new Date().toISOString())
  res.status(201).json(sqlite.prepare('SELECT id, series_name AS seriesName, prefix, current_number AS currentNumber, number_of_digits AS numberOfDigits FROM bill_series WHERE id = ?').get(r.lastInsertRowid))
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [bill] = await db.select().from(sellBills).where(and(eq(sellBills.id, id), eq(sellBills.userId, userId)))
  if (!bill) return res.status(404).json({ error: 'Not found' })
  res.json(await hydrateBill(bill))
})

router.post('/', async (req, res) => {
  const userId = req.user.id
  const { billSeriesId, valuationId, customerId, billDate, orderNo, chequeNo, chequeDate, bank, bankBranch, items, gstPercent = 3, advance = 0, paymentMode } = req.body
  if (!customerId) return res.status(400).json({ error: 'Customer required' })
  if (!billSeriesId) return res.status(400).json({ error: 'Bill series required' })

  const reserved = reserveNextBillNumber(billSeriesId)

  // Server-side amount: use provided amount, or compute from netWeight*rate+making
  const derivedItems = (items || []).map((it) => {
    const netWeight = Number(it.netWeight) || 0
    const rate = Number(it.rate) || 0
    const making = Number(it.making) || 0
    const amount = Number(it.amount) || +(netWeight * rate + making).toFixed(2)
    return { ...it, netWeight, rate, making, amount }
  })

  const subtotal = derivedItems.reduce((sum, it) => sum + it.amount, 0)
  const gstAmt = +(subtotal * (Number(gstPercent) / 100)).toFixed(2)
  const total = +(subtotal + gstAmt).toFixed(2)
  const balance = +(total - (Number(advance) || 0)).toFixed(2)
  const now = new Date().toISOString()

  const [created] = await db.insert(sellBills).values({
    billNumber: reserved.number,
    billSeriesId,
    valuationId: valuationId || null,
    customerId,
    billDate: billDate || now.slice(0, 10),
    orderNo: orderNo || '',
    chequeNo: chequeNo || '',
    chequeDate: chequeDate || '',
    bank: bank || '',
    bankBranch: bankBranch || '',
    subtotal,
    gstPercent: Number(gstPercent),
    gstAmount: gstAmt,
    total,
    advance: Number(advance) || 0,
    balance,
    paymentMode: paymentMode || '',
    userId,
    createdAt: now,
    updatedAt: now,
  }).returning()

  if (derivedItems.length) {
    await db.insert(sellBillItems).values(
      derivedItems.map((it, i) => ({
        billId: created.id,
        srNo: i + 1,
        particular: it.particular || '',
        karatPurity: it.karatPurity || '',
        pcs: Number(it.pcs) || 1,
        grossWeight: Number(it.grossWeight) || 0,
        netWeight: it.netWeight,
        rate: it.rate,
        making: it.making,
        amount: it.amount,
      }))
    )
  }
  res.status(201).json(await hydrateBill(created))
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  await db.delete(sellBills).where(and(eq(sellBills.id, id), eq(sellBills.userId, userId)))
  res.status(204).end()
})

export default router
