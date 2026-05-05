import { inr, num } from '../../lib/format'
import QrImage from '../QrImage'
import { verificationUrl } from '../../lib/qr'

export function PhotoBox({ src, label }) {
  return <div className="print-photo">{src ? <img src={src} alt={label} /> : <span>{label}</span>}</div>
}

export function OrnamentTable({ valuation }) {
  const items = valuation.items || []
  const totals = items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    gold24: acc.gold24 + (Number(item.net24kGoldGm) || 0),
    gold22: acc.gold22 + (Number(item.net22kGoldGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, gold24: 0, gold22: 0, value: 0 })

  return (
    <table className="print-table">
      <thead><tr><th>Sr.</th><th>Description</th><th>Units</th><th>Purity %</th><th>Carat</th><th>Gross Wt</th><th>Net Wt</th><th>Net 24K</th><th>Net 22K</th><th>Approx Value</th></tr></thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item.id || index}>
            <td>{index + 1}</td><td>{item.description}</td><td>{item.noOfUnits}</td><td>{num(item.purityPercent, 2)}</td><td>{num(item.purityCarat, 2)}</td><td>{num(item.grossWeightGm, 3)}</td><td>{num(item.netWeightGm, 3)}</td><td>{num(item.net24kGoldGm, 3)}</td><td>{num(item.net22kGoldGm, 3)}</td><td>{inr(item.approxValueInr)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan="2">Total</td><td>{totals.units}</td><td></td><td></td><td>{num(totals.gross, 3)}</td><td>{num(totals.net, 3)}</td><td>{num(totals.gold24, 3)}</td><td>{num(totals.gold22, 3)}</td><td>{inr(totals.value)}</td></tr></tfoot>
    </table>
  )
}

export function SignatureGrid({ labels }) {
  return <div className="signature-grid">{labels.map((label) => <div key={label} className="signature-box">{label}</div>)}</div>
}

export function VerificationBlock({ valuation }) {
  if (!valuation?.valuationNumber) return null
  return (
    <div className="verification-block">
      <QrImage text={verificationUrl(valuation.valuationNumber)} className="verification-qr" />
      <div>
        <b>Scan to verify certificate</b>
        <p>{valuation.valuationNumber}</p>
      </div>
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
