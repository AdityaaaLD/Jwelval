export const inr = (n) =>
  'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const num = (n, digits = 3) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const pad2 = (value) => String(value).padStart(2, '0')

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const raw = String(value).trim()
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDateDMY = (value) => {
  const date = toDate(value)
  if (!date) return ''
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`
}

/* Timestamps (printed/report time) are always shown in Indian time, whether the
   document is rendered on a phone or on the PDF server (which runs in UTC). */
export const INDIA_TZ = 'Asia/Kolkata'

export const formatDateIST = (value) => {
  const date = toDate(value)
  if (!date) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: INDIA_TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(date).map((p) => [p.type, p.value])
  )
  return `${parts.day}-${parts.month}-${parts.year}`
}

export const formatTimeIST = (value) => {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleTimeString('en-IN', { timeZone: INDIA_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
}

export const parseDateInputToISO = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return ''
  const [, dd, mm, yyyy] = match
  const iso = `${yyyy}-${mm}-${dd}`
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  if (date.getDate() !== Number(dd) || date.getMonth() + 1 !== Number(mm) || date.getFullYear() !== Number(yyyy)) return ''
  return iso
}

export const maskAadhar = (a) => {
  if (!a) return ''
  const digits = a.replace(/\D/g, '')
  if (digits.length < 4) return a
  return 'XXXX XXXX ' + digits.slice(-4)
}

export const today = () => new Date().toISOString().slice(0, 10)
