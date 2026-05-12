import { useEffect, useState } from 'react'
import { inr, num } from '../../lib/format'
import { api } from '../../lib/api'
import { PhotoBox, OrnamentPhotoStrip, VerificationBlock } from './PrintHelpers'

export default function PrintDigitalCert({ valuation }) {
  const customer = valuation.customer || {}
  const items = valuation.items || []
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])

  const totals = items.reduce((acc, item) => ({
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    net22: acc.net22 + (Number(item.net22kGoldGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { gross: 0, net: 0, net22: 0, value: 0 })

  const marketRatePerGram = totals.net22 > 0 ? totals.value / totals.net22 : (Number(valuation.goldRate22k) || 0)

  return (
    <article className="print-page digital-cert">
      <header className="digital-cert-header">
        <PhotoBox src={valuation.personPhoto} label="Borrower Photo" />
        <div className="digital-cert-title">
          <h1>GOLD APPRAISAL CERTIFICATE (DIGITAL)</h1>
          <p className="appraiser-name">{profile?.appraiser_name || 'Rameshwar Prakash Udavant'}</p>
          <p>(Digital ID of Empanelment: {profile?.empanelment_id || ''})</p>
          <p>Add: {profile?.address || ''}</p>
          <p>Mob: {profile?.mobile || ''}</p>
          <p>GSTN/PAN/TAN: {profile?.gstn || ''}</p>
        </div>
        <PhotoBox src={valuation.jewelleryPhoto} label="Jewellery Photo" />
      </header>

      <div className="digital-cert-meta">
        <div className="meta-row"><span>Application ID: {valuation.applicationId || ''}</span></div>
        <div className="meta-row"><span>Certificate No: {valuation.valuationNumber}</span><span className="meta-right">Date: {valuation.valuationDate}</span></div>
      </div>

      <section className="digital-cert-parties">
        <div className="party-from">
          <p><b>From,</b></p>
          <p>Prop : {profile?.appraiser_name || ''}</p>
          <p>{profile?.address || ''}</p>
        </div>
        <div className="party-to">
          <p><b>To,</b></p>
          <p>Branch Manager,</p>
          <p>{valuation.branch}{valuation.branchCode ? ` (Br. Code: ${valuation.branchCode})` : ''}</p>
        </div>
      </section>

      <section className="digital-cert-borrower">
        <p>Borrower Name: {customer.name}</p>
        <p>Borrower CIF: {customer.customerCode}</p>
        <p>Borrower Mob. No: {customer.mobile}</p>
      </section>

      <p className="digital-cert-currency">(Rs. in Actual)</p>

      <table className="print-table digital-cert-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Description of the Jewels/Ornaments assessed</th>
            <th>Digital ID</th>
            <th>Gross Weight (grams)</th>
            <th>Net Weight (grams)</th>
            <th>Purity Hall mark-(carat)</th>
            <th>Net Weight as per purity (grams)</th>
            <th>Market Value per gram</th>
            <th>Total Market Value of Net Weight of</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const itemRate = Number(item.net22kGoldGm) > 0
              ? (Number(item.approxValueInr) / Number(item.net22kGoldGm)).toFixed(1)
              : num(valuation.goldRate22k, 1)
            return (
              <tr key={item.id || index}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td>{item.digitalId || ''}</td>
                <td>{num(item.grossWeightGm, 2)}</td>
                <td>{num(item.netWeightGm, 2)}</td>
                <td>{num(item.purityCarat, 0)}</td>
                <td>{num(item.net22kGoldGm, 2)}</td>
                <td>{num(itemRate, 1)}</td>
                <td>{num(item.approxValueInr, 1)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3"><b>Total</b></td>
            <td><b>{num(totals.gross, 2)}</b></td>
            <td><b>{num(totals.net, 2)}</b></td>
            <td></td>
            <td><b>{num(totals.net22, 2)}</b></td>
            <td><b>{num(marketRatePerGram, 1)}</b></td>
            <td><b>{num(totals.value, 1)}</b></td>
          </tr>
        </tfoot>
      </table>

      <OrnamentPhotoStrip valuation={valuation} />

      <div className="certificate-rules">
        <p>I hereby certify that the value of the above jewels is not less than the value mentioned above. I also certify that the fineness/purity weights and valuation rates given above are correct.</p>
        <p>Further, I declare that the applicant is /are not my relative /associate etc. and also do not have any interest whatsoever in the Gold ornaments/Jewellery that have been assessed/apprised by me.</p>
      </div>

      <VerificationBlock valuation={valuation} />

      <div className="digital-cert-signature">
        <p className="yours">Yours faithfully,</p>
        <p className="sign-label">(SIGNATURE OF APPRAISER WITH NAME)</p>
      </div>
    </article>
  )
}
