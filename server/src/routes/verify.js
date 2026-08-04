import { Router } from 'express'
import { sqlite } from '../db/client.js'

const router = Router()

function normalizeUrl(raw) {
  return String(raw || '').trim().replace(/\/+$/, '')
}

function isLoopbackUrl(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function requestBaseUrl(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const xfHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  const proto = xfProto || req.protocol || 'http'
  const host = xfHost || req.get('host') || ''
  if (!host) return ''
  return normalizeUrl(`${proto}://${host}`)
}

function pickBestBaseUrl(candidates) {
  const urls = candidates.map(normalizeUrl).filter(Boolean)
  const nonLoopback = urls.filter((url) => !isLoopbackUrl(url))
  if (nonLoopback.length) {
    const https = nonLoopback.find((url) => url.startsWith('https://'))
    return https || nonLoopback[0]
  }
  return urls[0] || ''
}

function verificationBaseUrl(req) {
  const explicit = normalizeUrl(process.env.QR_VERIFY_BASE_URL || process.env.PUBLIC_APP_URL || '')
  if (explicit) return explicit

  const corsOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeUrl(origin))
    .filter(Boolean)

  return pickBestBaseUrl([requestBaseUrl(req), ...corsOrigins])
}

router.get('/base-url', (req, res) => {
  res.json({ baseUrl: verificationBaseUrl(req) })
})

router.get('/:number', (req, res) => {
  const row = sqlite.prepare(`
    SELECT v.valuation_number AS valuationNumber, v.valuation_date AS valuationDate,
           v.status, v.printed_at AS printedAt, v.format_type AS formatType,
           v.user_id AS userId,
           c.name AS customerName, c.customer_code AS customerCode
    FROM valuations v
    JOIN customers c ON c.id = v.customer_id
    WHERE v.valuation_number = ?
  `).get(req.params.number)
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'Certificate not found.' })
  // Get valuer name from appraiser profile
  const profile = sqlite.prepare('SELECT appraiser_name FROM appraiser_profile WHERE user_id = ?').get(row.userId)
  const valuerName = profile?.appraiser_name || ''
  delete row.userId
  res.json({ ...row, valuerName, verified: row.status === 'LOCKED' || row.status === 'PRINTED' })
})

export default router
