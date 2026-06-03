import { useEffect, useState } from 'react'
import { num } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, SignatureGrid, VerificationBlock } from './PrintHelpers'

export default function PrintDigitalCert({ valuation }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])

  const totals = items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, value: 0 })

  const dateStr = valuation.valuationDate
    ? new Date(valuation.valuationDate + 'T00:00:00').toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    : ''

  return (
    <div>
      {/* PAGE 1 — Certificate */}
      <article className="print-page digital-cert">
        <header className="dc-header-box">
          <p className="dc-header-line" style={{ fontSize: '18px', letterSpacing: '1px' }}><b>{(profile?.business_name || 'JEWELLERS').toUpperCase()}</b></p>
          <p className="dc-header-line">Proprietor, {profile?.appraiser_name || ''}, {profile?.qualification || 'Government Approved Gold Appaisal'}</p>
          {profile?.organization && <p className="dc-header-line">({profile.organization})</p>}
          <p className="dc-header-line">{profile?.address || ''}</p>
          {profile?.cert_number && <p className="dc-header-line">No. {profile.cert_number}</p>}
          <p className="dc-header-line">{[profile?.mobile ? `Mob: ${profile.mobile}` : '', profile?.email || ''].filter(Boolean).join(' | ')}{profile?.gstn ? ` | GSTN: ${profile.gstn}` : ''}</p>
          {profile?.empanelment_id && <p className="dc-header-line">(Digital ID of Empanelment: {profile.empanelment_id})</p>}
        </header>

        <div className="dc-row-box">
          <span>Application ID: {valuation.applicationId || ''}</span>
        </div>
        <div className="dc-row-box dc-row-split">
          <span>Certificate No: {valuation.valuationNumber}</span>
          <span>Date: {dateStr}</span>
        </div>

        <div className="dc-row-box dc-parties">
          <div>
            <p><b>From,</b></p>
            <p>{profile?.appraiser_name || ''}</p>
            {profile?.empanelment_id && <p>Empanelment ID: {profile.empanelment_id}</p>}
          </div>
          <div>
            <p><b>To,</b></p>
            <p>Branch Manager,</p>
            <p>{valuation.branch}{valuation.branchCode ? ` (Br. Code: ${valuation.branchCode})` : ''}</p>
          </div>
        </div>

        <div className="dc-row-box dc-borrower">
          <p><b>Borrower Name: {customer.name}</b></p>
          <p><b>Borrower Mob. No: {customer.mobile}</b></p>
          {(valuation.acNo || customer.savingsAcNo) && <p><b>A/C No: {valuation.acNo || customer.savingsAcNo}</b></p>}
          <p><b>Bank: {customer.bankName || 'Bank of Maharashtra'}, Branch: {valuation.branch || customer.branch || ''}</b></p>
        </div>

        <p className="dc-currency">(Rs. in Actual)</p>

        {valuation.loanType && (
          <div className="dc-row-box">
            <span><b>Loan Type:</b> {valuation.loanType}</span>
            {valuation.rateOfInterest != null && <span style={{ marginLeft: '24px' }}><b>Rate of Interest:</b> {valuation.rateOfInterest}%</span>}
          </div>
        )}

        <table className="dc-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Description of Ornaments</th>
              <th>Units</th>
              <th>Karat</th>
              <th>Gross Wt (gm)</th>
              <th>Net Wt (gm)</th>
              <th>Rate/gm</th>
              <th>Approx Value</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const rate22k = Number(valuation.goldRate22k) || 0
              return (
                <tr key={item.id || index}>
                  <td>{index + 1}</td>
                  <td className="dc-td-left">{item.description}</td>
                  <td>{item.noOfUnits}</td>
                  <td>22K</td>
                  <td>{num(item.grossWeightGm, 3)}</td>
                  <td>{num(item.netWeightGm, 3)}</td>
                  <td>{num(rate22k, 0)}</td>
                  <td>{num(item.approxValueInr, 0)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2"><b>Total</b></td>
              <td><b>{totals.units}</b></td>
              <td></td>
              <td><b>{num(totals.gross, 3)}</b></td>
              <td><b>{num(totals.net, 3)}</b></td>
              <td></td>
              <td><b>{num(totals.value, 0)}</b></td>
            </tr>
          </tfoot>
        </table>

        <CertificateRules valuation={valuation} className="dc-cert-text" />

        {/* Photos section — above signature */}
        {(valuation.personPhoto || valuation.jewelleryPhoto) && (
          <div className="dc-photos">
            {valuation.personPhoto && (
              <div className="dc-photo-box">
                <img src={valuation.personPhoto} alt="Borrower" />
                <p>Borrower Photo</p>
              </div>
            )}
            {valuation.jewelleryPhoto && (
              <div className="dc-photo-box">
                <img src={valuation.jewelleryPhoto} alt="Jewellery" />
                <p>Jewellery Photo</p>
              </div>
            )}
          </div>
        )}

        <SignatureGrid labels={['Branch Manager', 'Joint Custodian', `Customer: ${customer.name || ''}`, 'Appraiser With Name']} />

        <VerificationBlock valuation={valuation} profile={profile} />
      </article>

      {/* PAGE 2 — Aadhar & PAN (back of the certificate) */}
      {(valuation.aadharPhotoDoc || valuation.panPhoto) && (
        <article className="print-page digital-cert dc-page2">
          <h2 className="dc-page2-title">KYC Documents — {customer.name || 'Borrower'}</h2>
          <p className="dc-page2-ref">Ref: Certificate No. {valuation.valuationNumber} | Date: {dateStr}</p>
          <div className="dc-doc-grid">
            {valuation.aadharPhotoDoc && (
              <div className="dc-doc-box">
                <p className="dc-doc-label">Aadhar Card</p>
                <img src={valuation.aadharPhotoDoc} alt="Aadhar Card" />
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
