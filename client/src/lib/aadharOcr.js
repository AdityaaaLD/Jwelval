const cleanLines = (text) => text
  .replace(/[|]/g, ' ')
  .replace(/[^\S\r\n]+/g, ' ')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

const aadhaarPattern = /\b([0-9OQDIGSlB]{4}[\s-]?[0-9OQDIGSlB]{4}[\s-]?[0-9OQDIGSlB]{4})\b/i

const IGNORE = /^(government|india|uidai|unique|identification|authority|aadhaar|vid|dob|year|male|female|address|mobile|www|help|enrol|भारत|सरकार|पुरुष|महिला|जन्म|तारीख|पत्ता|मोबाइल|संपर्क)/i
const HEADER_WORDS = /(government|india|uidai|unique|identification|authority|aadhaar|भारत|सरकार)/i

const DIGIT_SUBS = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  l: '1',
  S: '5',
  s: '5',
  B: '8',
  G: '6',
}

const normalizeDigits = (value = '') => value
  .split('')
  .map((ch) => DIGIT_SUBS[ch] || ch)
  .join('')
  .replace(/\D/g, '')

const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

function isValidVerhoeff(value) {
  if (!/^\d{12}$/.test(value)) return false
  let c = 0
  const arr = value.split('').reverse().map(Number)
  for (let i = 0; i < arr.length; i += 1) {
    c = d[c][p[i % 8][arr[i]]]
  }
  return c === 0
}

function findAadhaarNumber(joined) {
  const candidates = []
  const chunks = joined.match(/[0-9OQDIGSlB\s-]{12,20}/gi) || []
  for (const chunk of chunks) {
    const digits = normalizeDigits(chunk)
    if (digits.length === 12) candidates.push(digits)
    if (digits.length > 12) {
      for (let i = 0; i <= digits.length - 12; i += 1) {
        candidates.push(digits.slice(i, i + 12))
      }
    }
  }

  const direct = joined.match(aadhaarPattern)
  if (direct) candidates.unshift(normalizeDigits(direct[1]))

  const unique = [...new Set(candidates.filter((v) => v.length === 12))]
  const valid = unique.find(isValidVerhoeff)
  return {
    aadharNumber: valid || unique[0] || '',
    aadharValid: Boolean(valid),
  }
}

function normalizeName(name = '') {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function extractName(lines, stopAt = Number.MAX_SAFE_INTEGER) {
  for (let i = 0; i < lines.length && i < stopAt; i += 1) {
    const line = lines[i]
    if (HEADER_WORDS.test(line) || IGNORE.test(line)) continue
    if (/\d/.test(line)) continue
    if (!/^[A-Za-z][A-Za-z .']{4,}$/.test(line)) continue
    const words = line.trim().split(/\s+/)
    if (words.length < 2 || words.length > 5) continue
    return normalizeName(line)
  }
  return ''
}

function parseFrontText(text) {
  const lines = cleanLines(text)
  const joined = lines.join('\n')
  const warnings = []

  const { aadharNumber, aadharValid } = findAadhaarNumber(joined)
  if (aadharNumber && !aadharValid) warnings.push('Aadhaar checksum validation failed. Verify manually.')

  const dobMatch = joined.match(/(?:DOB|Birth|जन्म|जन्म तारीख)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i)
    || joined.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/)
  const dob = dobMatch ? dobMatch[1] : ''

  const genderMatch = joined.match(/\b(MALE|FEMALE|पुरुष|महिला|TRANSGENDER)\b/i)
  const gender = genderMatch ? genderMatch[1].toUpperCase() : ''

  let mobile = ''
  const taggedMobile = joined.match(/Mobile\s*(?:No)?[:\s]*([0-9OQDIGSlB\s-]{10,14})/i)
  if (taggedMobile) mobile = normalizeDigits(taggedMobile[1]).slice(0, 10)
  if (!mobile) {
    const allTen = joined.match(/[6-9][0-9OQDIGSlB\s-]{9,12}/g) || []
    for (const token of allTen) {
      const digits = normalizeDigits(token)
      if (/^[6-9]\d{9}$/.test(digits)) {
        mobile = digits
        break
      }
    }
  }

  const stopIdx = lines.findIndex((line) => /dob|जन्म|male|female|पुरुष|महिला/i.test(line))
  const name = extractName(lines, stopIdx >= 0 ? stopIdx + 1 : 8)

  return { name, aadharNumber, aadharValid, dob, gender, mobile, rawText: joined, warnings }
}

function cleanAddressLine(line) {
  return line
    .replace(/^address\s*:?/i, '')
    .replace(/^पत्ता\s*:?/i, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBackText(text) {
  const lines = cleanLines(text)
  const joined = lines.join('\n')
  const warnings = []

  const start = lines.findIndex((l) => /^address\s*:?/i.test(l) || /^पत्ता\s*:?/i.test(l) || /^address$/i.test(l))
  const startIndex = start >= 0 ? start : lines.findIndex((l) => /^(S\/O|D\/O|W\/O|C\/O|H\.No|Flat|House|Near)/i.test(l))
  const addressLines = []

  if (startIndex >= 0) {
    for (let i = startIndex; i < lines.length && i < startIndex + 10; i += 1) {
      const line = lines[i]
      if (!line) continue
      if (findAadhaarNumber(line).aadharNumber && i > startIndex) break
      if (/^(www\.|help@|P\.O\.|1947|uidai\.gov\.in)/i.test(line)) break
      if (/^unique identification/i.test(line)) break
      const cleaned = cleanAddressLine(line)
      if (!cleaned) continue
      addressLines.push(cleaned)
    }
  }

  let address = addressLines.join(', ')
    .replace(/,\s*,/g, ', ')
    .replace(/,\s*$/, '')
    .trim()

  if (!address) warnings.push('Address could not be extracted confidently. Verify manually.')

  return { address, rawText: joined, warnings }
}

export async function scanAadhaarImage(image, side = 'front') {
  const { createWorker } = await import('tesseract.js')
  let worker
  try {
    worker = await createWorker('eng+hin')
  } catch {
    worker = await createWorker('eng')
  }

  try {
    const { data } = await worker.recognize(image)
    const text = data?.text || ''
    const ocrConfidence = Number(data?.confidence || 0)
    const parsed = side === 'back' ? parseBackText(text) : parseFrontText(text)
    return {
      ...parsed,
      ocrConfidence,
      warnings: parsed.warnings || [],
    }
  } finally {
    await worker.terminate()
  }
}
