import { useEffect, useState } from 'react'
import { formatDateDMY, inr, num } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, SignatureGrid, resolveReportDateTime } from './PrintHelpers'
import QrImage from '../QrImage'
import { verificationUrl } from '../../lib/qr'

export default function PrintDigitalCert({ valuation }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const aadharFrontDoc = valuation.aadharPhotoDoc || customer.aadharPhoto || ''
  const aadharBackDoc = customer.aadharPhotoBack || ''
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])

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

  return (
    <div>
      {/* PAGE 1 — Certificate */}
      <article className="print-page digital-cert">
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

        <table className="dc-table">
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
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || index}>
                <td>{index + 1}</td>
                <td className="dc-td-left">{item.description}</td>
                <td>{item.remarks || '-'}</td>
                <td>{num(item.noOfUnits, 2)}</td>
                <td>{num(item.grossWeightGm, 2)}</td>
                <td>{num(item.netWeightGm, 2)}</td>
                <td>{item.purityCarat || 22}K</td>
                <td>{num(item.approxValueInr, 2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2"><b>Total</b></td>
              <td></td>
              <td><b>{num(totals.units, 2)}</b></td>
              <td><b>{num(totals.gross, 2)}</b></td>
              <td><b>{num(totals.net, 2)}</b></td>
              <td></td>
              <td><b>{num(totals.value, 2)}</b></td>
            </tr>
          </tfoot>
        </table>

        <CertificateRules valuation={valuation} className="dc-cert-text" />
        <div className="dc-signature-footer">
          <SignatureGrid labels={['Branch Manager', 'Joint Custodian', `Customer: ${customer.name || ''}`, 'Appraiser With Name']} />
        </div>
      </article>

      {/* PAGE 2 — Aadhar & PAN (back of the certificate) */}
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
