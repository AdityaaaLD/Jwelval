import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, Share2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { createPdfFileFromElement, sharePdfFileStrict } from '../../lib/share'
import PrintDigitalCert from './PrintDigitalCert'

function Template({ valuation }) {
  return <PrintDigitalCert valuation={valuation} />
}

export default function PrintModal({ valuation, onClose, onLocked }) {
  const [pdfFile, setPdfFile] = useState(null)
  const [preparingPdf, setPreparingPdf] = useState(false)

  useEffect(() => {
    let cancelled = false
    const preparePdf = async () => {
      const printable = document.querySelector('#print-portal .print-preview-center')
      if (!printable) return
      setPreparingPdf(true)
      try {
        const file = await createPdfFileFromElement({
          element: printable,
          fileBaseName: `${valuation?.valuationNumber || 'valuation-report'}`,
        })
        if (!cancelled) setPdfFile(file)
      } catch {
        if (!cancelled) setPdfFile(null)
      } finally {
        if (!cancelled) setPreparingPdf(false)
      }
    }
    const timer = setTimeout(preparePdf, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [valuation?.id, valuation?.valuationNumber])

  const lockAfterPrint = async () => {
    if (valuation.status === 'DRAFT') onLocked?.(await api.valuations.markPrinted(valuation.id))
  }
  const handlePrint = async () => {
    window.print()
    await lockAfterPrint()
    toast.success('Document sent to print / saved as PDF.')
  }

  const handleSharePdf = async () => {
    if (preparingPdf) {
      toast.loading('Preparing PDF for sharing...', { id: 'pdf-share-prepare' })
      return
    }
    if (!(pdfFile instanceof File)) {
      toast.error('PDF is not ready for native sharing yet. Please wait a moment and try again.')
      return
    }
    try {
      toast.dismiss('pdf-share-prepare')
      await sharePdfFileStrict({
        file: pdfFile,
        shareTitle: `Valuation Report ${valuation?.valuationNumber || ''}`,
        shareText: `Valuation report ${valuation?.valuationNumber || ''}`,
      })
      await lockAfterPrint()
      toast.success('PDF shared successfully.')
    } catch (error) {
      toast.dismiss('pdf-share-prepare')
      if (error?.name === 'AbortError') return
      toast.error(error?.message || 'Failed to share PDF. Please try again.')
    }
  }

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-secondary" onClick={handleSharePdf} disabled={preparingPdf}><Share2 size={16} /> {preparingPdf ? 'Preparing PDF...' : 'Share as PDF'}</button>
        <button type="button" className="btn-primary" onClick={handlePrint}><Printer size={16} /> Print / Save PDF</button>
      </div>
      <div className="print-preview-scroll">
        <div className="print-preview-center">
          <Template valuation={valuation} />
        </div>
      </div>
    </div>,
    document.body
  )
}
