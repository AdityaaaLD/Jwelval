import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

export default function ValuationList() {
  const location = useLocation()
  const [valuations, setValuations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('')

  useEffect(() => {
    api.valuations.list()
      .then(setValuations)
      .finally(() => setLoading(false))
  }, [location.key])

  const banks = useMemo(() => {
    const set = new Set(valuations.map((v) => v.branch).filter(Boolean))
    return [...set].sort()
  }, [valuations])

  const filtered = useMemo(() => {
    let list = valuations
    if (bankFilter) list = list.filter((v) => v.branch === bankFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((v) =>
        (v.valuationNumber || '').toLowerCase().includes(q) ||
        (v.customerName || '').toLowerCase().includes(q) ||
        (v.branch || '').toLowerCase().includes(q) ||
        (v.valuationDate || '').includes(q)
      )
    }
    return list
  }, [valuations, search, bankFilter])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Valuations</h1>
          <p className="text-sm text-slate-500">Draft, printed, and locked valuation documents.</p>
        </div>
        <Link to="/valuations/new" className="btn-primary"><Plus size={16} /> New Valuation</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search by valuation no, customer, branch, date..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
          <option value="">All Banks / Branches</option>
          {banks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Valuation No.</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3 text-right">Market Value</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((valuation) => (
                <tr key={valuation.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/valuations/${valuation.id}`} className="hover:text-gold-700">
                      {valuation.valuationNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{valuation.customerName}</td>
                  <td className="px-5 py-3">{valuation.valuationDate}</td>
                  <td className="px-5 py-3">{valuation.branch || '-'}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.marketValue)}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.valuationFee)}</td>
                  <td className="px-5 py-3"><StatusBadge status={valuation.status} /></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-10 text-center text-slate-500">
                    {valuations.length === 0 ? 'No valuations created yet.' : 'No matching valuations found.'}
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
