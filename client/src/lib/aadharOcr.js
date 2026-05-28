const clean = (text) => text
  .replace(/[|]/g, ' ')
  .replace(/[^\S\r\n]+/g, ' ')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

// Matches 12 digit Aadhaar with optional spaces/dashes: 9250 4796 0707
const aadhaarPattern = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/

// Words to ignore when searching for name
const IGNORE = /^(government|india|uidai|unique|identification|authority|aadhaar|vid|dob|year|male|female|address|mobile|www|help|enrol|भारत|सरकार|पुरुष|महिला|जन्म|तारीख|पत्ता|मोबाइल)/i

const HEADER_WORDS = /(government|india|uidai|unique|identification|authority|aadhaar)/i

/**
 * Parse Aadhaar FRONT side — extracts name, aadhaar number, DOB, gender, mobile
 */
function parseFrontText(text) {
  const lines = clean(text)
  const joined = lines.join('\n')

  // Aadhaar number — look for 4-4-4 digit pattern
  const aadhaarMatch = joined.match(aadhaarPattern)
  const aadharNumber = aadhaarMatch ? aadhaarMatch[1].replace(/\D/g, '') : ''

  // DOB — look for DD/MM/YYYY pattern near "DOB" or "Birth"
  const dobMatch = joined.match(/(?:DOB|Birth|जन्म)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i)
    || joined.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/)
  const dob = dobMatch ? dobMatch[1] : ''

  // Gender
  const genderMatch = joined.match(/\b(MALE|FEMALE|पुरुष|महिला|Transgender)\b/i)
  const gender = genderMatch ? genderMatch[1].toUpperCase() : ''

  // Mobile — look for "Mobile No:" followed by 10 digits
  const mobileMatch = joined.match(/Mobile\s*(?:No)?[:\s]*(\d{10})/i)
  const mobile = mobileMatch ? mobileMatch[1] : ''

  // Name — find the first English-only line that:
  //   - Has 2+ words, all alphabetic
  //   - Is NOT a header line (Government, India, etc.)
  //   - Appears before the DOB/aadhaar lines
  let name = ''
  for (const line of lines) {
    if (HEADER_WORDS.test(line)) continue
    if (IGNORE.test(line)) continue
    if (/\d/.test(line)) continue
    // Must be purely English alphabetic words (2+ words, min 5 chars)
    if (/^[A-Za-z][A-Za-z .']{4,}$/.test(line)) {
      const words = line.trim().split(/\s+/)
      if (words.length >= 2) {
        name = line.trim()
        break
      }
    }
  }

  return { name, aadharNumber, dob, gender, mobile, rawText: joined }
}

/**
 * Parse Aadhaar BACK side — extracts address
 */
function parseBackText(text) {
  const lines = clean(text)
  const joined = lines.join('\n')

  // Try to find "Address :" label first (English)
  const addrIdx = lines.findIndex((l) => /^address\s*:/i.test(l))
  if (addrIdx >= 0) {
    // Collect address lines until we hit the aadhaar number or end
    const addrLines = []
    for (let i = addrIdx; i < lines.length && i < addrIdx + 8; i++) {
      const line = lines[i]
      // Stop at aadhaar number line
      if (aadhaarPattern.test(line) && i > addrIdx) break
      // Stop at footer lines
      if (/^(www\.|help@|P\.O\.|1947)/i.test(line)) break
      addrLines.push(line)
    }
    const address = addrLines.join(', ')
      .replace(/^address\s*:\s*/i, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/,\s*$/, '')
      .trim()
    return { address, rawText: joined }
  }

  // Fallback: try Hindi "पत्ता:" label
  const hindiIdx = lines.findIndex((l) => /^पत्ता\s*:/i.test(l) || /^पत्ता/i.test(l))
  if (hindiIdx >= 0) {
    // Skip Hindi text and look for the English address block below
    const engAddrIdx = lines.findIndex((l, i) => i > hindiIdx && /^(S\/O|D\/O|W\/O|C\/O|H\.No|Flat|House|Near)/i.test(l))
    if (engAddrIdx >= 0) {
      const addrLines = []
      for (let i = engAddrIdx; i < lines.length && i < engAddrIdx + 6; i++) {
        if (aadhaarPattern.test(lines[i])) break
        if (/^(www\.|help@|P\.O\.|1947)/i.test(lines[i])) break
        addrLines.push(lines[i])
      }
      return { address: addrLines.join(', ').replace(/,\s*$/, '').trim(), rawText: joined }
    }
  }

  return { address: '', rawText: joined }
}

/**
 * Scan a single Aadhaar image (front or back) and return parsed fields.
 * side = 'front' | 'back'
 */
export async function scanAadhaarImage(image, side = 'front') {
  const { createWorker } = await import('tesseract.js')
  // Use both English and Hindi for better recognition
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(image)
    const text = data.text || ''
    if (side === 'back') {
      return parseBackText(text)
    }
    return parseFrontText(text)
  } finally {
    await worker.terminate()
  }
}
