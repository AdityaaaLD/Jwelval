import { inr } from '../../lib/format'
import { OrnamentPhotoStrip, OrnamentTable, PhotoBox, SignatureGrid, VerificationBlock } from './PrintHelpers'

export default function PrintRushikesh({ valuation }) {
  const customer = valuation.customer || {}
  return (
    <article className="print-page">
      <header className="print-letterhead">
        <PhotoBox src={valuation.personPhoto} label="Borrower Photo" />
        <div>
          <h1>RUSHIKESH JEWELLERS</h1>
          <p>Proprietor: Rameshwar Prakash Udawant</p>
          <p>MSME / Govt Approved Gold Appraiser</p>
          <p>Sr.No. - 638 Samarth Nagar, Bibwewadi, Pune - 411037</p>
          <p>PTDC/TRG/OSP/2021-22/23238 | Membership No.1914/Kholapur</p>
          <p>Mo: 9021642306 / 9921037009</p>
        </div>
        <PhotoBox src={valuation.jewelleryPhoto} label="Jewellery Photo" />
      </header>
      <div className="print-title"><strong>GOLD VALUATION CERTIFICATE</strong><span>Date: {valuation.valuationDate}</span></div>
      <section className="print-two-col"><div><p>The Branch Manager, Bank Of Maharashtra</p><p>Branch: {valuation.branch}</p><p>A/C NO: {valuation.acNo}</p></div><div><p>Customer: {customer.name}</p><p>Mo.No: {customer.mobile}</p><p>Valuation No: {valuation.valuationNumber}</p></div></section>
      <p className="print-copy">At the request of Shri/Smt. {customer.name}, I have appraised the following ornaments, the details of which are given below.</p>
      <OrnamentTable valuation={valuation} />
      <OrnamentPhotoStrip valuation={valuation} />
      <div className="print-summary"><span>Market Value: {inr(valuation.marketValue)}</span><span>Recommended Loan Amount: {inr(valuation.loanAmount)}</span></div>
      <VerificationBlock valuation={valuation} />
      <div className="certificate-rules">
        <p>I hereby certify that value of the above jewels is not less than value mentioned above.</p>
        <p>I also certify that the fineness / purity weights and valuation rates given above are correct.</p>
        <p>Further, I declare that the applicant is / are not my relative / associate etc., and I also do not have any interest whatsoever in the gold ornaments / jewellery that have been assessed / appraised by me.</p>
      </div>
      <SignatureGrid labels={['Branch Manager', 'Joint Custodian', `Customer: ${customer.name || ''}`, 'Appraiser With Name']} />
    </article>
  )
}
