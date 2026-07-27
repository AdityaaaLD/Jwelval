import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDateDMY, inr, num } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, SignatureGrid, resolveReportDateTime } from './PrintHelpers'
import QrImage from '../QrImage'
import { verificationUrl } from '../../lib/qr'

const COLS = 8

/* Geometry of one printed sheet. Kept a hair under A4 so an exactly-full page
   can never spill into a blank one. Mirrors `.print-page.digital-cert` in
   print.css — both must stay in sync. */
const PAGE_HEIGHT_MM = 296.9
const PAGE_PAD_Y_MM = 12
const mmToPx = (mm) => (mm * 96) / 25.4
/* Heights are read with offsetHeight, which is integer-rounded, so leave a few
   pixels of slack rather than risk overflowing a sheet. */
const SAFETY_PX = 6
const USABLE_PX = mmToPx(PAGE_HEIGHT_MM - PAGE_PAD_Y_MM) - SAFETY_PX

/* Measurement runs in two stages: first with the table in automatic layout to
   learn the natural column widths, then with those widths locked in so the row
   heights we measure are exactly the heights that will be printed. */
const STAGE_COLUMNS = 'columns'
const STAGE_ROWS = 'rows'
const STAGE_DONE = 'done'

function allImagesReady(root) {
  return Array.from(root.querySelectorAll('img')).every((img) => img.complete)
}

function onImagesSettled(root, callback) {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  if (!pending.length) return () => {}
  let done = false
  const fire = () => {
    if (done) return
    done = true
    callback()
  }
  pending.forEach((img) => {
    img.addEventListener('load', fire, { once: true })
    img.addEventListener('error', fire, { once: true })
  })
  return () => pending.forEach((img) => {
    img.removeEventListener('load', fire)
    img.removeEventListener('error', fire)
  })
}

/**
 * Splits the ornament rows into printed pages.
 *
 * Chrome cannot do this for us: it refuses to repeat a <thead> taller than 25%
 * of the page (our letterhead block is ~37%), and a `position: fixed` running
 * header gets clamped into the page content box, so it overlaps the flowing
 * rows instead of sitting in the reserved margin. Measuring and paginating
 * here means every page gets the full header, the column headers and the
 * signature footer, with the footer pinned to the bottom edge.
 */
