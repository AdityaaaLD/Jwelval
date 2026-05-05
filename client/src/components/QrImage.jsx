import { useEffect, useState } from 'react'
import { qrDataUrl } from '../lib/qr'

export default function QrImage({ text, alt = 'QR code', className = '' }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    if (text) qrDataUrl(text).then((url) => alive && setSrc(url))
    return () => { alive = false }
  }, [text])
  if (!src) return <div className={className} />
  return <img src={src} alt={alt} className={className} />
}
