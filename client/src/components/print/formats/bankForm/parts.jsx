import QrImage from '../../../QrImage'
import WhatsAppMark from '../../../WhatsAppMark'

const QR_OPTIONS = { width: 360, margin: 2 }

/** Writable dotted line for an empty field (keeps its place on paper). */
export function Blank({ width = '38mm' }) {
  return <span className="bf-blank" style={{ minWidth: width }} />
}

/** A filled-in value on a form line, or a writable line when empty. */
export function Fill({ value, width = '38mm' }) {
  if (value === undefined || value === null || String(value).trim() === '') return <Blank width={width} />
  return <span className="bf-fill">{value}</span>
}

export function Letterhead({ profile, empanelmentId }) {
  const contacts = [
    profile.mobile && <span key="m">Mob: {profile.mobile}</span>,
    profile.whatsapp_number && (
      <span key="w" className="bf-lh-whatsapp"><WhatsAppMark className="bf-lh-whatsapp-icon" />{profile.whatsapp_number}</span>
    ),
    profile.email && <span key="e">{profile.email}</span>,
    profile.gstn && <span key="g">GSTN: {profile.gstn}</span>,
  ].filter(Boolean)
  return (
    <header className="bf-letterhead">
      <div className="bf-lh-logo">
        {profile.logo_photo && <img src={profile.logo_photo} alt="Shop Logo" />}
      </div>
      <div className="bf-lh-text">
        <p className="bf-lh-name">{(profile.business_name || 'JEWELLERS').toUpperCase()}</p>
        <p>Proprietor, {profile.appraiser_name || ''}, {profile.qualification || 'Government Approved Gold Appaisal'}</p>
        {profile.organization && <p>({profile.organization})</p>}
        {profile.cert_number && <p>No. {profile.cert_number}</p>}
        {profile.address && <p>{profile.address}</p>}
        {contacts.length > 0 && <p className="bf-lh-contacts">{contacts}</p>}
        {(profile.bank_account_number || empanelmentId) && (
          <p className="bf-lh-contacts">
            {profile.bank_account_number && <span>Bank A/C: {profile.bank_account_number}</span>}
            {empanelmentId && <span>Digital ID of Empanelment: {empanelmentId}</span>}
          </p>
        )}
      </div>
      <div className="bf-lh-logo" aria-hidden="true" />
    </header>
  )
}

export function QrBlock({ link, certNo }) {
  return (
    <div className="bf-qr">
      <QrImage text={link} className="bf-qr-img" qrOptions={QR_OPTIONS} />
      <p>Scan &amp; Verify</p>
      <p className="bf-qr-no">{certNo}</p>
    </div>
  )
}

export function PhotoBoxes({ valuation, showBorrower, showJewellery }) {
  const borrower = showBorrower && valuation.personPhoto
  const jewellery = showJewellery && valuation.jewelleryPhoto
  if (!borrower && !jewellery) return null
  return (
    <>
      {borrower && (
        <div className="bf-photo bf-photo-person">
          <img src={valuation.personPhoto} alt="Borrower" />
          <p>Borrower Photo</p>
        </div>
      )}
      {jewellery && (
        <div className="bf-photo bf-photo-jewel">
          {/* object-fit: contain — the jewellery photo is never cropped */}
          <img src={valuation.jewelleryPhoto} alt="Jewellery" />
          <p>Jewellery Photo</p>
        </div>
      )}
    </>
  )
}

export function ReferenceLine({ valuation, data }) {
  return (
    <p className="bf-ref">
      <span><b>Certificate No:</b> {valuation.valuationNumber}</span>
      <span><b>Application ID:</b> <Fill value={valuation.applicationId} width="24mm" /></span>
      <span><b>Gold Loan Register No.:</b> <Fill value={valuation.goldLoanRegisterNo} width="16mm" /></span>
      <span><b>Gold Packets No.:</b> <Fill value={valuation.goldPacketsNo} width="16mm" /></span>
      <span><b>Date:</b> {data.reportDate} {data.reportTime}</span>
    </p>
  )
}

export function BorrowerDetails({ customer }) {
  return (
    <p className="bf-ref bf-borrower-details">
      <span><b>Borrower Mob. No:</b> <Fill value={customer.mobile} width="24mm" /></span>
      <span><b>Alternate Mob. No:</b> <Fill value={customer.alternateMobile} width="24mm" /></span>
      <span><b>Aadhaar No:</b> <Fill value={customer.aadharNumber} width="30mm" /></span>
    </p>
  )
}

export function LoanSummary({ entries }) {
  return (
    <div className="bf-loan">
      {entries.map(([label, value]) => (
        <span className="bf-loan-cell" key={label}>
          <b>{label}:</b>
          {value ? <span>{value}</span> : <span className="bf-loan-blank" />}
        </span>
      ))}
    </div>
  )
}

/** Aadhaar/PAN sheet + bank-signed pages: own records only, never in the shared PDF. */
export function KycAndSignedPages({ valuation, includeKyc, signedPages, data }) {
  const customer = valuation.customer || {}
  const aadharFrontDoc = valuation.aadharPhotoDoc || customer.aadharPhoto || ''
  const aadharBackDoc = customer.aadharPhotoBack || ''
  if (!includeKyc) return null
  return (
    <>
      {(aadharFrontDoc || aadharBackDoc || valuation.panPhoto) && (
        <article className="print-page digital-cert dc-page2">
          <p className="dc-kyc-notice no-print">Kept for your records — this sheet is not included in the shared PDF.</p>
          <h2 className="dc-page2-title">KYC Documents — {customer.name || 'Borrower'}</h2>
          <p className="dc-page2-ref">Ref: Certificate No. {valuation.valuationNumber} | Date: {data.reportDate} {data.reportTime}</p>
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
      {signedPages.map((page, index, all) => (
        <article key={`signed-${page.id}`} className="print-page dc-signed-page">
          <p className="dc-kyc-notice no-print">
            Signed copy — page {index + 1} of {all.length}. Kept for your records — not included in the shared PDF.
          </p>
          <div className="dc-signed-img-wrap">
            <img src={page.image} alt={`Signed report page ${index + 1}`} />
          </div>
        </article>
      ))}
    </>
  )
}
