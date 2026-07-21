const A4_WIDTH_PX = 794

function makeFilename(baseName) {
  const safe = String(baseName || 'valuation-report').trim().replace(/[^a-z0-9-_]+/gi, '_')
  return `${safe}.pdf`
}

async function buildPdfBlobFromElement(element, excludeSelectors = []) {
  const { default: html2pdf } = await import('html2pdf.js')

  // Temporarily remove mobile transform/scale on the live element so html2canvas
  // captures it at full A4 width. html2canvas clones internally — we use onclone
  // to inject print-equivalent CSS into the clone.
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
            // Inject a style tag that mirrors the exact @media print rules from print.css
            // This ensures the clone renders with the same layout as the browser's print output
            const style = clonedDoc.createElement('style')
            style.textContent = `
              html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
              #root { display: none !important; }
              .no-print, .print-modal-toolbar { display: none !important; }
              #print-portal { position: static !important; background: none !important; z-index: auto !important; }
              .print-overlay { position: static !important; inset: auto !important; z-index: auto !important; background: none !important; }
              .print-preview-scroll { overflow: visible !important; padding: 0 !important; height: auto !important; }
              .print-preview-center { margin: 0 !important; width: ${A4_WIDTH_PX}px !important; max-width: none !important; transform: none !important; }
              .print-page { width: ${A4_WIDTH_PX}px !important; min-height: auto !important; padding: 0 !important; box-shadow: none !important; page-break-after: always; }
              .print-page:last-child { page-break-after: auto; }
              .fee-receipt { box-shadow: none !important; }
              .print-page-break { page-break-after: always; }
              .print-avoid-break,
              .verification-block,
              .signature-grid,
              .dc-photos,
              .dc-photo-box,
              .dc-row-box,
              .dc-table,
              .dc-table thead,
              .dc-table tbody,
              .dc-table tfoot,
              .dc-table tr,
              .certificate-rules,
              .ornament-strip,
              .ornament-strip img,
              .print-photo,
              .print-table,
              .print-table thead,
              .print-table tbody,
              .print-table tfoot,
              .print-table tr,
              .sb-table,
              .sb-table thead,
              .sb-table tbody,
              .sb-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .sb-page { width: ${A4_WIDTH_PX}px !important; min-height: auto !important; padding: 0 !important; box-shadow: none !important; page-break-after: auto; }
              .sb-table tbody tr:hover { background: none !important; }
            `
            clonedDoc.head.appendChild(style)

            // Remove excluded sections (e.g. KYC page .dc-page2)
            for (const selector of excludeSelectors) {
              clonedDoc.querySelectorAll(selector).forEach((n) => n.remove())
            }
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
