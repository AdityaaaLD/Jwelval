import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { and, eq, desc, gte, lte } from 'drizzle-orm'
import { db, sqlite } from '../db/client.js'
import { valuations, valuationItems, customers, valuationSeries, payments } from '../db/schema.js'
import { reserveNextValuationNumber } from '../lib/numbering.js'
import { deriveItem, totalsFromItems, bankRecommendedFromRate, LOAN_LTV } from '../lib/compute.js'
import { ensureDefaultValuationSeriesForUser } from '../lib/defaultValuationSeries.js'
import { renderUrlToPdf } from '../lib/pdfRenderer.js'
import { logEvent, logErrorEvent } from '../lib/logger.js'

const router = Router()

const PDF_REQUEST_TIMEOUT_MS = Number(process.env.PDF_REQUEST_TIMEOUT_MS || 120000)

function printBaseUrl() {
  const configured = String(process.env.PDF_BASE_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  const port = parseInt(process.env.PORT || '3001', 10)
  return process.env.NODE_ENV === 'production'
    ? `http://127.0.0.1:${port}`
    : 'http://127.0.0.1:5173'
}

function normalizeUrl(raw) {
  return String(raw || '').trim().replace(/\/+$/, '')
}

function isLoopbackUrl(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function requestBaseUrl(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const proto = xfProto || req.protocol || 'http'
  const host = xfHost || req.get('host') || ''
  if (!host) return ''
  return normalizeUrl(`${proto}://${host}`)
}

function pickBestBaseUrl(candidates) {
  const urls = candidates.map(normalizeUrl).filter(Boolean)
  const nonLoopback = urls.filter((url) => !isLoopbackUrl(url))
  if (nonLoopback.length) {
    const https = nonLoopback.find((url) => url.startsWith('https://'))
    return https || nonLoopback[0]
  }
  return urls[0] || ''
}

function verificationBaseUrl(req) {
  const explicit = normalizeUrl(process.env.QR_VERIFY_BASE_URL || process.env.PUBLIC_APP_URL || '')
  if (explicit) return explicit

  const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeUrl(origin))
    .filter(Boolean)

  return pickBestBaseUrl([requestBaseUrl(req), ...corsOrigins])
}

for (const stmt of [
  'ALTER TABLE valuations ADD COLUMN bank_gold_rate_per_gram REAL',
  'ALTER TABLE valuations ADD COLUMN loan_ltv REAL',
  'ALTER TABLE valuations ADD COLUMN empanelment_id TEXT',
  'ALTER TABLE valuations ADD COLUMN gold_loan_register_no TEXT',
  'ALTER TABLE valuations ADD COLUMN gold_packets_no TEXT',
  'ALTER TABLE valuations ADD COLUMN renewal_date TEXT',
  'ALTER TABLE valuations ADD COLUMN tenure_months INTEGER',
  'ALTER TABLE valuations ADD COLUMN bank_preset_id INTEGER',
]) {
  try { sqlite.exec(stmt) } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      console.warn('[valuations] optional schema patch skipped:', error.message)
    }
  }
}

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  next()
}

const isLocked = (status) => status === 'PRINTED' || status === 'LOCKED'

function buildCustomerSnapshot(customerRow = {}) {
  return {
    id: customerRow.id,
    customerCode: customerRow.customerCode || customerRow.customer_code || '',
    name: customerRow.name || '',
    mobile: customerRow.mobile || '',
    alternateMobile: customerRow.alternateMobile || customerRow.alternate_mobile || '',
    address: customerRow.address || '',
    currentAddress: customerRow.currentAddress || customerRow.current_address || '',
    currentAddressDifferent: Boolean(customerRow.currentAddressDifferent ?? customerRow.current_address_different),
    aadharNumber: customerRow.aadharNumber || customerRow.aadhar_number || '',
    savingsAcNo: customerRow.savingsAcNo || customerRow.savings_ac_no || '',
    bankName: customerRow.bankName || customerRow.bank_name || '',
    branch: customerRow.branch || '',
    aadharPhoto: customerRow.aadharPhoto || customerRow.aadhar_photo || '',
    aadharPhotoBack: customerRow.aadharPhotoBack || customerRow.aadhar_photo_back || '',
    panPhoto: customerRow.panPhoto || customerRow.pan_photo || '',
    customerPhoto: customerRow.customerPhoto || customerRow.customer_photo || '',
  }
}

