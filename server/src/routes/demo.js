import { Router } from 'express'
import { runDemoSeed, resetAllData } from '../db/seed-demo.js'

const router = Router()

router.post('/load', async (req, res) => {
  const userId = req.user.id
  await resetAllData(userId)
  const summary = await runDemoSeed(userId)
  res.json({ ok: true, ...summary })
})

router.post('/reset', async (req, res) => {
  const userId = req.user.id
  await resetAllData(userId)
  res.json({ ok: true })
})

export default router
