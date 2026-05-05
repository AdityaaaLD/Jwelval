import QRCode from 'qrcode'

export const qrDataUrl = (text) => QRCode.toDataURL(text, { margin: 1, width: 180 })

export const verificationUrl = (valuationNumber) => {
  const origin = window.location.origin
  return `${origin}/verify/${encodeURIComponent(valuationNumber)}`
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
