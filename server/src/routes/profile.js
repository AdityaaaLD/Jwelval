import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

const DEFAULT_PROFILE = {
  appraiserName: 'Gold Appraiser',
  businessName: 'JewelVal Appraiser',
}

function ensureProfileRow(userId) {
  const existing = sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId)
  if (existing) return existing

  const now = new Date().toISOString()
  sqlite.prepare(
    `INSERT INTO appraiser_profile (user_id, appraiser_name, business_name, mobile, email, upi_id, logo_photo, address,
      empanelment_id, gstn, proprietor_name, qualification, organization, cert_number, updated_at)
     VALUES (?, ?, ?, '', '', '', '', '', '', '', '', '', '', '', ?)`
  ).run(userId, DEFAULT_PROFILE.appraiserName, DEFAULT_PROFILE.businessName, now)

  return sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId)
}

router.get('/', (req, res) => {
  const userId = req.user.id
  res.json(ensureProfileRow(userId) || {})
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^[6-9]\d{9}$/
const UPI_RE = /^[\w.+-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/

function validateProfilePayload(body) {
  const errors = {}
  const mobileRaw = String(body.mobile || '').trim()
  let mobile = mobileRaw.replace(/\D/g, '')
  if (mobile.length === 12 && mobile.startsWith('91')) mobile = mobile.slice(2)

  const clean = {
    appraiserName: String(body.appraiserName || '').trim(),
    businessName: String(body.businessName || '').trim(),
    mobile,
    email: String(body.email || '').trim().toLowerCase(),
    upiId: String(body.upiId || '').trim().toLowerCase(),
    logoPhoto: typeof body.logoPhoto === 'string' ? body.logoPhoto : '',
    address: String(body.address || '').trim(),
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
  if (clean.qualification.length > 200) errors.qualification = 'Qualification is too long.'
  if (clean.organization.length > 200) errors.organization = 'Organization is too long.'
  if (clean.certNumber.length > 100) errors.certNumber = 'Certificate/Registration No. is too long.'

  return { clean, errors }
}

router.put('/', (req, res) => {
  try {
    const userId = req.user.id
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Invalid request body.' })
    }

    const { clean, errors } = validateProfilePayload(req.body)
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Please fix the highlighted fields.', fields: errors })
    }

    const now = new Date().toISOString()
    ensureProfileRow(userId)

    sqlite.prepare(`
      UPDATE appraiser_profile
      SET appraiser_name = ?, business_name = ?, mobile = ?, email = ?, upi_id = ?, logo_photo = ?, address = ?,
          gstn = ?, proprietor_name = ?, qualification = ?, organization = ?, cert_number = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      clean.appraiserName, clean.businessName, clean.mobile, clean.email, clean.upiId, clean.logoPhoto, clean.address,
      clean.gstn, clean.proprietorName, clean.qualification, clean.organization, clean.certNumber, now, userId
    )

    const updated = sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId)
    if (!updated) {
      return res.status(500).json({ error: 'PROFILE_SAVE_FAILED', message: 'Profile could not be saved. Please try again.' })
    }
    res.json(updated)
  } catch (error) {
    console.error('[profile] save failed:', error)
    return res.status(500).json({ error: 'PROFILE_SAVE_FAILED', message: 'Profile could not be saved. Please try again.' })
  }
})

export default router
