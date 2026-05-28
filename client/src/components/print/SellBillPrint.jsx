import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

export default function SellBillPrint({ bill, onClose }) {
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile) }, [])

  const customer = bill.customer || {}
  const items = bill.items || []
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)

  const handlePrint = () => window.print()

  const content = (
    <div className="print-overlay fixed inset-0 z-[9999] bg-white overflow-auto">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-slate-100 px-4 py-3 border-b">
        <span className="font-semibold">Sell Bill Preview — {bill.billNumber}</span>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={handlePrint}>Print</button>
          <button className="btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
      </div>

      <article className="sell-bill-print mx-auto max-w-[210mm] p-8" style={{ fontFamily: 'serif', fontSize: '13px', lineHeight: 1.5 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            {profile?.businessName || profile?.business_name || 'Jewellery Shop'}
          </h2>
          <p style={{ margin: '2px 0', fontSize: '12px' }}>{profile?.address || ''}</p>
          {profile?.gstn && <p style={{ margin: '2px 0', fontSize: '11px' }}>GSTN: {profile.gstn}</p>}
          <p style={{ margin: '2px 0', fontSize: '11px' }}>Mob: {profile?.mobile || ''}</p>
        </div>

        <hr style={{ border: '1px solid #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <p><b>M/s.</b> {customer.name}</p>
            <p style={{ fontSize: '11px' }}>{customer.address || ''}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><b>Bill No:</b> {bill.billNumber}</p>
            <p><b>Date:</b> {bill.billDate}</p>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
              <th style={{ padding: '4px', textAlign: 'left', width: '40px' }}>No.</th>
              <th style={{ padding: '4px', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '4px', textAlign: 'right', width: '120px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '3px 4px' }}>{it.srNo || i + 1}</td>
                <td style={{ padding: '3px 4px' }}>{it.particular}</td>
                <td style={{ padding: '3px 4px', textAlign: 'right' }}>{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ borderTop: '2px solid #000', marginTop: '4px', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ width: '250px', fontSize: '12px' }}>
              <tbody>
                <tr><td>Subtotal</td><td style={{ textAlign: 'right' }}>{inr(subtotal)}</td></tr>
                {bill.gstPercent > 0 && <tr><td>CGST ({(bill.gstPercent / 2).toFixed(1)}%)</td><td style={{ textAlign: 'right' }}>{inr(bill.gstAmount / 2)}</td></tr>}
                {bill.gstPercent > 0 && <tr><td>SGST ({(bill.gstPercent / 2).toFixed(1)}%)</td><td style={{ textAlign: 'right' }}>{inr(bill.gstAmount / 2)}</td></tr>}
                <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}>
                  <td>Grand Total</td><td style={{ textAlign: 'right' }}>{inr(bill.total)}</td>
                </tr>
                {bill.advance > 0 && <tr><td>Advance</td><td style={{ textAlign: 'right' }}>- {inr(bill.advance)}</td></tr>}
                {bill.advance > 0 && <tr style={{ fontWeight: 'bold' }}><td>Balance</td><td style={{ textAlign: 'right' }}>{inr(bill.balance)}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>


        {/* Signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', width: '140px', marginTop: '30px' }}></div>
            <p style={{ fontSize: '11px' }}>Receiver's Signature</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', width: '140px', marginTop: '30px' }}></div>
            <p style={{ fontSize: '11px' }}>For {profile?.businessName || profile?.business_name || ''}</p>
          </div>
        </div>
      </article>
    </div>
  )

  return createPortal(content, document.body)
}
