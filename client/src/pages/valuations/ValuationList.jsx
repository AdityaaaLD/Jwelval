import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

export default function ValuationList() {
  const [valuations, setValuations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.valuations.list()
      .then(setValuations)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Valuations</h1>
          <p className="text-sm text-slate-500">Draft, printed, and locked valuation documents.</p>
        </div>
        <Link to="/valuations/new" className="btn-primary"><Plus size={16} /> New Valuation</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Valuation No.</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Format</th>
                <th className="px-5 py-3 text-right">Market Value</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {valuations.map((valuation) => (
                <tr key={valuation.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/valuations/${valuation.id}`} className="hover:text-gold-700">
                      {valuation.valuationNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{valuation.customerName}</td>
                  <td className="px-5 py-3">{valuation.valuationDate}</td>
                  <td className="px-5 py-3">{valuation.formatType}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.marketValue)}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.valuationFee)}</td>
                  <td className="px-5 py-3"><StatusBadge status={valuation.status} /></td>
                </tr>
              ))}
              {!loading && valuations.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-500">
                    No valuations created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
