// Simple in-memory rate limiter (IP-based, sliding 1-minute window)
// For small scale / Hobby: good enough; for larger scale use Redis/Upstash.
const WINDOW_MS = 60 * 1000
const MAX_REQS = 120 // adjust as needed

const buckets = new Map()

export function rateLimit(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown'
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  const times = buckets.get(key) || []
  const filtered = times.filter((t) => t > windowStart)
  filtered.push(now)
  buckets.set(key, filtered)
  if (filtered.length > MAX_REQS) {
    return res.status(429).json({ error: 'RATE_LIMIT', message: 'Too many requests. Please slow down.' })
  }
  next()
}
