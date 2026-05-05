import { sqlite, db } from './client.js'
import { fileURLToPath } from 'node:url'
import { valuationSeries, customers, valuations, valuationItems, payments } from './schema.js'
import { eq } from 'drizzle-orm'
import { reserveNextValuationNumber } from '../lib/numbering.js'
import { deriveItem, totalsFromItems, LOAN_LTV } from '../lib/compute.js'

const today = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const DEMO_CUSTOMERS = [
  {
    name: 'Geetanjali Kaluram Aru',
    mobile: '9876543210',
    address: 'Bibwewadi, Pune',
    aadharNumber: '4321 5678 9012',
    savingsAcNo: '60123456789',
    bankName: 'Bank of Maharashtra',
    branch: 'Bibwewadi',
  },
  { name: 'Sunita Ramesh Patil', mobile: '9823456781', address: 'Kothrud, Pune', branch: 'Kothrud' },
  { name: 'Manoj Kumar Shah', mobile: '9912345678', address: 'Camp, Pune', branch: 'Camp' },
  { name: 'Priya Vijay Deshmukh', mobile: '9765432190', address: 'Hadapsar, Pune', branch: 'Hadapsar' },
  { name: 'Rahul Santosh More', mobile: '9654321087', address: 'Wakad, Pune', branch: 'Wakad' },
]

const ITEM_KINDS = [
  { description: 'Bangles', purityPercent: 86, gross: 45.2, net: 44.0 },
  { description: 'Necklace', purityPercent: 91.6, gross: 32.5, net: 31.8 },
  { description: 'Earrings', purityPercent: 75, gross: 12.4, net: 12.0, units: 2 },
  { description: 'Ring', purityPercent: 91.6, gross: 8.1, net: 7.9 },
  { description: 'Chain', purityPercent: 86, gross: 24.6, net: 24.0 },
]

const GOLD_RATE_22K = 7200
const GOLD_RATE_24K = +(GOLD_RATE_22K * 24 / 22).toFixed(2)

function pickItems(n, varianceSeed) {
  const out = []
  for (let i = 0; i < n; i++) {
    const k = ITEM_KINDS[(i + varianceSeed) % ITEM_KINDS.length]
    const variance = 1 + ((varianceSeed * (i + 1)) % 10) / 100
    out.push({
      description: k.description,
      noOfUnits: k.units || 1,
      purityPercent: k.purityPercent,
      grossWeightGm: +(k.gross * variance).toFixed(2),
      netWeightGm: +(k.net * variance).toFixed(2),
    })
  }
  return out
}

export async function resetAllData() {
  sqlite.exec(`
    DELETE FROM payments;
    DELETE FROM valuation_items;
    DELETE FROM valuations;
    DELETE FROM customers;
    UPDATE valuation_series SET current_number = 0;
  `)
}

