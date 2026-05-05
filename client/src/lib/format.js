export const inr = (n) =>
  'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

export const num = (n, digits = 3) =>
  (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: digits })

export const maskAadhar = (a) => {
  if (!a) return ''
  const digits = a.replace(/\D/g, '')
  if (digits.length < 4) return a
  return 'XXXX XXXX ' + digits.slice(-4)
}

export const today = () => new Date().toISOString().slice(0, 10)
