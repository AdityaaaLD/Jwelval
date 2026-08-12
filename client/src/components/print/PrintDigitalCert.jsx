import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDateDMY, inr, num } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, SignatureGrid, resolveReportDateTime } from './PrintHelpers'
import QrImage from '../QrImage'
import WhatsAppMark from '../WhatsAppMark'
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
function paginateRows(rowHeights, { headerHeight, footerHeight, theadHeight, reservedHeight = 0 }) {
  const capacity = USABLE_PX - headerHeight - footerHeight - theadHeight - reservedHeight
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

/**
 * `includeKyc` is false for the shared/bank copy. The KYC sheet stays in the
 * on-screen preview and in Print / Save PDF so the appraiser keeps it for their
 * own records, but it is never rendered into the PDF that gets shared.
 */
export default function PrintDigitalCert({ valuation, includeKyc = true, qrBaseUrl = '' }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const aadharFrontDoc = valuation.aadharPhotoDoc || customer.aadharPhoto || ''
  const aadharBackDoc = customer.aadharPhotoBack || ''
  const [profile, setProfile] = useState(null)
  const [bankPreset, setBankPreset] = useState(null)
  const [resolvedQrBaseUrl, setResolvedQrBaseUrl] = useState('')
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])
  useEffect(() => {
    const explicit = String(qrBaseUrl || '').trim()
    if (explicit) {
      setResolvedQrBaseUrl(explicit)
      return
    }
    let alive = true
    api.verifyBaseUrl()
      .then((data) => {
        if (!alive) return
        setResolvedQrBaseUrl(String(data?.baseUrl || '').trim())
      })
      .catch(() => {
        if (!alive) return
        setResolvedQrBaseUrl('')
      })
    return () => { alive = false }
  }, [qrBaseUrl])
  useEffect(() => {
    const presetId = Number(valuation?.bankPresetId)
    api.presets.banks()
      .then((rows) => {
        const byId = presetId ? rows.find((row) => Number(row.id) === presetId) : null
        if (byId) {
          setBankPreset(byId)
          return
        }

        const wantedBank = String(valuation?.customer?.bankName || '').trim().toLowerCase()
        const wantedBranch = String(valuation?.branch || valuation?.customer?.branch || '').trim().toLowerCase()
        if (!wantedBank) {
          setBankPreset(null)
          return
        }

        const fallback = rows.find((row) => {
          const rowBank = String(row.bankName || '').trim().toLowerCase()
          const rowBranch = String(row.branch || '').trim().toLowerCase()
          if (rowBank !== wantedBank) return false
          return wantedBranch ? rowBranch === wantedBranch : true
        }) || null

        setBankPreset(fallback)
      })
      .catch(() => setBankPreset(null))
  }, [valuation?.bankPresetId, valuation?.branch, valuation?.customer?.bankName, valuation?.customer?.branch])

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
  const qrVerifyLink = verificationUrl(valuation.valuationNumber, { baseUrl: resolvedQrBaseUrl || qrBaseUrl })
  const empanelmentId = bankPreset?.empanelmentId || valuation?.empanelmentId || ''
  const bankName = bankPreset?.bankName || customer.bankName || 'Bank of Maharashtra'
  const branchName = valuation.branch || bankPreset?.branch || customer.branch || '-'
  const branchCode = valuation.branchCode || bankPreset?.branchCode || ''
  const bankManagerName = bankPreset?.managerName || 'Branch Manager'
  const borrowerAadhar = customer.aadharNumber || '-'
  const renewalDateStr = formatDateDMY(valuation.renewalDate)
  const totalMarketValue = Number(valuation.marketValue) > 0 ? Number(valuation.marketValue) : totals.value
  const dateStr = formatDateDMY(reportDateTime)
  const timeStr = reportDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  /* Rates and loan figures shown above the ornament table. Entries with no
     value are dropped so the grid never prints an empty label. */
  const metaEntries = [
    valuation.loanType && ['Loan Type', valuation.loanType],
    Number(valuation.tenureMonths) > 0 && ['Tenure (Months)', `${num(valuation.tenureMonths, 0)}`],
    valuation.rateOfInterest != null && ['Rate of Interest', `${num(valuation.rateOfInterest, 2)}%`],
    Number(valuation.loanLtv) > 0 && ['LTV', `${num(valuation.loanLtv, 0)}%`],
    Number(valuation.goldRate22k) > 0 && ['Market Gold Rate (22K)', `${inr(valuation.goldRate22k)}/gm`],
    Number(valuation.bankGoldRatePerGram) > 0 && ['Bank Gold Rate', `${inr(valuation.bankGoldRatePerGram)}/gm`],
    Number(totalMarketValue) > 0 && ['Total Market Value', inr(totalMarketValue)],
    Number(valuation.loanAmount) > 0 && ['Loan Amount', inr(valuation.loanAmount)],
    Number(valuation.bankRecommendedValue) > 0 && ['Bank Loan Amount', inr(valuation.bankRecommendedValue)],
  ].filter(Boolean)

  const runningHead = (
    <div className="dc-running-head">
      <header className="dc-header-box">
        {profile?.logo_photo && (
          <div className="dc-header-logo-badge">
            <img src={profile.logo_photo} alt="Shop Logo" className="dc-header-logo-image" />
          </div>
        )}
        <div className="dc-header-qr-badge">
          <QrImage text={qrVerifyLink} className="dc-header-qr-image" qrOptions={{ width: 360, margin: 2 }} />
          <p>Scan &amp; Verify</p>
        </div>
        <p className="dc-header-line" style={{ fontSize: '18px', letterSpacing: '1px', color: '#b8860b' }}><b>{(profile?.business_name || 'JEWELLERS').toUpperCase()}</b></p>
        <p className="dc-header-line" style={{ color: '#b91c1c' }}>Proprietor, {profile?.appraiser_name || ''}, {profile?.qualification || 'Government Approved Gold Appaisal'}</p>
        {profile?.organization && <p className="dc-header-line" style={{ color: '#b91c1c' }}>({profile.organization})</p>}
        <p className="dc-header-line" style={{ color: '#b91c1c' }}>{profile?.address || ''}</p>
        {profile?.cert_number && <p className="dc-header-line" style={{ color: '#b91c1c' }}>No. {profile.cert_number}</p>}
        <p className="dc-header-line dc-header-contact" style={{ color: '#b91c1c' }}>
          {profile?.mobile && <span>Mob: {profile.mobile}</span>}
          {profile?.whatsapp_number && (
            <span className="dc-header-whatsapp">
              <WhatsAppMark className="dc-whatsapp-icon" />
              {profile.whatsapp_number}
            </span>
          )}
          {profile?.email && <span>{profile.email}</span>}
          {profile?.gstn && <span>GSTN: {profile.gstn}</span>}
        </p>
        {profile?.bank_account_number && <p className="dc-header-line" style={{ color: '#b91c1c' }}>Bank A/C: {profile.bank_account_number}</p>}
        {empanelmentId && <p className="dc-header-line" style={{ color: '#b91c1c' }}>(Digital ID of Empanelment: {empanelmentId})</p>}
      </header>

      <div className="dc-row-box dc-row-split">
        <span>Application ID: {valuation.applicationId || ''}{valuation.goldLoanRegisterNo ? ` | Gold Loan Register No.: ${valuation.goldLoanRegisterNo}` : ''}</span>
        <span>Date: {dateStr} {timeStr}</span>
      </div>
      <div className="dc-row-box dc-row-split">
        <span>Certificate No: {valuation.valuationNumber}{valuation.goldPacketsNo ? ` | Gold Packets No.: ${valuation.goldPacketsNo}` : ''}</span>
        <span>Renewal Date: {renewalDateStr || '-'}</span>
      </div>

      <div className="dc-row-box dc-parties dc-parties-with-photos">
        <div className="dc-party-from">
          <p><b>From,</b></p>
          <p><b>Business Name:</b> {profile?.business_name || '-'}</p>
          <p><b>Proprietor Name:</b> {profile?.appraiser_name || '-'}</p>
          <p><b>Empanelment ID:</b> {empanelmentId || '-'}</p>
        </div>
        <div className="dc-party-to-photos">
          <div className="dc-party-to">
            <p><b>To,</b></p>
            <p><b>Bank Name:</b> {bankName}</p>
            <p><b>Bank Manager Name:</b> {bankManagerName || '-'}</p>
            <p><b>Branch Code:</b> {branchCode || '-'}</p>
            <p><b>Branch:</b> {branchName}</p>
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
        <p><b>Borrower Name:</b> {customer.name} <span className="dc-borrower-sep">|</span> <b>Aadhaar No:</b> {borrowerAadhar} <span className="dc-borrower-sep">|</span> <b>Borrower Mob. No:</b> {customer.mobile || '-'}</p>
        <p>
          {(valuation.acNo || customer.savingsAcNo) && <><b>A/C No:</b> {valuation.acNo || customer.savingsAcNo} <span className="dc-borrower-sep">|</span> </>}
          <b>Bank:</b> {bankName}, <b>Branch:</b> {branchName}
        </p>
      </div>

      {/* Rates and loan figures, laid out on a fixed grid so the block stays
          compact and the columns line up however many entries are present. */}
      <div className="dc-row-box dc-loan-meta">
        {metaEntries.map(([label, value]) => (
          <span className="dc-meta-cell" key={label}>
            <b>{label}:</b> {value}
          </span>
        ))}
      </div>
    </div>
  )

  const certFooter = (
    <div className="dc-cert-footer-box">
      <div className="dc-cert-footer">
        <div className="dc-cert-footer-rules">
          <CertificateRules valuation={valuation} className="dc-cert-text" />
        </div>
        {bankPreset?.bankLogo && (
          <div className="dc-cert-footer-logo-wrap">
            <img src={bankPreset.bankLogo} alt="Bank Logo" className="dc-bank-logo" />
          </div>
        )}
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

  // Ornament item rows to be distributed over pages.
  const bodyRows = useMemo(() => items.map((item, index) => (
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
  )), [items])

  const totalRow = (
    <tr key="totals" className="dc-total-row">
      <td colSpan="2"><b>Total Market Value</b></td>
      <td></td>
      <td><b>{num(totals.units, 2)}</b></td>
      <td><b>{num(totals.gross, 2)}</b></td>
      <td><b>{num(totals.net, 2)}</b></td>
      <td></td>
      <td><b>{num(totals.value, 2)}</b></td>
    </tr>
  )

  /* Re-measure only when something that changes the layout actually changes.
     Keying on object identity would restart the measure pass on every parent
     re-render. */
  const layoutSignature = [
    valuation.id,
    valuation.updatedAt || '',
    items.length,
    items.map((item) => `${item.description || ''}|${item.remarks || ''}`).join('~'),
    profile ? `${profile.business_name || ''}|${profile.address || ''}|${profile.organization || ''}|${profile.logo_photo ? '1' : '0'}` : '',
    bankPreset ? `${bankPreset.id || ''}|${bankPreset.bankName || ''}|${bankPreset.managerName || ''}|${bankPreset.empanelmentId || ''}|${bankPreset.bankLogo ? '1' : '0'}` : '',
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
    const certFooterBox = root.querySelector('.dc-cert-footer-box')
    const thead = root.querySelector('thead')
    const rows = Array.from(root.querySelectorAll('tbody > tr'))
    const totalRowNode = root.querySelector('tr.dc-total-row')
    if (!head || !foot || !certFooterBox || !thead || !totalRowNode) return undefined

    const rowHeights = rows
      .filter((row) => !row.classList.contains('dc-total-row'))
      .map((row) => row.offsetHeight)
    setPages(paginateRows(rowHeights, {
      headerHeight: head.offsetHeight,
      footerHeight: foot.offsetHeight + certFooterBox.offsetHeight,
      theadHeight: thead.offsetHeight,
      reservedHeight: totalRowNode.offsetHeight,
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
                <tbody>{bodyRows}{totalRow}</tbody>
              </table>
              {certFooter}
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
              <tbody>{rowIndexes.map((index) => bodyRows[index])}{totalRow}</tbody>
            </table>
            {certFooter}
          </div>
          {runningFoot}
        </article>
      ))}

      {/* Aadhar & PAN (back of the certificate) — own records only. */}
      {includeKyc && (aadharFrontDoc || aadharBackDoc || valuation.panPhoto) && (
        <article className="print-page digital-cert dc-page2">
          <p className="dc-kyc-notice no-print">Kept for your records — this sheet is not included in the shared PDF.</p>
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
