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

function cloneForPdfCapture(element, excludeSelectors = []) {
  const clone = element.cloneNode(true)
  // NOTE: never use opacity:0 here — html2canvas honours it and renders a blank page.
  // Keep the clone fully opaque and simply park it outside the viewport.
  clone.style.position = 'absolute'
  clone.style.left = '-100000px'
  clone.style.top = '0'
  clone.style.opacity = '1'
  clone.style.visibility = 'visible'
  clone.style.pointerEvents = 'none'
  clone.style.zIndex = '0'
  clone.style.background = '#fff'
  clone.style.transform = 'none'
  clone.style.width = `${A4_WIDTH_PX}px`
  clone.style.maxWidth = 'none'
  clone.style.margin = '0'
  clone.setAttribute('aria-hidden', 'true')

  const scaledContainers = clone.querySelectorAll('.print-preview-center')
  scaledContainers.forEach((node) => {
    node.style.transform = 'none'
    node.style.width = `${A4_WIDTH_PX}px`
    node.style.maxWidth = 'none'
  })

  for (const selector of excludeSelectors) {
    const nodes = clone.querySelectorAll(selector)
    nodes.forEach((node) => node.remove())
  }
  document.body.appendChild(clone)
  return clone
}

async function waitForImages(container) {
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise((resolve) => {
        const done = () => resolve()
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
        setTimeout(done, 8000)
      })
    })
  )
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* fonts are optional */ }
  }
}

async function buildPdfBlobFromElement(element) {
  const { default: html2pdf } = await import('html2pdf.js')
  const restore = forcePageWidthForCapture(element)
  try {
    await waitForImages(element)
    return await html2pdf()
      .set({
        margin: 0,
        filename: 'valuation-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(A4_WIDTH_PX + 80, window.innerWidth || 0),
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('.print-preview-center').forEach((node) => {
              node.style.transform = 'none'
              node.style.opacity = '1'
              node.style.visibility = 'visible'
              node.style.width = `${A4_WIDTH_PX}px`
              node.style.maxWidth = 'none'
            })
            clonedDoc.querySelectorAll('.print-page').forEach((node) => {
              node.style.opacity = '1'
              node.style.visibility = 'visible'
              node.style.boxShadow = 'none'
              node.style.width = `${A4_WIDTH_PX}px`
            })
          },
        },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait', compress: true },
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
  const captureElement = cloneForPdfCapture(element, excludeSelectors)
  let blob
  try {
    blob = await buildPdfBlobFromElement(captureElement)
  } finally {
    captureElement.remove()
  }
  if (!blob || blob.size < 2048) throw new Error('Generated PDF looked empty. Please retry sharing.')
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
