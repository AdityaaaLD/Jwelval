import { useState } from 'react'
import { formatDateDMY, inr } from '../../lib/format'
import QrImage from '../QrImage'
import { upiUrl } from '../../lib/qr'

export default function FeeReceipt({ valuation, profile }) {
  const customer = valuation.customer || {}
  const upi = profile?.upi_id || profile?.upiId || ''
  const [includeGst, setIncludeGst] = useState(true)
  const fee = Number(valuation.valuationFee) || 0
  const cgst = includeGst ? +(fee * 0.09).toFixed(2) : 0
  const sgst = includeGst ? +(fee * 0.09).toFixed(2) : 0
  const gstAmount = +(cgst + sgst).toFixed(2)
  const totalWithGst = +(fee + gstAmount).toFixed(2)

  return (
    <article className="fee-receipt">
      <h2>Valuation Fee Receipt</h2>
      <div className="receipt-grid">
        <p><b>Receipt For:</b> {valuation.valuationNumber}</p>
        <p><b>Date:</b> {formatDateDMY(valuation.valuationDate)}</p>
        <p><b>Customer:</b> {customer.name}</p>
        <p><b>Mobile:</b> {customer.mobile || '-'}</p>
        <p><b>Valuation Fee:</b> {inr(fee)}</p>
        {includeGst && <p><b>CGST (9%):</b> {inr(cgst)}</p>}
        {includeGst && <p><b>SGST (9%):</b> {inr(sgst)}</p>}
        <p><b>Total Payable:</b> <strong>{inr(totalWithGst)}</strong></p>
        <p><b>Appraiser:</b> {profile?.business_name || profile?.businessName || 'JewelVal Appraiser'}</p>
        {profile?.gstn && <p><b>GSTN:</b> {profile.gstn}</p>}
      </div>
      <label className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer', fontSize: '14px' }}>
        <input type="checkbox" checked={includeGst} onChange={(e) => setIncludeGst(e.target.checked)} />
        Include 18% GST on valuation fee
      </label>
      {upi && (
        <div className="receipt-upi">
          <QrImage text={upiUrl({ upiId: upi, name: profile?.business_name, amount: totalWithGst, note: valuation.valuationNumber })} className="verification-qr" />
          <p>Scan to pay fee by UPI<br />{upi}</p>
        </div>
      )}
    </article>
  )
}
