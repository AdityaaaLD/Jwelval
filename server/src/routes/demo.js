import { Router } from 'express'
import { runDemoSeed, resetAllData } from '../db/seed-demo.js'

const router = Router()

router.post('/load', async (_req, res) => {
  await resetAllData()
  const summary = await runDemoSeed()
  res.json({ ok: true, ...summary })
})

router.post('/reset', async (_req, res) => {
  await resetAllData()
  res.json({ ok: true })
})

export default router
