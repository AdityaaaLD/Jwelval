import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../lib/api'

function formatPrintedAt(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  return `${date} at ${time}`
}

export default function VerifyCertificate() {
  const { number } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.verify(number).then(setData).catch((e) => setError(e.message)) }, [number])
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Certificate Verification</h1>
        {error && <div className="mt-5 flex items-center gap-2 text-red-700"><XCircle /> {error}</div>}
        {data && (
          <div className="mt-5 space-y-3">
            <div className={data.verified ? 'flex items-center gap-2 text-green-700' : 'flex items-center gap-2 text-yellow-700'}><CheckCircle2 /> {data.verified ? 'Verified locked certificate' : 'Certificate found but not locked'}</div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Certificate No.</dt><dd className="font-semibold">{data.valuationNumber}</dd></div>
              <div><dt className="text-slate-500">Date</dt><dd className="font-semibold">{data.valuationDate}</dd></div>
              <div><dt className="text-slate-500">Customer</dt><dd className="font-semibold">{data.customerName}</dd></div>
              <div><dt className="text-slate-500">Valuer</dt><dd className="font-semibold">{data.valuerName || '-'}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="font-semibold">{data.status}</dd></div>
              <div><dt className="text-slate-500">Printed At</dt><dd className="font-semibold">{formatPrintedAt(data.printedAt)}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
