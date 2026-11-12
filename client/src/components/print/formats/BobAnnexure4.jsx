import { num } from '../../../lib/format'
import PagedForm from './bankForm/PagedForm'
import useCertContext from './bankForm/useCertContext'
import { buildCertData, fillPlaceholders, fmtAmount, fmtWeight } from './bankForm/certData'
import { BorrowerDetails, Fill, KycAndSignedPages, Letterhead, LoanSummary, PhotoBoxes, QrBlock, ReferenceLine } from './bankForm/parts'
import './bankForm/bankForms.css'

/*
 * Bank of Baroda — Jewel Assaying Certificate (Annexure-4), built from the
 * client's sample and filled from JewelVal data only: every ornament is its own
 * row (no fixed category rows), blank rows are added up to the minimum.
 * Admin-editable options come from server/src/lib/printFormats.js (BOB_ANNEX4).
 */
const DEFAULTS = {
  annexureLabel: 'ANNEXURE: 4',
  subHeading: '(On Branch Letter Head Format)',
  title: 'JEWEL ASSAYING CERTIFICATE',
  jewelType: 'Gold',
  borrowerDeclaration: 'I hereby confirm having pledged the above-mentioned gold and silver jewellery for the purpose of availing jewel loan from {bank}.',
  appraiserDeclaration: 'I hereby certify that I have tested/examined and assayed/evaluated the above gold/ silver items as per the guidelines of the Bank, including through nitric acid test & the gross weight of the article, net weight of gold/ silver, Karat/fineness, purity, rate per gram & market value shown against the ornaments mentioned above are to the best of my knowledge correct & in order. I am aware that the Bank is depending on my certificate for granting a jewel loan against the ornaments mentioned above and that giving a false certificate is a criminal offence and punishable under various statutes of the Law.',
  place: '',
  minRows: 10,
  showLetterhead: true,
  showQr: true,
  showJewelleryPhoto: true,
  showBorrowerPhoto: true,
  showBankLogo: true,
  showReferenceLine: true,
  showBorrowerDetails: true,
  showLoanSummary: true,
  showRemarks: true,
}

const COLS = ['6%', '19%', '10%', '13%', '10%', '7%', '10%', '12%', '13%']

const deduction = (item) => {
  const gross = Number(item.grossWeightGm) || 0
  const net = Number(item.netWeightGm) || 0
  return gross > 0 && gross >= net ? gross - net : 0
}

