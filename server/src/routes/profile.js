import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/', (req, res) => {
  const userId = req.user.id
  res.json(sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId) || {})
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^[6-9]\d{9}$/
const UPI_RE = /^[\w.+-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/

function validateProfilePayload(body) {
  const errors = {}
  const clean = {
    appraiserName: String(body.appraiserName || '').trim(),
    businessName: String(body.businessName || '').trim(),
    mobile: String(body.mobile || '').trim(),
    email: String(body.email || '').trim(),
    upiId: String(body.upiId || '').trim(),
    logoPhoto: typeof body.logoPhoto === 'string' ? body.logoPhoto : '',
    address: String(body.address || '').trim(),
    empanelmentId: String(body.empanelmentId || '').trim(),
    gstn: String(body.gstn || '').trim().toUpperCase(),
    proprietorName: String(body.proprietorName || '').trim(),
    qualification: String(body.qualification || '').trim(),
    organization: String(body.organization || '').trim(),
    certNumber: String(body.certNumber || '').trim(),
  }

  if (!clean.appraiserName) errors.appraiserName = 'Appraiser / proprietor name is required.'
  else if (clean.appraiserName.length > 120) errors.appraiserName = 'Name is too long (max 120 characters).'

  if (!clean.businessName) errors.businessName = 'Business name is required.'
  else if (clean.businessName.length > 150) errors.businessName = 'Business name is too long (max 150 characters).'

  if (clean.mobile && !MOBILE_RE.test(clean.mobile)) {
    errors.mobile = 'Enter a valid 10-digit mobile number.'
  }

  if (clean.email && !EMAIL_RE.test(clean.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (clean.upiId && !UPI_RE.test(clean.upiId)) {
    errors.upiId = 'Enter a valid UPI ID (e.g. name@bank).'
  }

  if (clean.gstn && clean.gstn.length > 20) {
    errors.gstn = 'GSTN/PAN/TAN looks too long.'
  }

  if (clean.address.length > 500) errors.address = 'Address is too long (max 500 characters).'
  if (clean.empanelmentId.length > 100) errors.empanelmentId = 'Empanelment ID is too long.'
  if (clean.qualification.length > 200) errors.qualification = 'Qualification is too long.'
  if (clean.organization.length > 200) errors.organization = 'Organization is too long.'
  if (clean.certNumber.length > 100) errors.certNumber = 'Certificate/Registration No. is too long.'

  return { clean, errors }
}

router.put('/', (req, res) => {
  const userId = req.user.id
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'VALIDATION', message: 'Invalid request body.' })
  }

  const { clean, errors } = validateProfilePayload(req.body)
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Please fix the highlighted fields.', fields: errors })
  }

  const now = new Date().toISOString()
  const existing = sqlite.prepare('SELECT id FROM appraiser_profile WHERE user_id = ?').get(userId)

  if (existing) {
    sqlite.prepare(`
      UPDATE appraiser_profile
      SET appraiser_name = ?, business_name = ?, mobile = ?, email = ?, upi_id = ?, logo_photo = ?, address = ?,
          empanelment_id = ?, gstn = ?, proprietor_name = ?, qualification = ?, organization = ?, cert_number = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      clean.appraiserName, clean.businessName, clean.mobile, clean.email, clean.upiId, clean.logoPhoto, clean.address,
      clean.empanelmentId, clean.gstn, clean.proprietorName, clean.qualification, clean.organization, clean.certNumber, now, userId
    )
  } else {
    // Self-heal accounts that never received a default profile row (e.g. legacy
    // approvals created before profile seeding was fixed).
    sqlite.prepare(`
      INSERT INTO appraiser_profile
        (user_id, appraiser_name, business_name, mobile, email, upi_id, logo_photo, address,
         empanelment_id, gstn, proprietor_name, qualification, organization, cert_number, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, clean.appraiserName, clean.businessName, clean.mobile, clean.email, clean.upiId, clean.logoPhoto, clean.address,
      clean.empanelmentId, clean.gstn, clean.proprietorName, clean.qualification, clean.organization, clean.certNumber, now
    )
  }

  const updated = sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId)
  if (!updated) {
    return res.status(500).json({ error: 'PROFILE_SAVE_FAILED', message: 'Profile could not be saved. Please try again.' })
  }
  res.json(updated)
})

export default router
