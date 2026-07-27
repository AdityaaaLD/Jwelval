import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Printer, Share2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { fetchValuationPdf, sharePdf } from '../../lib/share'
import PrintDigitalCert from './PrintDigitalCert'

function Template({ valuation }) {
  return <PrintDigitalCert valuation={valuation} />
}

export default function PrintModal({ valuation, onClose, onLocked }) {
  const [pdf, setPdf] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const abortRef = useRef(null)

  const fileBaseName = valuation?.valuationNumber || `valuation-${valuation?.id || 'report'}`

  // Warm the PDF up front so the share sheet can open inside the user's tap
  // gesture, which is required by Safari and some Android browsers.
  useEffect(() => {
    if (!valuation?.id) return undefined
    const controller = new AbortController()
    abortRef.current = controller
    let cancelled = false

    setPreparing(true)
    fetchValuationPdf({ valuationId: valuation.id, fileBaseName, signal: controller.signal })
      .then((result) => { if (!cancelled) setPdf(result) })
      .catch(() => { if (!cancelled) setPdf(null) })
      .finally(() => { if (!cancelled) setPreparing(false) })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [valuation?.id, fileBaseName])

  const lockAfterPrint = async () => {
    if (valuation.status === 'DRAFT') onLocked?.(await api.valuations.markPrinted(valuation.id))
  }

  const handlePrint = async () => {
    window.print()
    await lockAfterPrint()
    toast.success('Document sent to print / saved as PDF.')
  }

  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    const toastId = 'pdf-share'
    try {
      let ready = pdf
      if (!ready) {
        toast.loading('Preparing PDF...', { id: toastId })
        ready = await fetchValuationPdf({ valuationId: valuation.id, fileBaseName })
        setPdf(ready)
      }
      const { method } = await sharePdf({
        pdf: ready,
        shareTitle: `Valuation Report ${valuation?.valuationNumber || ''}`.trim(),
        shareText: `Valuation report ${valuation?.valuationNumber || ''}`.trim(),
      })
      toast.dismiss(toastId)
      await lockAfterPrint()
      if (method === 'share') toast.success('PDF shared successfully.')
      else if (method === 'download') toast.success('PDF downloaded. You can now attach it anywhere.')
      else toast.success('PDF opened. Use your browser share option to send it.')
    } catch (error) {
      toast.dismiss(toastId)
      if (error?.name === 'AbortError') return
      toast.error(error?.message || 'Failed to share PDF. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const shareLabel = sharing ? 'Sharing...' : preparing ? 'Preparing PDF...' : 'Share as PDF'

  return createPortal(
    <div id="print-portal" className="print-overlay">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleShare}
          disabled={sharing}
          title="Bank copy — the KYC documents sheet is not included"
        >
          <Share2 size={16} /> {shareLabel}
        </button>
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
