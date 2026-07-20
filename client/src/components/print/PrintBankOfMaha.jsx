import { useEffect, useState } from 'react'
import { formatDateDMY, inr } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, OrnamentPhotoStrip, OrnamentTable, PhotoBox, SignatureGrid, VerificationBlock } from './PrintHelpers'

export default function PrintBankOfMaha({ valuation }) {
  const customer = valuation.customer || {}
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])
  return (
    <article className="print-page bank-pass">
      <header className="bank-header">
        <PhotoBox src={valuation.personPhoto} label="Borrower Photo" />
        <div>
          <h1>Gold Valuation Certificate</h1>
          <div className="bank-fields">
            <p><b>Loan Amount:</b> {inr(valuation.loanAmount)}</p><p><b>Loan A/C No:</b> {valuation.acNo}</p>
            <p><b>Borrower:</b> {customer.name}</p><p><b>Mobile:</b> {customer.mobile}</p>
            <p><b>Rate:</b> {valuation.rateOfInterest || '-'}</p><p><b>Aadhar:</b> {customer.aadharNumber || '-'}</p>
            <p><b>Customer ID:</b> {customer.customerCode}</p><p><b>22K Rate:</b> {inr(valuation.goldRate22k)}</p>
            <p><b>Savings A/C:</b> {customer.savingsAcNo || valuation.acNo}</p><p><b>Date:</b> {formatDateDMY(valuation.valuationDate)}</p>
            <p><b>Branch:</b> {valuation.branch}</p><p><b>Bank:</b> Bank of Maharashtra</p>
          </div>
        </div>
        <PhotoBox src={valuation.jewelleryPhoto} label="Ornaments Photo" />
      </header>
      <p className="print-copy">This is to certify that I have verified the gold ornaments submitted by {customer.name} for a gold loan from the Bank of Maharashtra. I have examined the purity, weight, and value of the ornaments and take full responsibility for the assessment.</p>
      <OrnamentTable valuation={valuation} />
      <OrnamentPhotoStrip valuation={valuation} />
      <p className="print-copy">* Net Weight = Gross Weight - Weight of Wax, Stones, Dust etc.</p>
      <p className="print-copy">Declaration of Borrower: I, {customer.name}, hereby declare that I have submitted the above ornaments to the bank in good faith and without any coercion.</p>
      <CertificateRules valuation={valuation} />
      <div className="print-summary"><span>Valuation: {inr(valuation.marketValue)}</span><span>Recommended for Loan: {inr(valuation.loanAmount)}</span></div>
      <VerificationBlock valuation={valuation} profile={profile} />
      <SignatureGrid labels={['Signature of Appraiser', 'Signature of Borrower', 'Manager/Officer']} />
      <p className="print-note">** Note: Interest rates are subject to RBI and bank regulations and may change. **</p>
    </article>
  )
}
