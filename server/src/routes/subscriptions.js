import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { sendEmail } from '../mailer.js'

const router = Router()

const SUPPORT_EMAIL = String(process.env.SUBSCRIPTION_SUPPORT_EMAIL || 'support@logic-motive.com').trim()

const PLAN_DETAILS = {
  YEAR_1_ANNUAL: {
    label: 'Year 1 Subscription',
    pricing: 'INR 10,000 per user per year',
  },
  YEAR_2_MONTHLY: {
    label: 'Year 2+ Renewal',
    pricing: 'INR 299 per user per month',
  },
}

function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  }
  next()
}

router.post(
  '/request-access',
  body('planCode').isIn(Object.keys(PLAN_DETAILS)),
  body('fullName').isString().trim().isLength({ min: 2, max: 80 }),
  body('phone').isString().trim().matches(/^[0-9+()\-\s]{8,20}$/),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('companyName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 120 }),
  body('teamSize').optional({ checkFalsy: true }).isInt({ min: 1, max: 5000 }),
  body('city').optional({ checkFalsy: true }).isString().trim().isLength({ max: 80 }),
  body('notes').optional({ checkFalsy: true }).isString().trim().isLength({ max: 1000 }),
  validate,
  async (req, res) => {
    const details = PLAN_DETAILS[req.body.planCode]
    const payload = {
      planCode: req.body.planCode,
      planLabel: details.label,
      planPricing: details.pricing,
      fullName: String(req.body.fullName || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim(),
      companyName: String(req.body.companyName || '').trim(),
      teamSize: req.body.teamSize ? Number(req.body.teamSize) : null,
      city: String(req.body.city || '').trim(),
      notes: String(req.body.notes || '').trim(),
    }

    const subject = `JewelVal account access request - ${payload.planLabel}`
    const text = [
      'A new subscription account access request was submitted from the website.',
      '',
      `Selected Plan: ${payload.planLabel} (${payload.planPricing})`,
      `Name: ${payload.fullName}`,
      `Phone: ${payload.phone}`,
      `Email: ${payload.email || 'Not provided'}`,
      `Business Name: ${payload.companyName || 'Not provided'}`,
      `Team Size: ${payload.teamSize || 'Not provided'}`,
      `City: ${payload.city || 'Not provided'}`,
      `Additional Notes: ${payload.notes || 'None'}`,
      '',
      `Submitted At: ${new Date().toISOString()}`,
      `Source IP: ${req.ip || 'unknown'}`,
      `User-Agent: ${req.get('user-agent') || 'unknown'}`,
    ].join('\n')

    try {
      await sendEmail({ to: SUPPORT_EMAIL, subject, text })
      return res.json({ ok: true, message: 'Request sent. Our team will contact you soon.' })
    } catch (error) {
      console.error('[subscriptions] request-access email failed:', error)
      return res.status(503).json({ error: 'REQUEST_SEND_FAILED', message: 'Unable to submit request right now. Please try again.' })
    }
  }
)

export default router
