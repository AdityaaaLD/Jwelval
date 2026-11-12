import { sqlite } from '../db/client.js'

/*
 * Per-user print formats.
 *
 * The catalog below is the single source of truth for which document layouts
 * exist (ids, labels, admin-editable options). The React component for each id
 * lives in client/src/components/print/formats/index.js — keep both in sync.
 *
 * Rules:
 *  - STANDARD is the original layout (PrintDigitalCert / SellBillDocument) and
 *    the default for everyone. It has no options.
 *  - Only an admin assigns formats: per user (bank_preset_id = 0) and optionally
 *    per bank preset of that user (bank_preset_id = preset id).
 *  - A valuation freezes its format + options when it is locked (printed/shared);
 *    a sell bill freezes them when it is created. Reprints therefore never change.
 *    Documents locked before this feature existed have no frozen value and are
 *    always shown in STANDARD, which is what they were issued in.
 *  - Never delete or change the printed output of an existing format id once it
 *    is in use; add a new id (e.g. SBI_ANNEX8_V2) instead.
 */

export const DOC_TYPES = ['VALUATION', 'SELL_BILL']
export const STANDARD_FORMAT = 'STANDARD'

// Extras every bank-form template offers on top of the bank's paper form.
const BANK_FORM_EXTRAS = [
  { key: 'showLetterhead', type: 'boolean', label: 'Valuer letterhead at the top (logo, business, address, contacts)', default: true },
  { key: 'showQr', type: 'boolean', label: 'QR "Scan & Verify" with certificate no. and time', default: true },
  { key: 'showJewelleryPhoto', type: 'boolean', label: 'Jewellery photo (never cropped)', default: true },
  { key: 'showBorrowerPhoto', type: 'boolean', label: 'Borrower photo', default: true },
  { key: 'showBankLogo', type: 'boolean', label: 'Bank logo from the Bank Preset', default: true },
  { key: 'showReferenceLine', type: 'boolean', label: 'Certificate no., Application ID, Gold Loan Register no., Gold Packets no.', default: true },
  { key: 'showBorrowerDetails', type: 'boolean', label: 'Borrower mobile, alternate mobile and Aadhaar no.', default: true },
  { key: 'showLoanSummary', type: 'boolean', label: 'Loan summary (gold rates, LTV, loan amounts)', default: true },
  { key: 'showRemarks', type: 'boolean', label: 'Item remarks', default: true },
]

const PLACEHOLDER_HELP = 'You can use {bank} and {branch}.'

export const PRINT_FORMATS = {
  VALUATION: [
    {
      id: STANDARD_FORMAT,
      label: 'Standard — Digital Valuation Certificate',
      description: 'The current JewelVal certificate. Default for every user.',
      options: [],
    },
    {
      id: 'SBI_ANNEX8',
      label: 'SBI — Appraiser Certificate (Annexure-8)',
      description: 'Letter-style appraiser certificate addressed to the Branch Manager, as per the State Bank of India form.',
      options: [
        { key: 'annexureLabel', type: 'text', label: 'Annexure label (top right)', default: 'Annexure – 8', maxLength: 40 },
        { key: 'title', type: 'text', label: 'Title', default: 'APPRAISER CERTIFICATE', maxLength: 80 },
        { key: 'relationLabel', type: 'text', label: 'Relation label before the blank line', default: 'S/o', maxLength: 20 },
        { key: 'testingMethod', type: 'text', label: 'Method(s) used for purity testing', default: 'Touchstone & Nitric Acid Test', maxLength: 160 },
        {
          key: 'declaration',
          type: 'textarea',
          label: 'Declaration',
          help: PLACEHOLDER_HELP,
          default: 'I solemnly declare that weight, purity of the gold ornaments/precious stones indicated above are correct and I undertake to indemnify the Bank against any loss it may sustain on account of any inaccuracy in the above appraisal.',
          maxLength: 1500,
        },
        { key: 'place', type: 'text', label: 'Place (leave empty to print the branch name)', default: '', maxLength: 80 },
        { key: 'minRows', type: 'number', label: 'Minimum table rows (blank rows are added)', default: 4, min: 1, max: 20 },
        ...BANK_FORM_EXTRAS,
      ],
    },
    {
      id: 'BOB_ANNEX4',
      label: 'Bank of Baroda — Jewel Assaying Certificate (Annexure-4)',
      description: 'Jewel assaying certificate with deductions, rate per gram and remarks columns, as per the Bank of Baroda form.',
      options: [
        { key: 'annexureLabel', type: 'text', label: 'Annexure label (top right)', default: 'ANNEXURE: 4', maxLength: 40 },
        { key: 'subHeading', type: 'text', label: 'Line above the bank name', default: '(On Branch Letter Head Format)', maxLength: 80 },
        { key: 'title', type: 'text', label: 'Title', default: 'JEWEL ASSAYING CERTIFICATE', maxLength: 80 },
        { key: 'jewelType', type: 'text', label: 'Jewel type', default: 'Gold', maxLength: 40 },
        {
          key: 'borrowerDeclaration',
          type: 'textarea',
          label: 'Borrower confirmation',
          help: PLACEHOLDER_HELP,
          default: 'I hereby confirm having pledged the above-mentioned gold and silver jewellery for the purpose of availing jewel loan from {bank}.',
          maxLength: 1000,
        },
        {
          key: 'appraiserDeclaration',
          type: 'textarea',
          label: 'Appraiser certificate',
          help: PLACEHOLDER_HELP,
          default: 'I hereby certify that I have tested/examined and assayed/evaluated the above gold/ silver items as per the guidelines of the Bank, including through nitric acid test & the gross weight of the article, net weight of gold/ silver, Karat/fineness, purity, rate per gram & market value shown against the ornaments mentioned above are to the best of my knowledge correct & in order. I am aware that the Bank is depending on my certificate for granting a jewel loan against the ornaments mentioned above and that giving a false certificate is a criminal offence and punishable under various statutes of the Law.',
          maxLength: 2000,
        },
        { key: 'place', type: 'text', label: 'Place (leave empty to print the branch name)', default: '', maxLength: 80 },
        { key: 'minRows', type: 'number', label: 'Minimum table rows (blank rows are added)', default: 10, min: 1, max: 20 },
        ...BANK_FORM_EXTRAS,
      ],
    },
  ],
  SELL_BILL: [
    {
      id: STANDARD_FORMAT,
      label: 'Standard — Invoice / Tax Invoice',
      description: 'The current JewelVal sell bill. Default for every user.',
      options: [],
    },
  ],
}

