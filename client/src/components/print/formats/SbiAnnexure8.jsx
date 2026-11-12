import { num } from '../../../lib/format'
import PagedForm from './bankForm/PagedForm'
import useCertContext from './bankForm/useCertContext'
import { buildCertData, fillPlaceholders, fmtAmount, fmtWeight } from './bankForm/certData'
import { Blank, BorrowerDetails, Fill, KycAndSignedPages, Letterhead, LoanSummary, PhotoBoxes, QrBlock, ReferenceLine } from './bankForm/parts'
import './bankForm/bankForms.css'

/*
 * State Bank of India — Appraiser Certificate (Annexure-8), built from the
 * client's sample and filled from JewelVal data only. Fields JewelVal does not
 * store (S/o, Cash in-charge) print as writable lines. Admin-editable options
 * come from server/src/lib/printFormats.js (SBI_ANNEX8).
 */
const DEFAULTS = {
  annexureLabel: 'Annexure – 8',
  title: 'APPRAISER CERTIFICATE',
  relationLabel: 'S/o',
  testingMethod: 'Touchstone & Nitric Acid Test',
  declaration: 'I solemnly declare that weight, purity of the gold ornaments/precious stones indicated above are correct and I undertake to indemnify the Bank against any loss it may sustain on account of any inaccuracy in the above appraisal.',
  place: '',
  minRows: 4,
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

const COLS = ['9%', '26%', '11%', '17%', '9%', '12%', '16%']

export default function SbiAnnexure8({ valuation, includeKyc = true, qrBaseUrl = '', reportAt = '', options }) {
  const opt = { ...DEFAULTS, ...(options || {}) }
  const ctx = useCertContext(valuation, { qrBaseUrl, includeKyc })
  const data = buildCertData(valuation, { bankPreset: ctx.bankPreset, reportAt, qrBase: ctx.qrBase })
  const { customer, items, totals } = data
  const place = opt.place || data.branchName
  const showLogo = opt.showBankLogo && data.bankLogo

  const firstHead = (
    <>
      <div className="bf-topbar">
        {showLogo && <img src={data.bankLogo} alt="Bank Logo" className="bf-bank-logo" />}
        <span className="bf-annexure">{opt.annexureLabel}</span>
      </div>
      {opt.showLetterhead && <Letterhead profile={ctx.profile} empanelmentId={data.empanelmentId} />}
      <p className="bf-title"><span>{opt.title}</span></p>
      {opt.showReferenceLine && <ReferenceLine valuation={valuation} data={data} />}
      <div className="bf-party">
        <div className="bf-party-main">
          <div>
            <p>The Branch Manager</p>
            <p><Fill value={data.bankName} width="50mm" /></p>
            <p><Fill value={data.branchName} width="40mm" /> Branch{data.branchCode ? ` (Branch Code: ${data.branchCode})` : ''}</p>
          </div>
          <p className="bf-acno">Ac. No : <Fill value={data.acNo} width="40mm" /></p>
        </div>
        <div className="bf-party-side">
          <PhotoBoxes valuation={valuation} showBorrower={opt.showBorrowerPhoto} showJewellery={opt.showJewelleryPhoto} />
          {opt.showQr && <QrBlock link={data.qrLink} certNo={valuation.valuationNumber} />}
        </div>
      </div>
      <p className="bf-salutation">Dear Sir,</p>
      <p className="bf-letter">
        I hereby certify that Shri/Smt <Fill value={customer.name} width="55mm" /> {opt.relationLabel} <Blank width="45mm" /> Resident
        of <Fill value={data.residence} width="55mm" /> who has sought gold loan from the Bank is not my relative and the gold against
        which the loan is sought is not purchased from me. The ornaments/Coins have been weighted and appraised by me
        on <Fill value={data.valuationDate} width="24mm" /> in the presence of <Blank width="42mm" /> (Cash in charge) and the exact
        weight, purity of the metal and market value of each item as on date are indicated below:
      </p>
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
        <th>No. of article</th>
        <th className="bf-left">Description of the Article</th>
        <th>Gross Weight (Grams)</th>
        <th>Approximate weight of the precious stones in the ornaments (Grams)</th>
        <th>Purity (Carat)</th>
        <th>Net Weight (Grams)</th>
        <th>Market Value (Rs.)</th>
      </tr>
    </thead>
  )

  const rows = items.map((item, index) => (
    <tr key={`item-${item.id || index}`} className="bf-row">
      <td>{num(item.noOfUnits, 0)}</td>
      <td className="bf-left">
        {item.description}
        {opt.showRemarks && item.remarks && <span className="bf-remark">({item.remarks})</span>}
      </td>
      <td>{fmtWeight(item.grossWeightGm)}</td>
      <td />
      <td>{item.purityCarat || 22}</td>
      <td>{fmtWeight(item.netWeightGm)}</td>
      <td className="bf-right">{fmtAmount(item.approxValueInr)}</td>
    </tr>
  ))
  const blankRow = (key) => (
    <tr key={key} className="bf-blank-row" aria-hidden="true">
      {COLS.map((_, i) => <td key={i} />)}
    </tr>
  )
  const totalRow = (
    <tr key="total" className="bf-total-row">
      <td>{num(totals.units, 0)}</td>
      <td className="bf-left">TOTAL</td>
      <td>{fmtWeight(totals.gross)}</td>
      <td />
      <td />
      <td>{fmtWeight(totals.net)}</td>
      <td className="bf-right">{fmtAmount(totals.value)}</td>
    </tr>
  )

  const footer = (
    <>
      {opt.showLoanSummary && <LoanSummary entries={data.loanEntries} />}
      <p className="bf-para">Method (s) used for purity testing: {opt.testingMethod ? <b>{opt.testingMethod}</b> : <Blank width="60mm" />}</p>
      <p className="bf-para" style={{ marginTop: '1mm' }}>{fillPlaceholders(opt.declaration, data)}</p>
      <div className="bf-place-row">
        <div>
          <p>Place: <Fill value={place} width="38mm" /></p>
          <p>Date: <Fill value={data.reportDate} width="30mm" /></p>
        </div>
        <p>Yours faithfully</p>
      </div>
      <div className="bf-signs">
        <div className="bf-sign">
          <p className="bf-sign-name">{customer.name || ''}</p>
          <p className="bf-sign-line">Name &amp; Signature of the Borrower</p>
        </div>
        <div className="bf-sign">
          <p className="bf-sign-name">{ctx.profile.appraiser_name || ''}</p>
          <p className="bf-sign-line">Name &amp; Signature of the Appraiser</p>
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
      pageClassName="bf-sbi"
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
