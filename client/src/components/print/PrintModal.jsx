import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, Printer, X } from 'lucide-react'
import { api } from '../../lib/api'
import { shareViaWhatsApp } from '../../lib/share'
import { verificationUrl } from '../../lib/qr'
import PrintRushikesh from './PrintRushikesh'
import PrintDnyaneshwari from './PrintDnyaneshwari'
import PrintBankOfMaha from './PrintBankOfMaha'
import PrintDigitalCert from './PrintDigitalCert'
import FeeReceipt from './FeeReceipt'

function Template({ valuation }) {
  if (valuation.formatType === 'DNYANESHWARI') return <PrintDnyaneshwari valuation={valuation} />
  if (valuation.formatType === 'BANK_OF_MAHA') return <PrintBankOfMaha valuation={valuation} />
  if (valuation.formatType === 'DIGITAL_CERT') return <PrintDigitalCert valuation={valuation} />
  return <PrintRushikesh valuation={valuation} />
}

function openPrintWindow(contentEl) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { toast.error('Popup blocked — please allow popups for this site.'); return }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n')

  win.document.write(`<!DOCTYPE html>
<html><head><title>Print</title>${styles}
<style>
  body { margin: 0; background: #fff; }
  @media print {
    @page { size: A4; margin: 8mm; }
    .print-page { width: auto; min-height: auto; padding: 0; box-shadow: none; }
    .fee-receipt { box-shadow: none; }
  }
</style></head>
<body>${contentEl.innerHTML}</body></html>`)
  win.document.close()

  const imgs = win.document.querySelectorAll('img')
  const promises = Array.from(imgs).map(
    (img) => img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r })
  )
  Promise.all(promises).then(() => {
    setTimeout(() => { win.focus(); win.print(); win.close() }, 300)
  })
}

export default function PrintModal({ valuation, onClose, onLocked }) {
  const printRef = useRef(null)
  const [working, setWorking] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [profile, setProfile] = useState(null)
  useEffect(() => { api.profile.get().then(setProfile).catch(() => {}) }, [])
  const lockAfterPrint = async () => {
    if (valuation.status === 'DRAFT') onLocked?.(await api.valuations.markPrinted(valuation.id))
  }
  const doPrint = async () => {
    openPrintWindow(printRef.current)
    await lockAfterPrint()
    toast.success('Document locked after print.')
  }
  const downloadPdf = async () => {
    setWorking(true)
    try {
      openPrintWindow(printRef.current)
      await lockAfterPrint()
      toast.success('Use "Save as PDF" in the print dialog to download.')
    } finally {
      setWorking(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75">
      <div className="print-modal-toolbar no-print">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={16} /> Close</button>
        <button type="button" className="btn-secondary" onClick={() => setShowReceipt(!showReceipt)}>Fee Receipt</button>
        <button type="button" className="btn-secondary" onClick={() => shareViaWhatsApp({ text: `Gold Valuation Certificate ${valuation.valuationNumber}: ${verificationUrl(valuation.valuationNumber)}` })}>WhatsApp</button>
        <button type="button" className="btn-secondary" onClick={downloadPdf} disabled={working}><Download size={16} /> Save as PDF</button>
        <button type="button" className="btn-primary" onClick={doPrint}><Printer size={16} /> Print</button>
      </div>
      <div className="h-full overflow-auto py-20"><div ref={printRef} className="mx-auto w-fit">{showReceipt ? <FeeReceipt valuation={valuation} profile={profile} /> : <Template valuation={valuation} />}</div></div>
    </div>
  )
}
