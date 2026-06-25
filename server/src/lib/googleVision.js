import vision from '@google-cloud/vision'

let visionClient = null

const CREDENTIALS_JSON_ENV = 'GOOGLE_VISION_CREDENTIALS_JSON'
const CREDENTIALS_BASE64_ENV = 'GOOGLE_VISION_CREDENTIALS_BASE64'

function parseJsonCredentials(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : null
  } catch {
    return null
  }
}

function parseBase64Credentials(raw) {
  if (!raw) return null
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8')
    return parseJsonCredentials(json)
  } catch {
    return null
  }
}

export function isGoogleVisionConfigured() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS
      || process.env[CREDENTIALS_JSON_ENV]
      || process.env[CREDENTIALS_BASE64_ENV]
  )
}

function getVisionClient() {
  if (visionClient) return visionClient

  const credentialsFromJson = parseJsonCredentials(process.env[CREDENTIALS_JSON_ENV])
  const credentialsFromBase64 = parseBase64Credentials(process.env[CREDENTIALS_BASE64_ENV])
  const credentials = credentialsFromJson || credentialsFromBase64

  visionClient = credentials
    ? new vision.ImageAnnotatorClient({ credentials })
    : new vision.ImageAnnotatorClient()

  return visionClient
}

function extractBase64ImageContent(imageInput = '') {
  if (typeof imageInput !== 'string') return ''
  const trimmed = imageInput.trim()
  if (!trimmed) return ''

  const dataUrlMatch = trimmed.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  const base64 = dataUrlMatch ? dataUrlMatch[1] : trimmed
  return base64.replace(/\s+/g, '')
}

function computeConfidenceFromFullText(fullTextAnnotation) {
  const pages = fullTextAnnotation?.pages || []
  let totalConfidence = 0
  let count = 0

  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (typeof block.confidence === 'number') {
        totalConfidence += block.confidence
        count += 1
      }
    }
  }

  if (!count) return 0
  return Math.max(0, Math.min(100, Math.round((totalConfidence / count) * 100)))
}

export async function detectDocumentText(imageInput) {
  if (!isGoogleVisionConfigured()) {
    const error = new Error('Google Vision credentials are not configured on server.')
    error.code = 'OCR_NOT_CONFIGURED'
    throw error
  }

  const imageContent = extractBase64ImageContent(imageInput)
  if (!imageContent) {
    const error = new Error('A valid base64 image is required for OCR.')
    error.code = 'OCR_INVALID_IMAGE'
    throw error
  }

  const client = getVisionClient()
  const [response] = await client.documentTextDetection({
    image: { content: imageContent },
  })

  const rawText = response?.fullTextAnnotation?.text
    || response?.textAnnotations?.[0]?.description
    || ''

  const ocrConfidence = computeConfidenceFromFullText(response?.fullTextAnnotation)

  return {
    rawText,
    ocrConfidence,
  }
}
