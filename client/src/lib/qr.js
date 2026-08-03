import QRCode from 'qrcode'

export const qrDataUrl = (text, opts = {}) => {
  const width = Math.max(180, Number(opts.width) || 320)
  const margin = Math.max(1, Number(opts.margin) || 2)
  return QRCode.toDataURL(String(text || ''), {
    width,
    margin,
    errorCorrectionLevel: 'H',
  })
}

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  return value.replace(/\/+$/, '')
}

export const verificationUrl = (valuationNumber, opts = {}) => {
  const explicit = normalizeBaseUrl(opts.baseUrl)
  const origin = typeof window !== 'undefined' ? normalizeBaseUrl(window.location.origin) : ''
  const base = explicit || origin
  return `${base}/verify/${encodeURIComponent(valuationNumber || '')}`
}

export const upiUrl = ({ upiId, name, amount, note }) => {
  const params = new URLSearchParams({
    pa: upiId || '',
    pn: name || 'JewelVal',
    am: amount ? String(amount) : '',
    cu: 'INR',
    tn: note || 'Valuation fee',
  })
  return `upi://pay?${params.toString()}`
}
