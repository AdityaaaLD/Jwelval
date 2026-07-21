import { useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, Share2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { createPdfFileFromElement, sharePdfFile } from '../../lib/share'
import PrintDigitalCert from './PrintDigitalCert'

function Template({ valuation }) {
  return <PrintDigitalCert valuation={valuation} />
}

export default function PrintModal({ valuation, onClose, onLocked }) {
  const [preparingPdf, setPreparingPdf] = useState(false)

  const lockAfterPrint = async () => {
    if (valuation.status === 'DRAFT') onLocked?.(await api.valuations.markPrinted(valuation.id))
  }
  const handlePrint = async () => {
    window.print()
    await lockAfterPrint()
    toast.success('Document sent to print / saved as PDF.')
  }

  const handleSharePdf = async () => {
    const printable = document.querySelector('#print-portal .print-preview-center')
    if (!printable) {
      toast.error('Print content not found.')
      return
    }
    setPreparingPdf(true)
    const toastId = toast.loading('Generating PDF...')
    try {
      const file = await createPdfFileFromElement({
        element: printable,
        fileBaseName: `${valuation?.valuationNumber || 'valuation-report'}`,
        excludeSelectors: ['.dc-page2'],
      })
      await sharePdfFile({
        file,
        shareTitle: `Valuation Report ${valuation?.valuationNumber || ''}`,
        shareText: `Valuation report ${valuation?.valuationNumber || ''}`,
      })
      await lockAfterPrint()
      toast.success('PDF shared successfully.', { id: toastId })
    } catch (error) {
      if (error?.name === 'AbortError') {
        toast.dismiss(toastId)
        return
      }
      toast.error(error?.message || 'Failed to share PDF. Please try again.', { id: toastId })
    } finally {
      setPreparingPdf(false)
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
