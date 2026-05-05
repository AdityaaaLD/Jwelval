import { inr } from '../../lib/format'
import QrImage from '../QrImage'
import { upiUrl } from '../../lib/qr'

export default function FeeReceipt({ valuation, profile }) {
  const customer = valuation.customer || {}
  const upi = profile?.upi_id || profile?.upiId || ''
  return (
    <article className="fee-receipt">
      <h2>Valuation Fee Receipt</h2>
      <div className="receipt-grid">
        <p><b>Receipt For:</b> {valuation.valuationNumber}</p>
        <p><b>Date:</b> {valuation.valuationDate}</p>
        <p><b>Customer:</b> {customer.name}</p>
        <p><b>Mobile:</b> {customer.mobile || '-'}</p>
        <p><b>Valuation Fee:</b> {inr(valuation.valuationFee)}</p>
        <p><b>Appraiser:</b> {profile?.business_name || profile?.businessName || 'JewelVal Appraiser'}</p>
      </div>
      {upi && (
        <div className="receipt-upi">
          <QrImage text={upiUrl({ upiId: upi, name: profile?.business_name, amount: valuation.valuationFee, note: valuation.valuationNumber })} className="verification-qr" />
          <p>Scan to pay fee by UPI<br />{upi}</p>
        </div>
      )}
    </article>
  )
}
