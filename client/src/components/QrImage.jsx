import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'

export default function QrImage({ text, alt = 'QR code', className = '', qrOptions = undefined }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    if (text) {
      qrDataUrl(text, qrOptions)
        .then((url) => {
          if (alive) setSrc(url)
        })
        .catch(() => {
          if (alive) setSrc('')
        })
    } else {
      setSrc('')
    }
    return () => { alive = false }
  }, [text, qrOptions])
  if (!src) return <div className={className} />
  return <img src={src} alt={alt} className={className} />
}