function parseCustomerSnapshot(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

async function hydrate(valuationRow) {
  const items = await db
    .select()
    .from(valuationItems)
    .where(eq(valuationItems.valuationId, valuationRow.id))
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.valuationId, valuationRow.id))
  const snapshotCustomer = parseCustomerSnapshot(valuationRow.customerSnapshot)
  const [liveCustomer] = await db.select().from(customers).where(eq(customers.id, valuationRow.customerId))
  const customer = snapshotCustomer
    ? { ...(liveCustomer || {}), ...snapshotCustomer }
    : liveCustomer || null
  const [series] = await db.select().from(valuationSeries).where(eq(valuationSeries.id, valuationRow.seriesId))
  let ornamentPhotos = []
  try { ornamentPhotos = JSON.parse(valuationRow.ornamentPhotos || '[]') } catch {}
  // Only the count here; the (large) signed-page images are served by /:id/signed-pages.
  const signedPageCount = sqlite
    .prepare('SELECT COUNT(*) AS n FROM valuation_signed_pages WHERE valuation_id = ?')
    .get(valuationRow.id).n
  return { ...valuationRow, ornamentPhotos, items, payments: pays, customer, series, signedPageCount }
}

const SIGNED_PAGE_MAX_COUNT = 30
const SIGNED_PAGE_MAX_CHARS = 12 * 1024 * 1024
const SIGNED_PAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

const httpError = (status, code, message) => Object.assign(new Error(message), { status, code })

function ownedValuationRow(id, userId) {
  const row = sqlite.prepare('SELECT id, status, signed_pages_locked_at FROM valuations WHERE id = ? AND user_id = ?').get(id, userId)
  if (!row) throw httpError(404, 'NOT_FOUND', 'Valuation not found.')
  return row
}

function assertSignedPagesEditable(row) {
  if (!isLocked(row.status)) {
    throw httpError(409, 'REPORT_NOT_FINALIZED', 'Print or share the report first. Signed pages can be added only to a finalized report.')
  }
  if (row.signed_pages_locked_at) {
    throw httpError(409, 'SIGNED_PAGES_LOCKED', 'Signed pages are already confirmed and locked.')
  }
}

function listSignedPages(valuationId, { withImages = true } = {}) {
  return sqlite.prepare(`
    SELECT id, page_no AS pageNo, created_at AS createdAt${withImages ? ', image' : ''}
    FROM valuation_signed_pages WHERE valuation_id = ? ORDER BY page_no
  `).all(valuationId)
}

const sendError = (res, error, fallbackCode) => res.status(error.status || 500).json({
  error: error.code || fallbackCode,
  message: error.status ? error.message : 'Something went wrong. Please try again.',
})

