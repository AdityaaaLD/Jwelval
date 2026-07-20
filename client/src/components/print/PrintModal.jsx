import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, Share2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { sharePdfFromElement } from '../../lib/share'
import PrintDigitalCert from './PrintDigitalCert'

function Template({ valuation }) {
  return <PrintDigitalCert valuation={valuation} />
}

export default function PrintModal({ valuation, onClose, onLocked }) {
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
      toast.error('Unable to prepare PDF. Please try again.')
      return
    }
    try {
      const result = await sharePdfFromElement({
        element: printable,
        fileBaseName: `${valuation?.valuationNumber || 'valuation-report'}`,
        shareTitle: `Valuation Report ${valuation?.valuationNumber || ''}`,
        shareText: `Valuation report ${valuation?.valuationNumber || ''}`,
      })
      await lockAfterPrint()
      if (result.shared) toast.success('PDF shared successfully.')
      else toast.success('PDF downloaded. You can now share it from your device.')
    } catch (error) {
      if (error?.name === 'AbortError') return
      toast.error('Failed to generate/share PDF. Please try again.')
    }
  }

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-secondary" onClick={handleSharePdf}><Share2 size={16} /> Share PDF</button>
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