function paginateRows(rowHeights, { headerHeight, footerHeight, theadHeight }) {
  const capacity = USABLE_PX - headerHeight - footerHeight - theadHeight
  if (!Number.isFinite(capacity) || capacity <= 0) return [rowHeights.map((_, i) => i)]

  const pages = []
  let current = []
  let used = 0

  rowHeights.forEach((height, index) => {
    // Always keep at least one row per page, otherwise an oversized row loops.
    if (current.length && used + height > capacity) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(index)
    used += height
  })

  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

export default function PrintDigitalCert({ valuation }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const aadharFrontDoc = valuation.aadharPhotoDoc || customer.aadharPhoto || ''
  const aadharBackDoc = customer.aadharPhotoBack || ''
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])

  const measureRef = useRef(null)
  const [tick, setTick] = useState(0)
  const [stage, setStage] = useState(STAGE_COLUMNS)
  const [colWidths, setColWidths] = useState(null)
  const [pages, setPages] = useState(null)

  const totals = items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, value: 0 })

  const reportDateTime = resolveReportDateTime(valuation)
  const empanelmentId = valuation?.empanelmentId || ''
  const dateStr = formatDateDMY(reportDateTime)
  const timeStr = reportDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const runningHead = (
    <div className="dc-running-head">
      <header className="dc-header-box">
        <div className="dc-header-qr-badge">
          <QrImage text={verificationUrl(valuation.valuationNumber)} className="dc-header-qr-image" />
          <p>Scan &amp; Verify</p>
        </div>
        <p className="dc-header-line" style={{ fontSize: '18px', letterSpacing: '1px', color: '#b8860b' }}><b>{(profile?.business_name || 'JEWELLERS').toUpperCase()}</b></p>
        <p className="dc-header-line" style={{ color: '#b91c1c' }}>Proprietor, {profile?.appraiser_name || ''}, {profile?.qualification || 'Government Approved Gold Appaisal'}</p>
        {profile?.organization && <p className="dc-header-line" style={{ color: '#b91c1c' }}>({profile.organization})</p>}
        <p className="dc-header-line" style={{ color: '#b91c1c' }}>{profile?.address || ''}</p>
        {profile?.cert_number && <p className="dc-header-line" style={{ color: '#b91c1c' }}>No. {profile.cert_number}</p>}
        <p className="dc-header-line" style={{ color: '#b91c1c' }}>{[profile?.mobile ? `Mob: ${profile.mobile}` : '', profile?.email || ''].filter(Boolean).join(' | ')}{profile?.gstn ? ` | GSTN: ${profile.gstn}` : ''}</p>
        {profile?.bank_account_number && <p className="dc-header-line" style={{ color: '#b91c1c' }}>Bank A/C: {profile.bank_account_number}</p>}
        {empanelmentId && <p className="dc-header-line" style={{ color: '#b91c1c' }}>(Digital ID of Empanelment: {empanelmentId})</p>}
      </header>

      <div className="dc-row-box">
        <span>Application ID: {valuation.applicationId || ''}</span>
      </div>
      <div className="dc-row-box dc-row-split">
        <span>Certificate No: {valuation.valuationNumber}</span>
        <span>Date: {dateStr} {timeStr}</span>
      </div>

      <div className="dc-row-box dc-parties dc-parties-with-photos">
        <div className="dc-party-from">
          <p><b>From,</b></p>
          <p>{profile?.appraiser_name || ''}</p>
          {empanelmentId && <p>Empanelment ID: {empanelmentId}</p>}
        </div>
        <div className="dc-party-to-photos">
          <div className="dc-party-to">
            <p><b>To,</b></p>
            <p>Branch Manager,</p>
            <p>{valuation.branch}{valuation.branchCode ? ` (Br. Code: ${valuation.branchCode})` : ''}</p>
          </div>
          {(valuation.personPhoto || valuation.jewelleryPhoto) && (
            <div className="dc-inline-photos">
              {valuation.personPhoto && (
                <div className="dc-photo-box dc-inline-photo-box">
                  <img src={valuation.personPhoto} alt="Borrower" />
                  <p>Borrower Photo</p>
                </div>
              )}
              {valuation.jewelleryPhoto && (
                <div className="dc-photo-box dc-inline-photo-box">
                  <img src={valuation.jewelleryPhoto} alt="Jewellery" />
                  <p>Jewellery Photo</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dc-row-box dc-borrower">
        <p><b>Borrower Name:</b> {customer.name} <span className="dc-borrower-sep">|</span> <b>Borrower Mob. No:</b> {customer.mobile || '-'}</p>
        <p>
          {(valuation.acNo || customer.savingsAcNo) && <><b>A/C No:</b> {valuation.acNo || customer.savingsAcNo} <span className="dc-borrower-sep">|</span> </>}
          <b>Bank:</b> {customer.bankName || 'Bank of Maharashtra'}, <b>Branch:</b> {valuation.branch || customer.branch || ''}
        </p>
      </div>

      <div className="dc-row-box dc-loan-meta-row">
        <div className="dc-loan-meta-left">
          {valuation.loanType && <span><b>Loan Type:</b> {valuation.loanType}</span>}
          {valuation.rateOfInterest != null && <span className="dc-loan-rate"><b>Rate of Interest:</b> {valuation.rateOfInterest}%</span>}
          {valuation.bankGoldRatePerGram != null && Number(valuation.bankGoldRatePerGram) > 0 && (
            <span className="dc-recommended-rate"><b>Bank Recommended Gold Rate:</b> {inr(valuation.bankGoldRatePerGram)}/gm</span>
          )}
          {valuation.bankRecommendedValue != null && (
            <span className="dc-recommended-loan"><b>Bank Recommended Loan Amount:</b> {inr(valuation.bankRecommendedValue)}</span>
          )}
        </div>
        <span className="dc-currency-inline">(Rs. in Actual)</span>
      </div>
    </div>
  )

  const runningFoot = (
    <div className="dc-running-foot">
      <SignatureGrid labels={['Branch Manager', 'Joint Custodian', `Customer: ${customer.name || ''}`, 'Appraiser With Name']} />
    </div>
  )

  const tableHead = (
    <thead>
      <tr className="dc-table-info">
        <th>Sr.</th>
        <th>Description of jewels / Ornaments</th>
        <th></th>
        <th>No. of jewels</th>
        <th>Total Gross weight of jewellery including wax, stones, beads, plastic, lac, alloy, strings, fastrings, dust &amp; other Material</th>
        <th>Approx Equivalent Weight of Carat Jewellery Contents</th>
        <th>Purity in Carat</th>
        <th>By(BJA) Indian Bullion Jewellers Association ltd, Mumbai 22 carat Gold Price. Total Approx Value of The Jewellery</th>
      </tr>
      <tr>
        <th>No.</th>
        <th>Assessed</th>
        <th>Remarks</th>
        <th>Ornaments</th>
        <th>In Grams</th>
        <th>In Grams</th>
        <th>Carat</th>
        <th>In Rs.</th>
      </tr>
    </thead>
  )

  // Every row that has to be distributed over the pages, in printed order.
  const bodyRows = useMemo(() => {
    const rows = items.map((item, index) => (
      <tr key={`item-${item.id || index}`}>
        <td>{index + 1}</td>
        <td className="dc-td-left">{item.description}</td>
        <td>{item.remarks || '-'}</td>
        <td>{num(item.noOfUnits, 2)}</td>
        <td>{num(item.grossWeightGm, 2)}</td>
        <td>{num(item.netWeightGm, 2)}</td>
        <td>{item.purityCarat || 22}K</td>
        <td>{num(item.approxValueInr, 2)}</td>
      </tr>
    ))

    rows.push(
      <tr key="totals" className="dc-total-row">
        <td colSpan="2"><b>Total</b></td>
        <td></td>
        <td><b>{num(totals.units, 2)}</b></td>
        <td><b>{num(totals.gross, 2)}</b></td>
        <td><b>{num(totals.net, 2)}</b></td>
        <td></td>
        <td><b>{num(totals.value, 2)}</b></td>
      </tr>
    )

    rows.push(
      <tr key="cert-text" className="dc-cert-text-row">
        <td colSpan={COLS} className="dc-cert-text-cell">
          <CertificateRules valuation={valuation} className="dc-cert-text" />
        </td>
      </tr>
    )

    return rows
  }, [items, totals.units, totals.gross, totals.net, totals.value, valuation])

  /* Re-measure only when something that changes the layout actually changes.
     Keying on object identity would restart the measure pass on every parent
     re-render. */
  const layoutSignature = [
    valuation.id,
    valuation.updatedAt || '',
    items.length,
    items.map((item) => `${item.description || ''}|${item.remarks || ''}`).join('~'),
    profile ? `${profile.business_name || ''}|${profile.address || ''}|${profile.organization || ''}` : '',
    valuation.personPhoto ? '1' : '0',
    valuation.jewelleryPhoto ? '1' : '0',
  ].join('#')

  useLayoutEffect(() => {
    setStage(STAGE_COLUMNS)
    setColWidths(null)
    setPages(null)
  }, [layoutSignature])

  useLayoutEffect(() => {
    if (stage === STAGE_DONE) return undefined
    const root = measureRef.current
    if (!root) return undefined

    // Photos and the QR code change the header height, so wait for them.
    if (!allImagesReady(root)) {
      return onImagesSettled(root, () => setTick((value) => value + 1))
    }

    if (stage === STAGE_COLUMNS) {
      const headerCells = root.querySelectorAll('thead tr:last-child th')
      if (!headerCells.length) return undefined
      setColWidths(Array.from(headerCells).map((cell) => cell.offsetWidth))
      setStage(STAGE_ROWS)
      return undefined
    }

    const head = root.querySelector('.dc-running-head')
    const foot = root.querySelector('.dc-running-foot')
    const thead = root.querySelector('thead')
    const rows = Array.from(root.querySelectorAll('tbody > tr'))
    if (!head || !foot || !thead || !rows.length) return undefined

    const rowHeights = rows.map((row) => row.offsetHeight)
    setPages(paginateRows(rowHeights, {
      headerHeight: head.offsetHeight,
      footerHeight: foot.offsetHeight,
      theadHeight: thead.offsetHeight,
    }))
    setStage(STAGE_DONE)
    return undefined
  }, [stage, tick, bodyRows, profile])

  const colGroup = colWidths
    ? <colgroup>{colWidths.map((width, index) => <col key={index} style={{ width: `${width}px` }} />)}</colgroup>
    : null

  const measuring = stage !== STAGE_DONE || !pages

  return (
    <div>
      {/* Certificate pages are sized by us, so the sheet itself carries no
          margin — `.print-page.digital-cert` supplies the printed border. */}
      <style data-dc-page-rule="true">{'@page { size: A4; margin: 0; }'}</style>

      {measuring && (
        <div className="dc-measure" ref={measureRef} aria-hidden="true">
          <article className="print-page digital-cert dc-certificate dc-cert-page">
            {runningHead}
            <div className="dc-page-body">
              <table className={`dc-table dc-paged-table${colWidths ? ' dc-table-fixed' : ''}`}>
                {colGroup}
                {tableHead}
                <tbody>{bodyRows}</tbody>
              </table>
            </div>
            {runningFoot}
          </article>
        </div>
      )}

      {!measuring && pages.map((rowIndexes, pageIndex) => (
        <article key={`cert-page-${pageIndex}`} className="print-page digital-cert dc-certificate dc-cert-page">
          {runningHead}
          <div className="dc-page-body">
            <table className="dc-table dc-paged-table dc-table-fixed">
              {colGroup}
              {tableHead}
              <tbody>{rowIndexes.map((index) => bodyRows[index])}</tbody>
            </table>
          </div>
          {runningFoot}
        </article>
      ))}

      {/* Aadhar & PAN (back of the certificate) */}
      {(aadharFrontDoc || aadharBackDoc || valuation.panPhoto) && (
        <article className="print-page digital-cert dc-page2">
          <h2 className="dc-page2-title">KYC Documents — {customer.name || 'Borrower'}</h2>
          <p className="dc-page2-ref">Ref: Certificate No. {valuation.valuationNumber} | Date: {dateStr} {timeStr}</p>
          <div className="dc-doc-grid">
            {(aadharFrontDoc || aadharBackDoc) && (
              <div className="dc-doc-box">
                <p className="dc-doc-label">Aadhar Card</p>
                <div className="dc-doc-stack">
                  {aadharFrontDoc && (
                    <div className="dc-doc-stack-item">
                      <p className="dc-doc-sub-label">Front Side</p>
                      <img src={aadharFrontDoc} alt="Aadhar Card Front" />
                    </div>
                  )}
                  {aadharBackDoc && (
                    <div className="dc-doc-stack-item">
                      <p className="dc-doc-sub-label">Back Side</p>
                      <img src={aadharBackDoc} alt="Aadhar Card Back" />
                    </div>
                  )}
                </div>
              </div>
            )}
            {valuation.panPhoto && (
              <div className="dc-doc-box">
                <p className="dc-doc-label">PAN Card</p>
                <img src={valuation.panPhoto} alt="PAN Card" />
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  )
}
