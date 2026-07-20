import { useEffect, useState } from 'react'
import { formatDateDMY, inr } from '../../lib/format'
import { api } from '../../lib/api'
import { CertificateRules, LetterheadSubheader, OrnamentPhotoStrip, OrnamentTable, PhotoBox, SignatureGrid, VerificationBlock } from './PrintHelpers'

export default function PrintRushikesh({ valuation }) {
  const customer = valuation.customer || {}
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])
  return (
    <article className="print-page">
      <header className="print-letterhead">
        <PhotoBox src={valuation.personPhoto} label="Borrower Photo" />
        <div>
          <h1>{profile?.business_name || 'RUSHIKESH JEWELLERS'}</h1>
          <LetterheadSubheader profile={profile} />
          {profile?.mobile && <p>Mo: {profile.mobile}</p>}
        </div>
        <PhotoBox src={valuation.jewelleryPhoto} label="Jewellery Photo" />
      </header>
      <div className="print-title"><strong>GOLD VALUATION CERTIFICATE</strong><span>Date: {formatDateDMY(valuation.valuationDate)}</span></div>
      <section className="print-two-col"><div><p>The Branch Manager, Bank Of Maharashtra</p><p>Branch: {valuation.branch}</p><p>A/C NO: {valuation.acNo}</p></div><div><p>Customer: {customer.name}</p><p>Mo.No: {customer.mobile}</p><p>Valuation No: {valuation.valuationNumber}</p></div></section>
      <p className="print-copy">At the request of Shri/Smt. {customer.name}, I have appraised the following ornaments, the details of which are given below.</p>
      <OrnamentTable valuation={valuation} />
      <OrnamentPhotoStrip valuation={valuation} />
      <div className="print-summary"><span>Market Value: {inr(valuation.marketValue)}</span><span>Recommended Loan Amount: {inr(valuation.loanAmount)}</span></div>
      <VerificationBlock valuation={valuation} profile={profile} />
      <CertificateRules valuation={valuation} />
      <SignatureGrid labels={['Branch Manager', 'Joint Custodian', `Customer: ${customer.name || ''}`, 'Appraiser With Name']} />
    </article>
  )
}
