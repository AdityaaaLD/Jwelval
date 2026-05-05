const clean = (text) => text
  .replace(/[|]/g, ' ')
  .replace(/[^\S\r\n]+/g, ' ')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

const aadhaarPattern = /(?:\d[ -]?){12}/

function parseAadhaarText(text) {
  const lines = clean(text)
  const joined = lines.join('\n')
  const aadhaarMatch = joined.match(aadhaarPattern)
  const aadharNumber = aadhaarMatch ? aadhaarMatch[0].replace(/\D/g, '') : ''
  const ignore = /(government|india|uidai|unique|identification|authority|aadhaar|vid|dob|year|male|female|address|mobile|www|help|enrol)/i
  const name = lines.find((line) =>
    /^[A-Za-z][A-Za-z .]{4,}$/.test(line) && !ignore.test(line) && !/\d/.test(line)
  ) || ''
  const addressIndex = lines.findIndex((line) => /^address[:\s]/i.test(line) || /address/i.test(line))
  const address = addressIndex >= 0
    ? lines.slice(addressIndex, addressIndex + 5).join(' ').replace(/^address[:\s-]*/i, '')
    : ''

  return { name, aadharNumber, address, rawText: joined }
}

export async function scanAadhaarImage(image) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(image)
    return parseAadhaarText(data.text || '')
  } finally {
    await worker.terminate()
  }
}
