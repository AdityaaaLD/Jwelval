const TOKEN_KEY = 'jewelval_token'
const PDF_MIME = 'application/pdf'

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

function isIos() {
  const ua = navigator.userAgent || ''
  const iosLike = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1
  return iosLike || iPadOs
}

/**
 * Downloads the PDF that the server rendered with a real Chrome print engine.
 * This is the single source of truth for the shared document, so the output is
 * always identical to "Print / Save PDF" regardless of the user's device.
 */
export async function fetchValuationPdf({ valuationId, fileBaseName, signal }) {
  if (!valuationId) throw new Error('Valuation must be saved before it can be shared.')

  const token = localStorage.getItem(TOKEN_KEY)
  const res = await fetch(`/api/valuations/${valuationId}/pdf`, {
    method: 'GET',
    headers: {
      Accept: PDF_MIME,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  })

  if (!res.ok) {
    let message = 'Could not generate the PDF. Please try again.'
    try {
      const payload = await res.json()
      if (payload?.message) message = payload.message
    } catch {
      // non-JSON error body, keep the default message
    }
    if (res.status === 401) message = 'Your session expired. Please login again.'
    const error = new Error(message)
    error.status = res.status
    throw error
  }

  const blob = await res.blob()
  if (!blob || blob.size < 1024) throw new Error('The generated PDF was empty. Please try again.')

  const filename = makeFilename(fileBaseName)
  const pdfBlob = blob.type === PDF_MIME ? blob : new Blob([blob], { type: PDF_MIME })

  let file = null
  try {
    file = new File([pdfBlob], filename, { type: PDF_MIME })
  } catch {
    file = null
  }

  return { blob: pdfBlob, file, filename }
}

function canShareFile(file) {
  if (!file) return false
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return true
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return Boolean(win)
}

/**
 * Shares an already-fetched PDF. Uses the native share sheet when the platform
 * supports file sharing (Android/iOS), and degrades to a real file download or
 * an in-browser PDF tab everywhere else, so the flow never dead-ends.
 */
export async function sharePdf({ pdf, shareTitle, shareText }) {
  if (!pdf?.blob) throw new Error('PDF is not ready yet. Please try again.')
  const { blob, file, filename } = pdf

  if (canShareFile(file)) {
    try {
      await navigator.share({
        title: shareTitle || 'Valuation Report',
        text: shareText || 'Please find the attached valuation report.',
        files: [file],
      })
      return { method: 'share' }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      // Native sheet refused the payload — fall through to a guaranteed path.
    }
  }

  // iOS Safari without file-share support cannot trigger downloads reliably,
  // so surface the PDF in a tab where the user can use the system share sheet.
  if (isIos() && openBlobInNewTab(blob)) return { method: 'newTab' }

  downloadBlob(blob, filename)
  return { method: 'download' }
}

export async function shareValuationPdf({ valuationId, fileBaseName, shareTitle, shareText }) {
  const pdf = await fetchValuationPdf({ valuationId, fileBaseName })
  return sharePdf({ pdf, shareTitle, shareText })
}
