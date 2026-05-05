import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import toast from 'react-hot-toast'
import { Download, Printer, X } from 'lucide-react'
import { api } from '../../lib/api'
import { shareViaWhatsApp } from '../../lib/share'
import { verificationUrl } from '../../lib/qr'
import PrintRushikesh from './PrintRushikesh'
import PrintDnyaneshwari from './PrintDnyaneshwari'
import PrintBankOfMaha from './PrintBankOfMaha'
import FeeReceipt from './FeeReceipt'

function Template({ valuation }) {
  if (valuation.formatType === 'DNYANESHWARI') return <PrintDnyaneshwari valuation={valuation} />
  if (valuation.formatType === 'BANK_OF_MAHA') return <PrintBankOfMaha valuation={valuation} />
  return <PrintRushikesh valuation={valuation} />
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
    window.print()
    await lockAfterPrint()
    toast.success('Document locked after print.')
  }
  const downloadPdf = async () => {
    setWorking(true)
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const width = 210
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, canvas.height * width / canvas.width)
      pdf.save(`${valuation.valuationNumber || 'valuation'}.pdf`)
      await lockAfterPrint()
      toast.success('PDF downloaded and document locked.')
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
        <button type="button" className="btn-secondary" onClick={downloadPdf} disabled={working}><Download size={16} /> Download PDF</button>
        <button type="button" className="btn-primary" onClick={doPrint}><Printer size={16} /> Print</button>
      </div>
      <div className="h-full overflow-auto py-20"><div ref={printRef} className="mx-auto w-fit">{showReceipt ? <FeeReceipt valuation={valuation} profile={profile} /> : <Template valuation={valuation} />}</div></div>
    </div>
  )
}
