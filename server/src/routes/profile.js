import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(sqlite.prepare('SELECT * FROM appraiser_profile WHERE id = 1').get() || {})
})

router.put('/', (req, res) => {
  const { appraiserName, businessName, mobile, email, upiId, logoPhoto, address } = req.body
  sqlite.prepare(`
    UPDATE appraiser_profile
    SET appraiser_name = ?, business_name = ?, mobile = ?, email = ?, upi_id = ?, logo_photo = ?, address = ?, updated_at = ?
    WHERE id = 1
  `).run(appraiserName || '', businessName || '', mobile || '', email || '', upiId || '', logoPhoto || '', address || '', new Date().toISOString())
  res.json(sqlite.prepare('SELECT * FROM appraiser_profile WHERE id = 1').get())
})

export default router