export function isDocType(docType) {
  return DOC_TYPES.includes(docType)
}

export function getFormat(docType, formatId) {
  return (PRINT_FORMATS[docType] || []).find((f) => f.id === formatId) || null
}

function parseJson(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function sanitizeValue(spec, value) {
  if (value === undefined || value === null) return undefined
  switch (spec.type) {
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (value === 'true' || value === 1 || value === '1') return true
      if (value === 'false' || value === 0 || value === '0') return false
      return undefined
    case 'number': {
      const n = Number(value)
      if (!Number.isFinite(n)) return undefined
      const min = spec.min ?? Number.NEGATIVE_INFINITY
      const max = spec.max ?? Number.POSITIVE_INFINITY
      return Math.min(max, Math.max(min, Math.round(n)))
    }
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string' && typeof value !== 'number') return undefined
      let text = String(value).replace(/\r\n?/g, '\n')
      if (spec.type === 'text') text = text.replace(/\s*\n\s*/g, ' ')
      text = text.trim()
      return text.slice(0, spec.maxLength || 500)
    }
    default:
      return undefined
  }
}

/** Keeps only known option keys, typed and clamped. */
export function sanitizeOptions(docType, formatId, raw) {
  const format = getFormat(docType, formatId)
  if (!format) return {}
  const input = parseJson(raw)
  const clean = {}
  for (const spec of format.options) {
    const value = sanitizeValue(spec, input[spec.key])
    if (value !== undefined) clean[spec.key] = value
  }
  return clean
}

/** Defaults overlaid with the stored (sanitized) values. */
export function mergedOptions(docType, formatId, raw) {
  const format = getFormat(docType, formatId)
  if (!format) return {}
  const defaults = Object.fromEntries(format.options.map((spec) => [spec.key, spec.default]))
  return { ...defaults, ...sanitizeOptions(docType, formatId, raw) }
}

const STANDARD_RESULT = Object.freeze({ formatId: STANDARD_FORMAT, options: {}, source: 'default' })

/**
 * The format the admin assigned to this user for this document type, with the
 * bank-preset override taking priority over the user default.
 */
export function resolveAssignment(userId, docType, bankPresetId = 0) {
  const presetId = Number(bankPresetId) > 0 ? Number(bankPresetId) : 0
  let rows = []
  try {
    rows = sqlite.prepare(`
      SELECT bank_preset_id AS bankPresetId, format_id AS formatId, options_json AS optionsJson
      FROM print_format_assignments
      WHERE user_id = ? AND doc_type = ? AND bank_preset_id IN (0, ?)
    `).all(Number(userId), docType, presetId)
  } catch {
    return { ...STANDARD_RESULT }
  }
  const bankRow = presetId ? rows.find((r) => Number(r.bankPresetId) === presetId && getFormat(docType, r.formatId)) : null
  const userRow = rows.find((r) => Number(r.bankPresetId) === 0 && getFormat(docType, r.formatId))
  const pick = bankRow || userRow
  if (!pick) return { ...STANDARD_RESULT }
  return {
    formatId: pick.formatId,
    options: mergedOptions(docType, pick.formatId, pick.optionsJson),
    source: bankRow ? 'bank' : 'user',
  }
}

/** A frozen format stored on a document (unknown/empty → STANDARD). */
export function frozenFormat(docType, formatId, optionsJson) {
  if (!formatId || !getFormat(docType, formatId)) return { ...STANDARD_RESULT, source: 'frozen' }
  return { formatId, options: mergedOptions(docType, formatId, optionsJson), source: 'frozen' }
}

const norm = (value) => String(value || '').trim().toLowerCase()

/**
 * Bank preset a valuation belongs to: the stored bank_preset_id, otherwise the
 * same bank/branch match the certificate itself uses for older valuations.
 */
export function bankPresetIdForValuation({ userId, bankPresetId, branch, customer }) {
  const presetId = Number(bankPresetId)
  if (presetId > 0) return presetId
  const wantedBank = norm(customer?.bankName)
  if (!wantedBank) return 0
  const wantedBranch = norm(branch || customer?.branch)
  const rows = sqlite.prepare('SELECT id, bank_name AS bankName, branch FROM bank_presets WHERE user_id = ? ORDER BY bank_name, branch').all(Number(userId))
  const match = rows.find((row) => norm(row.bankName) === wantedBank && (wantedBranch ? norm(row.branch) === wantedBranch : true))
  return match ? Number(match.id) : 0
}

/** Format for a valuation: frozen once locked, otherwise the live assignment. */
export function valuationPrintFormat(row, customer) {
  if (row.status && row.status !== 'DRAFT') return frozenFormat('VALUATION', row.printFormat, row.printFormatOptions)
  const presetId = bankPresetIdForValuation({ userId: row.userId, bankPresetId: row.bankPresetId, branch: row.branch, customer })
  return resolveAssignment(row.userId, 'VALUATION', presetId)
}