export async function runDemoSeed() {
  const now = new Date().toISOString()

  // Customers
  const customerIds = []
  for (let i = 0; i < DEMO_CUSTOMERS.length; i++) {
    const c = DEMO_CUSTOMERS[i]
    const code = `CUST-${String(i + 1).padStart(4, '0')}`
    const r = sqlite
      .prepare(`INSERT INTO customers (customer_code, name, address, mobile, aadhar_number, aadhar_photo,
                savings_ac_no, bank_name, branch, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(code, c.name, c.address || '', c.mobile || '', c.aadharNumber || '',
           '', c.savingsAcNo || '', c.bankName || '', c.branch || '', now)
    customerIds.push(r.lastInsertRowid)
  }

  // Series IDs
  const allSeries = await db.select().from(valuationSeries)
  const seriesByFmt = Object.fromEntries(allSeries.map((s) => [s.formatType, s]))

  // 8 valuations across formats per spec
  const plan = [
    { fmt: 'RUSHIKESH',     status: 'DRAFT',  daysAgo: 0,  customerIdx: 0, items: 3 },
    { fmt: 'RUSHIKESH',     status: 'LOCKED', daysAgo: 5,  customerIdx: 1, items: 2 },
    { fmt: 'RUSHIKESH',     status: 'LOCKED', daysAgo: 12, customerIdx: 2, items: 4 },
    { fmt: 'DNYANESHWARI',  status: 'DRAFT',  daysAgo: 1,  customerIdx: 3, items: 3 },
    { fmt: 'DNYANESHWARI',  status: 'PRINTED',daysAgo: 7,  customerIdx: 4, items: 2 },
    { fmt: 'DNYANESHWARI',  status: 'PRINTED',daysAgo: 18, customerIdx: 0, items: 4 },
    { fmt: 'BANK_OF_MAHA',  status: 'DRAFT',  daysAgo: 2,  customerIdx: 1, items: 3 },
    { fmt: 'BANK_OF_MAHA',  status: 'LOCKED', daysAgo: 9,  customerIdx: 2, items: 2 },
  ]

  const createdValuationIds = []
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]
    const series = seriesByFmt[p.fmt]
    const reserved = reserveNextValuationNumber(series.id)
    const items = pickItems(p.items, i + 1)
    const derived = items.map((it) => deriveItem(it, GOLD_RATE_22K))
    const totals = totalsFromItems(derived)
    const created = new Date(); created.setDate(created.getDate() - p.daysAgo)
    const ts = created.toISOString()
    const vd = ts.slice(0, 10)
    const printedAt = p.status === 'DRAFT' ? null : ts

    const customer = sqlite.prepare('SELECT * FROM customers WHERE id = ?').get(customerIds[p.customerIdx])
    const r = sqlite.prepare(`
      INSERT INTO valuations (valuation_number, series_id, customer_id, format_type, valuation_date,
        ac_no, branch, gold_rate_22k, gold_rate_24k, market_value, loan_amount, valuation_fee, rate_of_interest,
        person_photo, jewellery_photo, status, printed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reserved.number, series.id, customer.id, p.fmt, vd,
      customer.savings_ac_no, customer.branch || 'Bibwewadi',
      GOLD_RATE_22K, GOLD_RATE_24K,
      +totals.marketValue.toFixed(2), +(totals.marketValue * LOAN_LTV).toFixed(2),
      750 + (i % 3) * 250, 9.5, '', '', p.status, printedAt, ts, ts
    )
    const valuationId = r.lastInsertRowid
    createdValuationIds.push({ id: valuationId, status: p.status, loan: +(totals.marketValue * LOAN_LTV).toFixed(2) })

    derived.forEach((it, idx) => {
      sqlite.prepare(`
        INSERT INTO valuation_items (valuation_id, sr_no, description, no_of_units, purity_percent,
          purity_carat, gross_weight_gm, net_weight_gm, net_24k_gold_gm, net_22k_gold_gm, approx_value_inr)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(valuationId, idx + 1, it.description, it.noOfUnits, it.purityPercent,
             it.purityCarat, it.grossWeightGm, it.netWeightGm,
             it.net24kGoldGm, it.net22kGoldGm, it.approxValueInr)
    })
  }

  // Payments — 5 records on locked/printed valuations
  const lockedOrPrinted = createdValuationIds.filter((v) => v.status !== 'DRAFT')
  const modes = ['CASH', 'RECEIVABLE_FROM_BANK', 'UPI', 'CASH', 'UPI']
  for (let i = 0; i < 5 && i < lockedOrPrinted.length; i++) {
    const v = lockedOrPrinted[i]
    const fee = sqlite.prepare('SELECT valuation_fee AS fee FROM valuations WHERE id = ?').get(v.id).fee
    sqlite.prepare(`
      INSERT INTO payments (valuation_id, payment_date, amount, mode, reference_number, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(v.id, today(-i * 2), fee,
           modes[i], modes[i] === 'UPI' ? `UPI${1000 + i}` : '',
           'Demo valuation fee', new Date().toISOString())
  }

  return {
    customers: customerIds.length,
    valuations: createdValuationIds.length,
    payments: Math.min(5, lockedOrPrinted.length),
  }
}

// Allow `node src/db/seed-demo.js` from the CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await resetAllData()
  const summary = await runDemoSeed()
  console.log('[seed-demo] inserted', summary)
  process.exit(0)
}