router.get('/', async (req, res) => {
  const userId = req.user.id
  const { customer_id, status, format_type, date_from, date_to } = req.query
  const conds = [eq(valuations.userId, userId)]
  if (customer_id) conds.push(eq(valuations.customerId, parseInt(customer_id, 10)))
  if (status) conds.push(eq(valuations.status, status))
  if (format_type) conds.push(eq(valuations.formatType, format_type))
  if (date_from) conds.push(gte(valuations.valuationDate, date_from))
  if (date_to) conds.push(lte(valuations.valuationDate, date_to))

  const where = and(...conds)
  const rows = await db
    .select({
      id: valuations.id,
      valuationNumber: valuations.valuationNumber,
      customerId: valuations.customerId,
      formatType: valuations.formatType,
      valuationDate: valuations.valuationDate,
      branch: valuations.branch,
      marketValue: valuations.marketValue,
      valuationFee: valuations.valuationFee,
      renewalDate: valuations.renewalDate,
      duplicateOfId: valuations.duplicateOfId,
      renewalRootId: valuations.renewalRootId,
      renewalNumber: valuations.renewalNumber,
      status: valuations.status,
      signedPagesLockedAt: valuations.signedPagesLockedAt,
      customerSnapshot: valuations.customerSnapshot,
    })
    .from(valuations)
    .where(where)
    .orderBy(desc(valuations.id))
  const ids = rows.map((r) => r.customerId)
  const custs = ids.length
    ? sqlite.prepare(`SELECT id, customer_code, name, mobile FROM customers WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : []
  const byId = Object.fromEntries(custs.map((c) => [c.id, c]))
  const renewalCounts = new Map()
  rows.forEach((v) => {
    if (Number(v.renewalNumber) <= 0 || !v.renewalRootId) return
    const rootId = Number(v.renewalRootId)
    renewalCounts.set(rootId, Math.max(renewalCounts.get(rootId) || 0, Number(v.renewalNumber)))
  })
  res.json(rows.map((v) => {
    const snapshot = parseCustomerSnapshot(v.customerSnapshot)
    const { customerSnapshot, ...rest } = v
    const renewalCount = renewalCounts.get(Number(v.renewalRootId) || Number(v.id)) || 0
    return {
      ...rest,
      hasRenewal: Number(v.renewalNumber) < renewalCount,
      renewalCount,
      customerName: snapshot?.name || byId[v.customerId]?.name || '',
      customerCode: snapshot?.customerCode || byId[v.customerId]?.customer_code || '',
    }
  }))
})

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [v] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  if (!v) return res.status(404).json({ error: 'Not found' })
  res.json(await hydrate(v))
})

router.get('/:id/pdf', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [v] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  if (!v) return res.status(404).json({ error: 'NOT_FOUND', message: 'Valuation not found.' })

  req.setTimeout(PDF_REQUEST_TIMEOUT_MS)
  res.setTimeout(PDF_REQUEST_TIMEOUT_MS)

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  // This PDF is the copy that gets shared with the bank, so the borrower's KYC
  // sheet is left out unless it is explicitly asked for.
  const includeKyc = String(req.query.includeKyc || '') === '1'
  const printUrl = new URL(`${printBaseUrl()}/print/valuation/${id}`)
  printUrl.searchParams.set('kyc', includeKyc ? '1' : '0')
  const qrBase = verificationBaseUrl(req)
  if (qrBase) printUrl.searchParams.set('qrBase', qrBase)
  const url = printUrl.toString()
  const startedAt = Date.now()

  try {
    const pdf = await renderUrlToPdf({ url, authToken: token })
    const safeName = String(v.valuationNumber || `valuation-${id}`).replace(/[^a-z0-9-_]+/gi, '_')
    logEvent('PDF_GENERATED', { valuationId: id, bytes: pdf.length, includeKyc, ms: Date.now() - startedAt })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', String(pdf.length))
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
    res.setHeader('Cache-Control', 'no-store')
    return res.end(pdf)
  } catch (error) {
    logErrorEvent('PDF_GENERATION_FAILED', error, { valuationId: id, url, ms: Date.now() - startedAt })
    const status = error.code === 'PDF_BROWSER_MISSING' || error.code === 'PDF_ENGINE_MISSING' ? 503 : 500
    return res.status(status).json({
      error: error.code || 'PDF_FAILED',
      message: 'Could not generate the PDF right now. Please try again.',
    })
  }
})

router.post(
  '/',
  body('customerId').isInt(),
  body('seriesId').optional({ nullable: true }).isInt(),
  body('goldRate22k').isFloat({ gt: 0 }).withMessage('Gold rate must be greater than zero'),
  body('items').isArray({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const {
        customerId,
        seriesId,
        branch,
        branchCode,
        empanelmentId,
        acNo,
        applicationId,
        goldLoanRegisterNo,
        goldPacketsNo,
        renewalDate,
        tenureMonths,
        bankPresetId,
        valuationDate,
        goldRate22k,
        goldRate24k,
        bankGoldRatePerGram,
        loanLtv,
        rateOfInterest,
        loanAmount,
        bankRecommendedValue,
        valuationFee,
        loanType,
        personPhoto,
        jewelleryPhoto,
        ornamentPhotos,
        aadharPhotoDoc,
        panPhoto,
        certificateRules,
        items,
      } = req.body

      const userId = req.user.id
      ensureDefaultValuationSeriesForUser(userId)

      let selectedSeriesId = Number(seriesId)
      if (!Number.isInteger(selectedSeriesId) || selectedSeriesId <= 0) {
        const fallbackSeries = sqlite
          .prepare('SELECT id FROM valuation_series WHERE user_id = ? ORDER BY CASE WHEN format_type = ? THEN 0 ELSE 1 END, id DESC LIMIT 1')
          .get(userId, 'DIGITAL_CERT')
        selectedSeriesId = Number(fallbackSeries?.id || 0)
      }

      const [customerRow] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, Number(customerId)), eq(customers.userId, userId)))
      if (!customerRow) {
        return res.status(400).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Selected customer was not found.' })
      }

      const [seriesRow] = await db
        .select()
        .from(valuationSeries)
        .where(and(eq(valuationSeries.id, selectedSeriesId), eq(valuationSeries.userId, userId)))
      if (!seriesRow) {
        return res.status(400).json({
          error: 'SERIES_NOT_FOUND',
          message: 'No number series configured for this account. Create one in Settings > Number Series.',
        })
      }

      const reserved = reserveNextValuationNumber(selectedSeriesId)

      let finalCertificateRules = certificateRules || ''
      if (!finalCertificateRules && bankPresetId) {
        const preset = sqlite.prepare('SELECT certificate_rules FROM bank_presets WHERE id = ? AND user_id = ?').get(bankPresetId, userId)
        if (preset?.certificate_rules) finalCertificateRules = preset.certificate_rules
      }

      let finalApplicationId = applicationId || ''
      if (bankPresetId && applicationId) {
        const preset = sqlite.prepare('SELECT * FROM bank_presets WHERE id = ? AND user_id = ?').get(bankPresetId, userId)
        if (preset && preset.app_id_prefix) {
          const nextNum = preset.app_id_current_number + 1
          sqlite.prepare('UPDATE bank_presets SET app_id_current_number = ? WHERE id = ?').run(nextNum, bankPresetId)
          const padded = String(nextNum).padStart(preset.app_id_digits || 10, '0')
          finalApplicationId = `${preset.app_id_prefix}${padded}`
        }
      }

      const derived = items.map((it) => deriveItem(it, goldRate22k))
      const totals = totalsFromItems(derived)
      const now = new Date().toISOString()
      const finalGoldRate24k = Number(goldRate24k) || +(Number(goldRate22k) * 24 / 22).toFixed(2)
      const finalLoan = loanAmount != null ? Number(loanAmount) : +(totals.marketValue * LOAN_LTV).toFixed(2)
      // Derived on the server so the printed figure can never drift from the items.
      const finalBankValue = bankRecommendedFromRate(totals.net, bankGoldRatePerGram)

      const [created] = await db
        .insert(valuations)
        .values({
          valuationNumber: reserved.number,
          seriesId: selectedSeriesId,
          customerId,
          formatType: reserved.formatType,
          valuationDate: valuationDate || now.slice(0, 10),
          acNo: acNo || '',
          branch: branch || '',
          branchCode: branchCode || '',
          empanelmentId: empanelmentId || '',
          applicationId: finalApplicationId,
          bankPresetId: bankPresetId != null && bankPresetId !== '' ? Number(bankPresetId) : null,
          goldLoanRegisterNo: goldLoanRegisterNo || '',
          goldPacketsNo: goldPacketsNo || '',
          renewalDate: renewalDate || null,
          tenureMonths: tenureMonths != null && tenureMonths !== '' ? Number(tenureMonths) : null,
          goldRate22k: Number(goldRate22k),
          goldRate24k: finalGoldRate24k,
          bankGoldRatePerGram: bankGoldRatePerGram != null ? Number(bankGoldRatePerGram) : null,
          loanLtv: loanLtv != null ? Number(loanLtv) : null,
          marketValue: +totals.marketValue.toFixed(2),
          loanAmount: finalLoan,
          bankRecommendedValue: finalBankValue != null
            ? finalBankValue
            : (bankRecommendedValue != null ? Number(bankRecommendedValue) : null),
          valuationFee: valuationFee != null ? Number(valuationFee) : 0,
          rateOfInterest: rateOfInterest != null ? Number(rateOfInterest) : null,
          loanType: loanType || '',
          personPhoto: personPhoto || '',
          jewelleryPhoto: jewelleryPhoto || '',
          ornamentPhotos: JSON.stringify(ornamentPhotos || []),
          aadharPhotoDoc: aadharPhotoDoc || '',
          panPhoto: panPhoto || '',
          customerSnapshot: JSON.stringify(buildCustomerSnapshot(customerRow)),
          certificateRules: finalCertificateRules,
          status: 'DRAFT',
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      if (derived.length) {
        await db.insert(valuationItems).values(
          derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: created.id }))
        )
      }
      res.status(201).json(await hydrate(created))
    } catch (error) {
      const msg = String(error?.message || '')
      console.error('[valuations] create failed:', error)
      if (msg.includes('no column named') || msg.includes('has no column named')) {
        return res.status(500).json({
          error: 'SCHEMA_OUTDATED',
          message: 'Database schema update is pending. Please restart server once and try again.',
        })
      }
      return res.status(500).json({ error: 'VALUATION_SAVE_FAILED', message: 'Unable to save valuation. Please try again.' })
    }
  }
)

router.put('/:id', body('items').optional().isArray(), validate, async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [existing] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
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
    empanelmentId,
    acNo,
    applicationId,
    goldLoanRegisterNo,
    goldPacketsNo,
    renewalDate,
    tenureMonths,
    valuationDate,
    goldRate22k,
    goldRate24k,
    bankGoldRatePerGram,
    loanLtv,
    rateOfInterest,
    loanAmount,
    bankRecommendedValue,
    valuationFee,
    loanType,
    personPhoto,
    jewelleryPhoto,
    ornamentPhotos,
    aadharPhotoDoc,
    panPhoto,
    certificateRules,
    bankPresetId,
    items,
  } = req.body

  const rate22 = goldRate22k != null ? Number(goldRate22k) : existing.goldRate22k
  const rate24 = goldRate24k != null ? Number(goldRate24k) : existing.goldRate24k
  let derived = []
  let totals = { marketValue: existing.marketValue, net: null }
  if (Array.isArray(items)) {
    derived = items.map((it) => deriveItem(it, rate22))
    totals = totalsFromItems(derived)
  }

  const nextBankRate = bankGoldRatePerGram != null ? Number(bankGoldRatePerGram) : existing.bankGoldRatePerGram
  const recomputedBankValue = totals.net != null ? bankRecommendedFromRate(totals.net, nextBankRate) : null

  await db
    .update(valuations)
    .set({
      branch: branch ?? existing.branch,
      branchCode: branchCode ?? existing.branchCode,
      acNo: acNo ?? existing.acNo,
      applicationId: applicationId ?? existing.applicationId,
      bankPresetId: bankPresetId != null ? Number(bankPresetId) : existing.bankPresetId,
      goldLoanRegisterNo: goldLoanRegisterNo ?? existing.goldLoanRegisterNo,
      goldPacketsNo: goldPacketsNo ?? existing.goldPacketsNo,
      renewalDate: renewalDate ?? existing.renewalDate,
      tenureMonths: tenureMonths != null ? Number(tenureMonths) : existing.tenureMonths,
      valuationDate: valuationDate ?? existing.valuationDate,
      empanelmentId: empanelmentId ?? existing.empanelmentId,
      goldRate22k: rate22,
      goldRate24k: rate24,
      bankGoldRatePerGram: nextBankRate,
      loanLtv: loanLtv != null ? Number(loanLtv) : existing.loanLtv,
      rateOfInterest: rateOfInterest != null ? Number(rateOfInterest) : existing.rateOfInterest,
      loanType: loanType ?? existing.loanType,
      personPhoto: personPhoto ?? existing.personPhoto,
      jewelleryPhoto: jewelleryPhoto ?? existing.jewelleryPhoto,
      ornamentPhotos: ornamentPhotos != null ? JSON.stringify(ornamentPhotos || []) : existing.ornamentPhotos,
      aadharPhotoDoc: aadharPhotoDoc ?? existing.aadharPhotoDoc,
      panPhoto: panPhoto ?? existing.panPhoto,
      certificateRules: certificateRules ?? existing.certificateRules,
      loanAmount: loanAmount != null ? Number(loanAmount) : +(totals.marketValue * LOAN_LTV).toFixed(2),
      bankRecommendedValue: recomputedBankValue != null
        ? recomputedBankValue
        : (bankRecommendedValue != null ? Number(bankRecommendedValue) : existing.bankRecommendedValue),
      valuationFee: valuationFee != null ? Number(valuationFee) : existing.valuationFee,
      marketValue: Array.isArray(items) ? +totals.marketValue.toFixed(2) : existing.marketValue,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(valuations.id, id), eq(valuations.userId, userId)))

  if (Array.isArray(items)) {
    await db.delete(valuationItems).where(eq(valuationItems.valuationId, id))
    if (derived.length) {
      await db.insert(valuationItems).values(
        derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: id }))
      )
    }
  }

  const [v] = await db.select().from(valuations).where(eq(valuations.id, id))
  res.json(await hydrate(v))
})

router.post('/:id/duplicate', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [source] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  if (!source) return res.status(404).json({ error: 'Not found' })
  const full = await hydrate(source)
  const derived = full.items.map((it) => deriveItem(it, full.goldRate22k))
  const totals = totalsFromItems(derived)
  const targetCustomerId = Number(req.body.customerId || full.customerId)
  let targetSnapshot = parseCustomerSnapshot(source.customerSnapshot)
  if (!targetSnapshot || Number(targetCustomerId) !== Number(full.customerId)) {
    const [targetCustomer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, Number(targetCustomerId)), eq(customers.userId, userId)))
    if (!targetCustomer) {
      return res.status(400).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Selected customer was not found.' })
    }
    targetSnapshot = buildCustomerSnapshot(targetCustomer)
  }

  const reserved = reserveNextValuationNumber(req.body.seriesId || full.seriesId)
  const now = new Date().toISOString()
  const [created] = await db.insert(valuations).values({
    valuationNumber: reserved.number,
    seriesId: req.body.seriesId || full.seriesId,
    customerId: targetCustomerId,
    formatType: reserved.formatType,
    valuationDate: full.valuationDate || new Date().toISOString().slice(0, 10),
    acNo: full.acNo || '',
    branch: full.branch || '',
    branchCode: full.branchCode || '',
    applicationId: full.applicationId || '',
    bankPresetId: full.bankPresetId != null ? Number(full.bankPresetId) : null,
    goldLoanRegisterNo: full.goldLoanRegisterNo || '',
    goldPacketsNo: full.goldPacketsNo || '',
    renewalDate: full.renewalDate || null,
    duplicateOfId: source.id,
    renewalRootId: null,
    renewalNumber: 0,
    tenureMonths: full.tenureMonths != null ? Number(full.tenureMonths) : null,
    goldRate22k: Number(full.goldRate22k),
    goldRate24k: Number(full.goldRate24k),
    marketValue: +totals.marketValue.toFixed(2),
    loanAmount: full.loanAmount != null ? Number(full.loanAmount) : +(totals.marketValue * LOAN_LTV).toFixed(2),
    bankGoldRatePerGram: full.bankGoldRatePerGram != null ? Number(full.bankGoldRatePerGram) : null,
    loanLtv: full.loanLtv != null ? Number(full.loanLtv) : null,
    bankRecommendedValue: bankRecommendedFromRate(totals.net, full.bankGoldRatePerGram),
    valuationFee: Number(full.valuationFee) || 0,
    rateOfInterest: full.rateOfInterest != null ? Number(full.rateOfInterest) : null,
    loanType: full.loanType || '',
    certificateRules: full.certificateRules || '',
    personPhoto: full.personPhoto || '',
    jewelleryPhoto: full.jewelleryPhoto || '',
    ornamentPhotos: JSON.stringify(full.ornamentPhotos || []),
    aadharPhotoDoc: full.aadharPhotoDoc || '',
    panPhoto: full.panPhoto || '',
    customerSnapshot: JSON.stringify(targetSnapshot),
    status: 'DRAFT',
    userId,
    createdAt: now,
    updatedAt: now,
  }).returning()
  await db.insert(valuationItems).values(derived.map((it, i) => ({ ...it, srNo: i + 1, valuationId: created.id })))
  res.status(201).json(await hydrate(created))
})

router.post('/:id/mark-renewed', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const now = new Date().toISOString()

  try {
    const markRenewed = sqlite.transaction(() => {
      const target = sqlite.prepare('SELECT * FROM valuations WHERE id = ? AND user_id = ?').get(id, userId)
      if (!target) throw Object.assign(new Error('Valuation not found.'), { status: 404, code: 'NOT_FOUND' })
      if (Number(target.renewal_number) > 0) return target
      if (target.status !== 'DRAFT') {
        throw Object.assign(new Error('Only an editable draft can be marked as renewed.'), { status: 409, code: 'DOCUMENT_LOCKED' })
      }
      if (!target.duplicate_of_id) {
        throw Object.assign(new Error('Duplicate a valuation before marking it as renewed.'), { status: 400, code: 'NOT_A_DUPLICATE' })
      }

      const source = sqlite.prepare('SELECT * FROM valuations WHERE id = ? AND user_id = ?').get(target.duplicate_of_id, userId)
      if (!source || Number(source.customer_id) !== Number(target.customer_id)) {
        throw Object.assign(new Error('The source valuation for this renewal is unavailable.'), { status: 409, code: 'INVALID_RENEWAL_SOURCE' })
      }

      const rootId = Number(source.renewal_root_id) || Number(source.id)
      const next = sqlite.prepare(`
        SELECT COALESCE(MAX(renewal_number), 0) + 1 AS n
        FROM valuations
        WHERE user_id = ? AND renewal_root_id = ?
      `).get(userId, rootId).n

      sqlite.prepare(`
        UPDATE valuations
        SET renewal_root_id = ?, renewal_number = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND renewal_number = 0
      `).run(rootId, next, now, id, userId)

      return sqlite.prepare('SELECT * FROM valuations WHERE id = ? AND user_id = ?').get(id, userId)
    })

    markRenewed.immediate()
    const [updated] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
    return res.json(await hydrate(updated))
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.code || 'RENEWAL_FAILED',
      message: error.message || 'Valuation could not be marked as renewed.',
    })
  }
})

router.post('/:id/mark-printed', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [existing] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const now = new Date().toISOString()
  await db
    .update(valuations)
    .set({ status: 'LOCKED', printedAt: now, updatedAt: now })
    .where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  console.log(`[lock] valuation ${id} printed by ${req.ip} at ${now}`)
  const [v] = await db.select().from(valuations).where(eq(valuations.id, id))
  res.json(await hydrate(v))
})

/* ---- Bank-signed copy pages ----
   Added after the report is finalized; editable (add/remove) until the
   appraiser confirms them, then permanently locked. Shown in preview/print
   only — never in the shared PDF. */
router.get('/:id/signed-pages', (req, res) => {
  try {
    const row = ownedValuationRow(parseInt(req.params.id, 10), req.user.id)
    res.json({ lockedAt: row.signed_pages_locked_at || null, pages: listSignedPages(row.id) })
  } catch (error) {
    sendError(res, error, 'SIGNED_PAGES_FAILED')
  }
})

router.post('/:id/signed-pages', (req, res) => {
  const image = String(req.body?.image || '')
  if (!SIGNED_PAGE_DATA_URL.test(image) || image.length > SIGNED_PAGE_MAX_CHARS) {
    return res.status(400).json({ error: 'INVALID_IMAGE', message: 'Please upload a valid photo (JPEG/PNG) under 9 MB.' })
  }
  try {
    const add = sqlite.transaction(() => {
      const row = ownedValuationRow(parseInt(req.params.id, 10), req.user.id)
      assertSignedPagesEditable(row)
      const { n, maxPage } = sqlite.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(page_no), 0) AS maxPage FROM valuation_signed_pages WHERE valuation_id = ?').get(row.id)
      if (n >= SIGNED_PAGE_MAX_COUNT) throw httpError(409, 'TOO_MANY_PAGES', `A maximum of ${SIGNED_PAGE_MAX_COUNT} signed pages can be added.`)
      const info = sqlite.prepare('INSERT INTO valuation_signed_pages (valuation_id, user_id, page_no, image, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(row.id, req.user.id, maxPage + 1, image, new Date().toISOString())
      return { id: Number(info.lastInsertRowid), pageNo: maxPage + 1 }
    })
    const page = add.immediate()
    res.status(201).json(page)
  } catch (error) {
    sendError(res, error, 'SIGNED_PAGE_ADD_FAILED')
  }
})

router.delete('/:id/signed-pages/:pageId', (req, res) => {
  try {
    const remove = sqlite.transaction(() => {
      const row = ownedValuationRow(parseInt(req.params.id, 10), req.user.id)
      assertSignedPagesEditable(row)
      const info = sqlite.prepare('DELETE FROM valuation_signed_pages WHERE id = ? AND valuation_id = ?').run(parseInt(req.params.pageId, 10), row.id)
      if (!info.changes) throw httpError(404, 'NOT_FOUND', 'Signed page not found.')
      // Keep page numbers contiguous (1..N) in upload order.
      const renumber = sqlite.prepare('UPDATE valuation_signed_pages SET page_no = ? WHERE id = ?')
      listSignedPages(row.id, { withImages: false }).forEach((page, index) => renumber.run(index + 1, page.id))
      return listSignedPages(row.id, { withImages: false })
    })
    res.json({ pages: remove.immediate() })
  } catch (error) {
    sendError(res, error, 'SIGNED_PAGE_DELETE_FAILED')
  }
})

router.post('/:id/signed-pages/lock', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const lock = sqlite.transaction(() => {
      const row = ownedValuationRow(id, req.user.id)
      if (row.signed_pages_locked_at) return
      assertSignedPagesEditable(row)
      const { n } = sqlite.prepare('SELECT COUNT(*) AS n FROM valuation_signed_pages WHERE valuation_id = ?').get(row.id)
      if (!n) throw httpError(400, 'NO_SIGNED_PAGES', 'Add at least one signed page before confirming.')
      sqlite.prepare('UPDATE valuations SET signed_pages_locked_at = ? WHERE id = ? AND user_id = ?').run(new Date().toISOString(), row.id, req.user.id)
    })
    lock.immediate()
    const [v] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, req.user.id)))
    res.json(await hydrate(v))
  } catch (error) {
    sendError(res, error, 'SIGNED_PAGES_LOCK_FAILED')
  }
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const userId = req.user.id
  const [existing] = await db.select().from(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (existing.status !== 'DRAFT') {
    return res.status(403).json({ error: 'NOT_DRAFT', message: 'Only DRAFT valuations can be deleted.' })
  }
  await db.delete(valuations).where(and(eq(valuations.id, id), eq(valuations.userId, userId)))
  res.status(204).end()
})

export default router
