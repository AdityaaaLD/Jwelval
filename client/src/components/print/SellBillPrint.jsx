import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'
import { LetterheadSubheader } from './PrintHelpers'

export default function SellBillPrint({ bill, onClose }) {
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])

  const customer = bill.customer || {}
  const items = bill.items || []
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const businessName = profile?.business_name || 'Jewellery Shop'

  const handlePrint = () => window.print()

  const content = (
    <div id="print-portal" className="print-overlay">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-primary" onClick={handlePrint}><Printer size={16} /> Print / Save PDF</button>
      </div>
      <div className="print-preview-scroll">
        <div className="print-preview-center">
          <article className="sb-page">
            {/* ── Header ── */}
            <header className="sb-header">
              <h1 className="sb-business-name">{businessName}</h1>
              <LetterheadSubheader profile={profile} />
              <div className="sb-header-meta">
                {profile?.address && <span>{profile.address}</span>}
                {profile?.mobile && <span>Mob: {profile.mobile}</span>}
                {profile?.email && <span>Email: {profile.email}</span>}
                {profile?.gstn && <span>GSTN: {profile.gstn}</span>}
              </div>
            </header>

            {/* ── Title Bar ── */}
            <div className="sb-title-bar">
              <span>TAX INVOICE</span>
            </div>

            {/* ── Bill & Customer Info ── */}
            <section className="sb-info-grid">
              <div className="sb-info-left">
                <p className="sb-info-label">Bill To</p>
                <p className="sb-customer-name">{customer.name || '—'}</p>
                {customer.mobile && <p>Mo: {customer.mobile}</p>}
                {customer.address && <p>{customer.address}</p>}
                {customer.aadharNumber && <p>Aadhar: {customer.aadharNumber}</p>}
              </div>
              <div className="sb-info-right">
                <table className="sb-meta-table">
                  <tbody>
                    <tr><td>Invoice No.</td><td>{bill.billNumber}</td></tr>
                    <tr><td>Date</td><td>{bill.billDate}</td></tr>
                    {bill.paymentMode && <tr><td>Payment</td><td>{bill.paymentMode}</td></tr>}
                    {bill.valuationId && <tr><td>Valuation Ref</td><td>#{bill.valuationId}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Items Table ── */}
            <table className="sb-table">
              <thead>
                <tr>
                  <th className="sb-th-sr">#</th>
                  <th className="sb-th-desc">Particulars</th>
                  <th className="sb-th-amt">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="sb-td-sr">{it.srNo || i + 1}</td>
                    <td>{it.particular}</td>
                    <td className="sb-td-amt">{inr(it.amount)}</td>
                  </tr>
                ))}
                {/* Pad empty rows for visual balance when few items */}
                {items.length < 4 && Array.from({ length: 4 - items.length }).map((_, i) => (
                  <tr key={`pad-${i}`} className="sb-pad-row">
                    <td className="sb-td-sr">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="sb-td-amt">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Totals ── */}
            <div className="sb-totals">
              <div className="sb-totals-spacer" />
              <table className="sb-totals-table">
                <tbody>
                  <tr>
                    <td>Subtotal</td>
                    <td className="sb-td-amt">{inr(subtotal)}</td>
                  </tr>
                  {bill.gstPercent > 0 && (
                    <tr>
                      <td>CGST @ {(bill.gstPercent / 2).toFixed(1)}%</td>
                      <td className="sb-td-amt">{inr(bill.gstAmount / 2)}</td>
                    </tr>
                  )}
                  {bill.gstPercent > 0 && (
                    <tr>
                      <td>SGST @ {(bill.gstPercent / 2).toFixed(1)}%</td>
                      <td className="sb-td-amt">{inr(bill.gstAmount / 2)}</td>
                    </tr>
                  )}
                  <tr className="sb-grand-total">
                    <td>Grand Total</td>
                    <td className="sb-td-amt">{inr(bill.total)}</td>
                  </tr>
                  {bill.advance > 0 && (
                    <tr>
                      <td>Advance Paid</td>
                      <td className="sb-td-amt">− {inr(bill.advance)}</td>
                    </tr>
                  )}
                  {bill.advance > 0 && (
                    <tr className="sb-balance-due">
                      <td>Balance Due</td>
                      <td className="sb-td-amt">{inr(bill.balance)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Terms ── */}
            <div className="sb-terms">
              <p><b>Terms & Conditions:</b></p>
              <p>1. Goods once sold will not be taken back or exchanged.</p>
              <p>2. All disputes subject to local jurisdiction.</p>
            </div>

            {/* ── Signature ── */}
            <div className="sb-signature-grid">
              <div className="sb-sig-box">
                <div className="sb-sig-line" />
                <p>Customer Signature</p>
              </div>
              <div className="sb-sig-box sb-sig-right">
                <div className="sb-sig-line" />
                <p>For <b>{businessName}</b></p>
                <p className="sb-sig-sub">Authorised Signatory</p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="sb-footer">
              <p>Thank you for your business!</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