export default function BobAnnexure4({ valuation, includeKyc = true, qrBaseUrl = '', reportAt = '', options }) {
  const opt = { ...DEFAULTS, ...(options || {}) }
  const ctx = useCertContext(valuation, { qrBaseUrl, includeKyc })
  const data = buildCertData(valuation, { bankPreset: ctx.bankPreset, reportAt, qrBase: ctx.qrBase })
  const { customer, items, totals } = data
  const place = opt.place || data.branchName
  const showLogo = opt.showBankLogo && data.bankLogo
  const rate = Number(valuation.goldRate22k) > 0 ? num(valuation.goldRate22k, 2) : ''
  const totalDeduction = items.reduce((sum, item) => sum + deduction(item), 0)

  const firstHead = (
    <>
      <div className="bf-topbar">
        {showLogo && <img src={data.bankLogo} alt="Bank Logo" className="bf-bank-logo" />}
        <span className="bf-annexure">{opt.annexureLabel}</span>
      </div>
      {opt.showLetterhead && <Letterhead profile={ctx.profile} empanelmentId={data.empanelmentId} />}
      <div className="bf-center">
        {opt.subHeading && <p className="bf-subheading">{opt.subHeading}</p>}
        <p className="bf-bank-name">{(data.bankName || '').toUpperCase() || <Fill value="" width="60mm" />}</p>
        <p><Fill value={data.branchName} width="40mm" /> Branch{data.branchCode ? ` (Branch Code: ${data.branchCode})` : ''}</p>
      </div>
      <p className="bf-title"><span>{opt.title}</span></p>
      {opt.showReferenceLine && <ReferenceLine valuation={valuation} data={data} />}
      <div className="bf-party">
        <div className="bf-party-main bf-fields">
          <p>
            <span className="bf-field-label">Name</span>
            <span className="bf-field-value">: <Fill value={customer.name} width="50mm" /></span>
          </p>
          <p>
            <span className="bf-field-label">Account Number</span>
            <span className="bf-field-value">: <Fill value={data.acNo} width="45mm" /></span>
          </p>
          <p>
            <span className="bf-field-label">Address</span>
            <span className="bf-field-value">: <Fill value={data.residence} width="70mm" /></span>
          </p>
          <p>
            <span className="bf-field-label">Jewel Type</span>
            <span className="bf-field-value">: <Fill value={opt.jewelType} width="25mm" /></span>
          </p>
        </div>
        <div className="bf-party-side">
          <PhotoBoxes valuation={valuation} showBorrower={opt.showBorrowerPhoto} showJewellery={opt.showJewelleryPhoto} />
          {opt.showQr && <QrBlock link={data.qrLink} certNo={valuation.valuationNumber} />}
        </div>
      </div>
      {opt.showBorrowerDetails && <BorrowerDetails customer={customer} />}
    </>
  )

  const contHead = (
    <div className="bf-cont">
      <b>{opt.title}</b>
      <span>Certificate No: {valuation.valuationNumber} — {customer.name || ''} (continued)</span>
    </div>
  )

  const colGroup = <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
  const tableHead = (
    <thead>
      <tr>
        <th rowSpan={2}>S.No</th>
        <th rowSpan={2}>Description of ornaments</th>
        <th>Gross Weight</th>
        <th>Deductions <span className="bf-th-small">(On account of weight of stones, lac, alloy, strings, fastenings)</span></th>
        <th>Net Weight</th>
        <th rowSpan={2}>Karat</th>
        <th rowSpan={2}>Rate per Gram</th>
        <th rowSpan={2}>Market Value (In Rs)</th>
        <th rowSpan={2}>Remarks <span className="bf-th-small">(Damage, breakage or defect, if any)</span></th>
      </tr>
      <tr>
        <th colSpan={3} className="bf-th-note">In grams</th>
      </tr>
    </thead>
  )

  const rows = items.map((item, index) => (
    <tr key={`item-${item.id || index}`} className="bf-row">
      <td>{index + 1}</td>
      <td className="bf-left">{item.description}{Number(item.noOfUnits) > 1 ? ` (${num(item.noOfUnits, 0)})` : ''}</td>
      <td>{fmtWeight(item.grossWeightGm)}</td>
      <td>{fmtWeight(deduction(item))}</td>
      <td>{fmtWeight(item.netWeightGm)}</td>
      <td>{item.purityCarat || 22}</td>
      <td>{rate}</td>
      <td className="bf-right">{fmtAmount(item.approxValueInr)}</td>
      <td className="bf-left">{opt.showRemarks ? item.remarks || '' : ''}</td>
    </tr>
  ))
  const blankRow = (key) => (
    <tr key={key} className="bf-blank-row" aria-hidden="true">
      {COLS.map((_, i) => <td key={i} />)}
    </tr>
  )
  const totalRow = (
    <tr key="total" className="bf-total-row">
      <td />
      <td className="bf-left">Total{totals.units > 0 ? ` (${num(totals.units, 0)} nos.)` : ''}</td>
      <td>{fmtWeight(totals.gross)}</td>
      <td>{fmtWeight(totalDeduction)}</td>
      <td>{fmtWeight(totals.net)}</td>
      <td />
      <td />
      <td className="bf-right">{fmtAmount(totals.value)}</td>
      <td />
    </tr>
  )

  const footer = (
    <>
      {opt.showLoanSummary && <LoanSummary entries={data.loanEntries} />}
      <p className="bf-para">{fillPlaceholders(opt.borrowerDeclaration, data)}</p>
      <div className="bf-sign bf-inline-sign">
        <p className="bf-sign-name">{customer.name || ''}</p>
        <p className="bf-sign-line">Signature of Borrower</p>
      </div>
      <p className="bf-para">{fillPlaceholders(opt.appraiserDeclaration, data)}</p>
      <div className="bf-signs">
        <div>
          <p>Place: <Fill value={place} width="38mm" /></p>
          <p>Date: <Fill value={data.reportDate} width="30mm" /></p>
        </div>
        <div className="bf-sign">
          <p className="bf-sign-name">{ctx.profile.appraiser_name || ''}</p>
          <p className="bf-sign-line">Signature of Appraiser</p>
        </div>
      </div>
    </>
  )

  const signature = [
    valuation.id,
    valuation.updatedAt || '',
    valuation.printedAt || reportAt || '',
    items.length,
    JSON.stringify(opt),
    ctx.loaded ? 'ready' : 'loading',
  ].join('#')

  return (
    <PagedForm
      ready={ctx.loaded}
      signature={signature}
      pageClassName="bf-bob"
      firstHead={firstHead}
      contHead={contHead}
      colGroup={colGroup}
      tableHead={tableHead}
      rows={rows}
      blankRow={blankRow}
      minRows={Number(opt.minRows) || 0}
      totalRow={totalRow}
      footer={footer}
      pageLabel={(page, count) => (count > 1 ? `Certificate No. ${valuation.valuationNumber} — Page ${page} of ${count}` : `Certificate No. ${valuation.valuationNumber}`)}
      trailingReady={ctx.signedLoaded}
      trailing={<KycAndSignedPages valuation={valuation} includeKyc={includeKyc} signedPages={ctx.signedPages} data={data} />}
    />
  )
}
