const A4_WIDTH_PX = 794

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

async function buildPdfBlobFromElement(element, excludeSelectors = []) {
  const { default: html2pdf } = await import('html2pdf.js')

  // Temporarily remove mobile transform/scale on the live element so html2canvas
  // captures it at full A4 width. html2canvas clones internally — we use onclone
  // to further modify the clone (remove excluded pages, set widths, remove transforms).
  const savedTransform = element.style.transform
  const savedWidth = element.style.width
  const savedMaxWidth = element.style.maxWidth
  element.style.transform = 'none'
  element.style.width = `${A4_WIDTH_PX}px`
  element.style.maxWidth = 'none'

  try {
    return await html2pdf()
      .set({
        margin: 0,
        filename: 'valuation-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc) => {
            // Hide the app root to avoid any interference
            const root = clonedDoc.querySelector('#root')
            if (root) root.style.display = 'none'

            // Neutralize .print-overlay — remove fixed positioning and dark background
            clonedDoc.querySelectorAll('.print-overlay').forEach((n) => {
              n.style.position = 'static'
              n.style.inset = 'auto'
              n.style.zIndex = 'auto'
              n.style.background = 'none'
            })

            // Neutralize .print-preview-scroll — remove overflow clipping and height constraint
            clonedDoc.querySelectorAll('.print-preview-scroll').forEach((n) => {
              n.style.height = 'auto'
              n.style.overflow = 'visible'
              n.style.padding = '0'
            })

            // Remove any mobile transform/scale on .print-preview-center
            clonedDoc.querySelectorAll('.print-preview-center').forEach((n) => {
              n.style.transform = 'none'
              n.style.width = `${A4_WIDTH_PX}px`
              n.style.maxWidth = 'none'
              n.style.margin = '0'
            })

            // Set explicit A4 pixel width on all .print-page elements, remove screen-only styles
            clonedDoc.querySelectorAll('.print-page').forEach((p) => {
              p.style.width = `${A4_WIDTH_PX}px`
              p.style.boxShadow = 'none'
            })

            // Remove excluded sections (e.g. KYC page .dc-page2)
            for (const selector of excludeSelectors) {
              clonedDoc.querySelectorAll(selector).forEach((n) => n.remove())
            }

            // Hide the toolbar in the clone
            clonedDoc.querySelectorAll('.no-print, .print-modal-toolbar').forEach((n) => {
              n.style.display = 'none'
            })
          },
        },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(element)
      .outputPdf('blob')
  } finally {
    element.style.transform = savedTransform
    element.style.width = savedWidth
    element.style.maxWidth = savedMaxWidth
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

export async function sharePdfFromElement({ element, fileBaseName, shareTitle, shareText, excludeSelectors = [] }) {
  const file = await createPdfFileFromElement({ element, fileBaseName, excludeSelectors })
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
