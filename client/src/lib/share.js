const A4_WIDTH_PX = 794

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

function forcePageWidthForCapture(container) {
  const pages = Array.from(container.querySelectorAll('.print-page'))
  const previous = pages.map((page) => page.style.width)
  pages.forEach((page) => {
    page.style.width = `${A4_WIDTH_PX}px`
  })
  return () => {
    pages.forEach((page, index) => {
      page.style.width = previous[index]
    })
  }
}

async function buildPdfBlobFromElement(element) {
  const { default: html2pdf } = await import('html2pdf.js')
  const restore = forcePageWidthForCapture(element)
  try {
    return await html2pdf()
      .set({
        margin: 0,
        filename: 'valuation-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(element)
      .outputPdf('blob')
  } finally {
    restore()
  }
}

export async function createPdfFileFromElement({ element, fileBaseName }) {
  if (!element) throw new Error('Print content not found for PDF export.')
  const blob = await buildPdfBlobFromElement(element)
  const filename = makeFilename(fileBaseName)
  const canCreateFile = typeof File !== 'undefined'
  if (canCreateFile) return new File([blob], filename, { type: 'application/pdf' })
  return { blob, filename, type: 'application/pdf' }
}

export async function sharePdfFileStrict({ file, shareTitle, shareText }) {
  if (!navigator.share) throw new Error('Native share is not supported on this browser.')
  if (!file) throw new Error('PDF file is not ready yet. Please try again.')

  const sharePayload = {
    title: shareTitle || 'Valuation Report',
    text: shareText || 'Please find attached valuation report PDF.',
    files: [file],
  }

  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
    throw new Error('This browser cannot share PDF files directly. Please use a browser that supports file sharing.')
  }

  await navigator.share(sharePayload)
  return { shared: true }
}

export async function sharePdfFromElement({ element, fileBaseName, shareTitle, shareText }) {
  const file = await createPdfFileFromElement({ element, fileBaseName })
  if (!(file instanceof File)) {
    throw new Error('This browser does not support direct file sharing for PDF.')
  }

  try {
    return await sharePdfFileStrict({ file, shareTitle, shareText })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw error
  }
}
