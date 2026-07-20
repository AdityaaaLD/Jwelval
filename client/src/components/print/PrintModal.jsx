import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, X } from 'lucide-react'
import { api } from '../../lib/api'
import { shareViaWhatsApp } from '../../lib/share'
import { verificationUrl } from '../../lib/qr'
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

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-secondary" onClick={() => shareViaWhatsApp({ text: `Gold Valuation Certificate ${valuation.valuationNumber}: ${verificationUrl(valuation.valuationNumber)}` })}>WhatsApp</button>
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
