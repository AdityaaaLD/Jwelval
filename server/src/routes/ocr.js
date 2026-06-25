import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { detectDocumentText } from '../lib/googleVision.js'
import { logErrorEvent } from '../lib/logger.js'

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'VALIDATION', details: errors.array() })
  }
  next()
}

router.post(
  '/aadhaar',
  body('image').isString().trim().notEmpty(),
  body('side').optional({ nullable: true }).isIn(['front', 'back']),
  validate,
  async (req, res) => {
    const { image, side = 'front' } = req.body

    try {
      const { rawText, ocrConfidence } = await detectDocumentText(image)
      return res.json({
        provider: 'google-vision',
        side,
        rawText,
        ocrConfidence,
        warnings: [],
      })
    } catch (error) {
      if (error?.code === 'OCR_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'OCR_NOT_CONFIGURED',
          message: 'OCR service is not configured. Add Google Vision credentials on server.',
        })
      }

      if (error?.code === 'OCR_INVALID_IMAGE') {
        return res.status(400).json({
          error: 'OCR_INVALID_IMAGE',
          message: error.message,
        })
      }

      logErrorEvent('OCR_AADHAAR_FAILED', error, {
        userId: req.user?.id,
        side,
      })

      return res.status(502).json({
        error: 'OCR_FAILED',
        message: 'Failed to process image via OCR provider.',
      })
    }
  }
)

export default router
