const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

// CSS that mirrors @media print rules — injected into html2canvas clone
const PRINT_CSS = `
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
  #root { display: none !important; }
  .no-print, .print-modal-toolbar { display: none !important; }
  #print-portal { position: static !important; background: none !important; z-index: auto !important; }
  .print-overlay { position: static !important; inset: auto !important; z-index: auto !important; background: none !important; }
  .print-preview-scroll { overflow: visible !important; padding: 0 !important; height: auto !important; }
  .print-preview-center { margin: 0 !important; width: ${A4_WIDTH_PX}px !important; max-width: none !important; transform: none !important; }
  .print-page { width: ${A4_WIDTH_PX}px !important; min-height: auto !important; padding: 0 !important; box-shadow: none !important; }
  .sb-page { width: ${A4_WIDTH_PX}px !important; min-height: auto !important; padding: 0 !important; box-shadow: none !important; }
  .fee-receipt { box-shadow: none !important; }
  .sb-table tbody tr:hover { background: none !important; }
`

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

async function capturePageAsCanvas(html2canvas, pageEl) {
  return html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
    onclone: (clonedDoc) => {
      const style = clonedDoc.createElement('style')
      style.textContent = PRINT_CSS
      clonedDoc.head.appendChild(style)
    },
  })
}

async function buildPdfBlobFromElement(element, excludeSelectors = []) {
  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  // Temporarily remove mobile transform/scale on the live element
  const savedTransform = element.style.transform
  const savedWidth = element.style.width
  const savedMaxWidth = element.style.maxWidth
  element.style.transform = 'none'
  element.style.width = `${A4_WIDTH_PX}px`
  element.style.maxWidth = 'none'

  // Temporarily hide excluded sections on the live DOM
  const hiddenNodes = []
  for (const selector of excludeSelectors) {
    element.querySelectorAll(selector).forEach((n) => {
      hiddenNodes.push({ n, display: n.style.display })
      n.style.display = 'none'
    })
  }

  try {
    // Find all .print-page elements — each one is a separate A4 page
    let pages = Array.from(element.querySelectorAll('.print-page'))
    // If no .print-page found, capture the whole element as a single page
    if (pages.length === 0) pages = [element]

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pages.length; i++) {
      const canvas = await capturePageAsCanvas(html2canvas, pages[i])
      const imgData = canvas.toDataURL('image/jpeg', 0.98)

      // Scale canvas to fit A4 width, maintain aspect ratio
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width

      if (i > 0) pdf.addPage()

      // If content is taller than A4, split across multiple pages
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
      } else {
        // Slice tall canvas across multiple A4 pages
        let remainingHeight = imgHeight
        let srcY = 0
        const scaleRatio = canvas.width / pdfWidth
        while (remainingHeight > 0) {
          const sliceHeight = Math.min(pdfHeight, remainingHeight)
          // Create a sub-canvas for this slice
          const subCanvas = document.createElement('canvas')
          subCanvas.width = canvas.width
          subCanvas.height = Math.round(sliceHeight * scaleRatio)
          const ctx = subCanvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, subCanvas.width, subCanvas.height)
          ctx.drawImage(
            canvas,
            0, Math.round(srcY * scaleRatio),
            canvas.width, subCanvas.height,
            0, 0,
            canvas.width, subCanvas.height
          )
          const sliceData = subCanvas.toDataURL('image/jpeg', 0.98)
          if (i > 0 || srcY > 0) pdf.addPage()
          pdf.addImage(sliceData, 'JPEG', 0, 0, imgWidth, sliceHeight)
          remainingHeight -= sliceHeight
          srcY += sliceHeight
        }
      }
    }

    return pdf.output('blob')
  } finally {
    // Restore live element styles
    element.style.transform = savedTransform
    element.style.width = savedWidth
    element.style.maxWidth = savedMaxWidth
    // Restore hidden nodes
    hiddenNodes.forEach(({ n, display }) => { n.style.display = display })
  }
}

export async function createPdfFileFromElement({ element, fileBaseName, excludeSelectors = [] }) {
  if (!element) throw new Error('Print content not found for PDF export.')
  const blob = await buildPdfBlobFromElement(element, excludeSelectors)
  const filename = makeFilename(fileBaseName)
  const canCreateFile = typeof File !== 'undefined'
  if (canCreateFile) return new File([blob], filename, { type: 'application/pdf' })
  return { blob, filename, type: 'application/pdf' }
}

export async function sharePdfFile({ file, shareTitle, shareText }) {
  const filename = file instanceof File ? file.name : (file?.filename || 'valuation-report.pdf')
  const actualFile = file instanceof File ? file : null

  // Try native share with file attachment first
  if (actualFile && typeof navigator.share === 'function') {
    const sharePayload = {
      title: shareTitle || 'Valuation Report',
      text: shareText || 'Please find attached valuation report PDF.',
      files: [actualFile],
    }

    if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [actualFile] })) {
      try {
        await navigator.share(sharePayload)
        return { shared: true }
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        // Fall through to download fallback
      }
    }
  }

  // Fallback: download the PDF file
  const blob = actualFile || file?.blob
  if (!blob) throw new Error('PDF file could not be generated.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { shared: false, downloaded: true }
}

export async function sharePdfFromElement({ element, fileBaseName, shareTitle, shareText, excludeSelectors = [] }) {
  const file = await createPdfFileFromElement({ element, fileBaseName, excludeSelectors })
  return sharePdfFile({ file, shareTitle, shareText })
}
