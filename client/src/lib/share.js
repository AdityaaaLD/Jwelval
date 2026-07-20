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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function sharePdfFromElement({ element, fileBaseName, shareTitle, shareText }) {
  if (!element) throw new Error('Print content not found for PDF export.')
  const blob = await buildPdfBlobFromElement(element)
  const filename = makeFilename(fileBaseName)
  const file = new File([blob], filename, { type: 'application/pdf' })

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: shareTitle || 'Valuation Report',
      text: shareText || 'Please find attached valuation report PDF.',
      files: [file],
    })
    return { shared: true }
  }

  downloadBlob(blob, filename)
  return { shared: false }
}
