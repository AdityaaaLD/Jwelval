import { formatDateDMY, formatDateIST, formatTimeIST, inr, num } from '../../../../lib/format'
import { resolveReportDateTime } from '../../PrintHelpers'
import { verificationUrl } from '../../../../lib/qr'

/* Values the bank-form templates print, derived exactly like the Standard
   certificate so every format shows the same numbers for the same report. */
export function buildCertData(valuation, { bankPreset, reportAt, qrBase }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const totals = items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, value: 0 })

  const reportDateTime = resolveReportDateTime(valuation, reportAt)
  const totalMarketValue = Number(valuation.marketValue) > 0 ? Number(valuation.marketValue) : totals.value
  const ltvLoanAmount = Number(totalMarketValue) > 0 && Number(valuation.loanLtv) > 0
    ? Math.round(totalMarketValue * (Number(valuation.loanLtv) / 100) * 100) / 100
    : 0

  // Same 3×4 grid as the Standard certificate; empty → writable line.
  const loanEntries = [
    ['Loan Type', valuation.loanType || ''],
    ['Bank Gold Rate', Number(valuation.bankGoldRatePerGram) > 0 ? `${inr(valuation.bankGoldRatePerGram)}/gm` : ''],
    ['Amount as per Bank Rate', Number(valuation.bankRecommendedValue) > 0 ? inr(valuation.bankRecommendedValue) : ''],
    ['Rate of Interest', valuation.rateOfInterest !== '' && valuation.rateOfInterest != null ? `${num(valuation.rateOfInterest, 2)}%` : ''],
    ['Market Gold Rate', Number(valuation.goldRate22k) > 0 ? `${inr(valuation.goldRate22k)}/gm` : ''],
    ['Amount as per Market Rate', Number(totalMarketValue) > 0 ? inr(totalMarketValue) : ''],
    ['Tenure (Months)', Number(valuation.tenureMonths) > 0 ? `${num(valuation.tenureMonths, 0)}` : ''],
    ['Total Gross Weight', Number(totals.gross) > 0 ? `${num(totals.gross, 2)} gm` : ''],
    ['Loan Amount (as per LTV)', Number(ltvLoanAmount) > 0 ? inr(ltvLoanAmount) : ''],
    ['LTV', Number(valuation.loanLtv) > 0 ? `${num(valuation.loanLtv, 0)}%` : ''],
    ['Total Net Weight', Number(totals.net) > 0 ? `${num(totals.net, 2)} gm` : ''],
    ['Sanction Loan Amount', Number(valuation.loanAmount) > 0 ? inr(valuation.loanAmount) : ''],
  ]

  return {
    customer,
    items,
    totals,
    totalMarketValue,
    loanEntries,
    reportDate: formatDateIST(reportDateTime),
    reportTime: formatTimeIST(reportDateTime),
    valuationDate: formatDateDMY(valuation.valuationDate),
    bankName: bankPreset?.bankName || customer.bankName || '',
    branchName: valuation.branch || bankPreset?.branch || customer.branch || '',
    branchCode: valuation.branchCode || bankPreset?.branchCode || '',
    managerName: bankPreset?.managerName || '',
    bankLogo: bankPreset?.bankLogo || '',
    empanelmentId: bankPreset?.empanelmentId || valuation.empanelmentId || '',
    acNo: valuation.acNo || customer.savingsAcNo || '',
    residence: customer.currentAddress || customer.address || '',
    qrLink: verificationUrl(valuation.valuationNumber, { baseUrl: qrBase }),
  }
}

/** Replaces {bank} / {branch} in admin-edited texts. */
export function fillPlaceholders(text, { bankName, branchName }) {
  return String(text || '')
    .replace(/\{bank\}/gi, bankName || 'the Bank')
    .replace(/\{branch\}/gi, branchName || '')
}

export const fmtWeight = (value) => (Number(value) > 0 ? num(value, 2) : '')
export const fmtAmount = (value) => (Number(value) > 0 ? num(value, 2) : '')
