import PrintDigitalCert from '../PrintDigitalCert'
import SellBillDocument from '../SellBillDocument'
import SbiAnnexure8 from './SbiAnnexure8'
import BobAnnexure4 from './BobAnnexure4'

/*
 * Print-format registry: format id → React component.
 *
 * Ids, labels and admin-editable options are defined on the server in
 * server/src/lib/printFormats.js (the source of truth); keep both lists in
 * sync. The server tells every valuation / sell bill which id to use
 * (`printFormat`) and its options (`printFormatOptions`).
 *
 * STANDARD is the original layout and must never change. Unknown ids fall
 * back to STANDARD.
 *
 * Component contract (valuation): props { valuation, includeKyc, qrBaseUrl,
 * reportAt, options }. It must leave out the KYC sheet and signed pages when
 * includeKyc is false (shared PDF), print times in IST, keep empty fields as
 * writable lines, never crop jewellery photos, never print renewal tracking,
 * and set `readySelector` once it is fully laid out (the PDF renderer and the
 * Print button wait for it).
 */

export const STANDARD_FORMAT = 'STANDARD'

const VALUATION_FORMATS = {
  STANDARD: {
    Component: PrintDigitalCert,
    readySelector: '[data-dc-ready="true"]',
    pageRuleSelector: 'style[data-dc-page-rule="true"]',
  },
  SBI_ANNEX8: {
    Component: SbiAnnexure8,
    readySelector: '[data-format-ready="true"]',
    pageRuleSelector: 'style[data-format-page-rule="true"]',
    // QR, photos and logos can all be switched off by the admin.
    allowNoImages: true,
  },
  BOB_ANNEX4: {
    Component: BobAnnexure4,
    readySelector: '[data-format-ready="true"]',
    pageRuleSelector: 'style[data-format-page-rule="true"]',
    allowNoImages: true,
  },
}

const SELL_BILL_FORMATS = {
  STANDARD: {
    Component: SellBillDocument,
    // The standard bill has no pagination step; images + fonts are enough.
    readySelector: null,
  },
}

export function valuationFormat(formatId) {
  return VALUATION_FORMATS[formatId] || VALUATION_FORMATS[STANDARD_FORMAT]
}

export function sellBillFormat(formatId) {
  return SELL_BILL_FORMATS[formatId] || SELL_BILL_FORMATS[STANDARD_FORMAT]
}
