import { inr, num } from '../../lib/format'
import QrImage from '../QrImage'
import { verificationUrl } from '../../lib/qr'

function parseDateLike(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw
  const out = new Date(normalized)
  return Number.isNaN(out.getTime()) ? null : out
}

export function resolveReportDateTime(valuation) {
  return (
    parseDateLike(valuation?.printedAt)
    || parseDateLike(valuation?.updatedAt)
    || parseDateLike(valuation?.createdAt)
    || parseDateLike(valuation?.valuationDate)
    || new Date()
  )
}

export function PhotoBox({ src, label }) {
  return <div className="print-photo">{src ? <img src={src} alt={label} /> : <span>{label}</span>}</div>
}

export function OrnamentTable({ valuation }) {
  const items = valuation.items || []
  const totals = items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, value: 0 })

  return (
    <table className="print-table">
      <thead>
        <tr className="print-table-info">
          <th>Sr.</th>
          <th>Description of jewels / Ornaments</th>
          <th></th>
          <th>No. of jewels</th>
          <th>Total Gross weight of jewellery including wax, stones, beads, plastic, lac, alloy, strings, fastrings, dust &amp; other Material</th>
          <th>Approx Equivalent Weight of Carat Jewellery Contents</th>
          <th>Purity in Carat</th>
          <th>By(BJA) Indian Bullion Jewellers Association ltd, Mumbai 22 carat Gold Price. Total Approx Value of The Jewellery</th>
        </tr>
        <tr><th>No.</th><th>Assessed</th><th>Remarks</th><th>Ornaments</th><th>In Grams</th><th>In Grams</th><th>Carat</th><th>In Rs.</th></tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.id || index}>
            <td>{index + 1}</td><td>{item.description}</td><td>{item.remarks || '-'}</td><td>{item.noOfUnits}</td><td>{num(item.grossWeightGm, 3)}</td><td>{num(item.netWeightGm, 3)}</td><td>{item.purityCarat || 22}K</td><td>{inr(item.approxValueInr)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan="2">Total</td><td></td><td>{totals.units}</td><td>{num(totals.gross, 3)}</td><td>{num(totals.net, 3)}</td><td></td><td>{inr(totals.value)}</td></tr></tfoot>
    </table>
  )
}

export function LetterheadSubheader({ profile }) {
  if (!profile) return null
  const proprietor = profile.appraiser_name
  const qualification = profile.qualification
  const organization = profile.organization
  const address = profile.address
  const certNumber = profile.cert_number
  if (!proprietor && !qualification && !organization && !certNumber) return null
  return (
    <div className="letterhead-subheader">
      {proprietor && <p>Propriter, {proprietor}{qualification ? `, ${qualification}` : ''}</p>}
      {organization && <p>{organization}</p>}
      {address && <p>{address}{certNumber ? ` No. ${certNumber}` : ''}</p>}
      {!address && certNumber && <p>No. {certNumber}</p>}
    </div>
  )
}

export function SignatureGrid({ labels }) {
  return <div className="signature-grid">{labels.map((label) => <div key={label} className="signature-box">{label}</div>)}</div>
}

export function VerificationBlock({ valuation, profile }) {
  if (!valuation?.valuationNumber) return null
  const reportDateTime = resolveReportDateTime(valuation)
  const dateStr = reportDateTime.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = reportDateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const valuerName = profile?.appraiser_name || profile?.appraiserName || ''
  return (
    <div className="verification-block print-avoid-break">
      <QrImage text={verificationUrl(valuation.valuationNumber)} className="verification-qr" />
      <div>
        <b>Scan to verify certificate</b>
        <p>{valuation.valuationNumber}</p>
        <p style={{ fontSize: '9px', marginTop: 2 }}>{dateStr} at {timeStr}</p>
        {valuerName && <p style={{ fontSize: '9px' }}>Valuer: {valuerName}</p>}
      </div>
    </div>
  )
}

const DEFAULT_RULES = `I hereby certify that value of the above jewels is not less than value mentioned above.
I also certify that the fineness / purity weights and valuation rates given above are correct.
Further, I declare that the applicant is / are not my relative / associate etc., and I also do not have any interest whatsoever in the gold ornaments / jewellery that have been assessed / appraised by me.`

export function CertificateRules({ valuation, className = 'certificate-rules' }) {
  const text = valuation?.certificateRules || DEFAULT_RULES
  return (
    <div className={className}>
      {text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
    </div>
  )
}

export function OrnamentPhotoStrip({ valuation }) {
  const photos = valuation.ornamentPhotos || []
  if (!photos.length) return null
  return (
    <div className="ornament-strip">
      {photos.slice(0, 6).map((photo, index) => <img key={index} src={photo} alt={`Ornament ${index + 1}`} />)}
    </div>
  )
}
