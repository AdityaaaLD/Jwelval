import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/', (req, res) => {
  const userId = req.user.id
  res.json(sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId) || {})
})

router.put('/', (req, res) => {
  const userId = req.user.id
  const { appraiserName, businessName, mobile, email, upiId, logoPhoto, address, empanelmentId, gstn, proprietorName, qualification, organization, certNumber } = req.body
  sqlite.prepare(`
    UPDATE appraiser_profile
    SET appraiser_name = ?, business_name = ?, mobile = ?, email = ?, upi_id = ?, logo_photo = ?, address = ?,
        empanelment_id = ?, gstn = ?, proprietor_name = ?, qualification = ?, organization = ?, cert_number = ?, updated_at = ?
    WHERE user_id = ?
  `).run(appraiserName || '', businessName || '', mobile || '', email || '', upiId || '', logoPhoto || '', address || '', empanelmentId || '', gstn || '', proprietorName || '', qualification || '', organization || '', certNumber || '', new Date().toISOString(), userId)
  res.json(sqlite.prepare('SELECT * FROM appraiser_profile WHERE user_id = ?').get(userId))
})

export default router
