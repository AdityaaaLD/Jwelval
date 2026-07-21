const A4_WIDTH_PX = 794

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

function forcePageWidthForCapture(container) {
  const pages = Array.from(container.querySelectorAll('.print-page'))
  const previous = pages.map((page) => page.style.width)
  const previewCenters = Array.from(container.querySelectorAll('.print-preview-center'))
  const previewPrevious = previewCenters.map((node) => ({ transform: node.style.transform, width: node.style.width, maxWidth: node.style.maxWidth }))
  pages.forEach((page) => {
    page.style.width = `${A4_WIDTH_PX}px`
  })
  previewCenters.forEach((node) => {
    node.style.transform = 'none'
    node.style.width = `${A4_WIDTH_PX}px`
    node.style.maxWidth = 'none'
  })
  return () => {
    pages.forEach((page, index) => {
      page.style.width = previous[index]
    })
    previewCenters.forEach((node, index) => {
      node.style.transform = previewPrevious[index].transform
      node.style.width = previewPrevious[index].width
      node.style.maxWidth = previewPrevious[index].maxWidth
    })
  }
}

function createOffscreenClone(element, excludeSelectors = []) {
  const clone = element.cloneNode(true)

  // Position off-screen (NOT opacity:0 — html2canvas respects opacity and would render blank)
  clone.style.position = 'absolute'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.zIndex = '-1'
  clone.style.background = '#fff'
  clone.style.width = `${A4_WIDTH_PX}px`
  clone.style.maxWidth = 'none'
  clone.style.transform = 'none'
  clone.style.opacity = '1'
  clone.setAttribute('aria-hidden', 'true')

  // Remove any mobile scaling transform on inner .print-preview-center
  const innerCenters = clone.querySelectorAll('.print-preview-center')
  innerCenters.forEach((node) => {
    node.style.transform = 'none'
    node.style.width = `${A4_WIDTH_PX}px`
    node.style.maxWidth = 'none'
    node.style.margin = '0'
  })

  // Set explicit A4 pixel width on all .print-page elements
  const pages = clone.querySelectorAll('.print-page')
  pages.forEach((page) => {
    page.style.width = `${A4_WIDTH_PX}px`
    page.style.boxShadow = 'none'
  })

  // Remove excluded sections (e.g. KYC page) from clone
  for (const selector of excludeSelectors) {
    const nodes = clone.querySelectorAll(selector)
    nodes.forEach((node) => node.remove())
  }

  document.body.appendChild(clone)
  return clone
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
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: A4_WIDTH_PX + 20, windowHeight: document.documentElement.scrollHeight },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(element)
      .outputPdf('blob')
  } finally {
    restore()
  }
}

export async function createPdfFileFromElement({ element, fileBaseName, excludeSelectors = [] }) {
  if (!element) throw new Error('Print content not found for PDF export.')
  const clone = createOffscreenClone(element, excludeSelectors)
  let blob
  try {
    blob = await buildPdfBlobFromElement(clone)
  } finally {
    clone.remove()
  }
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
