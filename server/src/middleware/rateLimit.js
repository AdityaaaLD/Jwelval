// In-memory sliding-window rate limiters.
// For larger scale / multi-instance deployment, use Redis/Upstash.

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function createRateLimiter({ windowMs, maxReqs, code = 'RATE_LIMIT', message }) {
  const buckets = new Map()

  return (req, res, next) => {
    const key = getClientIp(req)
    const now = Date.now()
    const windowStart = now - windowMs
    const times = buckets.get(key) || []
    const filtered = times.filter((t) => t > windowStart)
    filtered.push(now)
    buckets.set(key, filtered)

    if (filtered.length > maxReqs) {
      const retryAfter = Math.max(1, Math.ceil((filtered[0] + windowMs - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ error: code, message })
    }

    next()
  }
}

const apiWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000)
const apiMaxReqs = Number(process.env.API_RATE_LIMIT_MAX_REQS || 120)
const authWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
const authMaxReqs = Number(process.env.AUTH_RATE_LIMIT_MAX_REQS || 45)
const subscriptionWindowMs = Number(process.env.SUBSCRIPTION_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
const subscriptionMaxReqs = Number(process.env.SUBSCRIPTION_RATE_LIMIT_MAX_REQS || 20)

export const rateLimit = createRateLimiter({
  windowMs: apiWindowMs,
  maxReqs: apiMaxReqs,
  code: 'RATE_LIMIT',
  message: 'Too many requests. Please slow down.',
})

export const authRateLimit = createRateLimiter({
  windowMs: authWindowMs,
  maxReqs: authMaxReqs,
  code: 'AUTH_RATE_LIMIT',
  message: 'Too many authentication attempts. Please try again later.',
})

export const subscriptionRateLimit = createRateLimiter({
  windowMs: subscriptionWindowMs,
  maxReqs: subscriptionMaxReqs,
  code: 'SUBSCRIPTION_RATE_LIMIT',
  message: 'Too many access requests. Please try again later.',
})
