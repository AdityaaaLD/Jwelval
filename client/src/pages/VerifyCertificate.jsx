import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { inr } from '../lib/format'

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
              <div><dt className="text-slate-500">Market Value</dt><dd className="font-semibold">{inr(data.marketValue)}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="font-semibold">{data.status}</dd></div>
              <div><dt className="text-slate-500">Printed At</dt><dd className="font-semibold">{data.printedAt || '-'}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
