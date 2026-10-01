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
  const [renewalFilter, setRenewalFilter] = useState('')
  const [renewalDateFilter, setRenewalDateFilter] = useState('')

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
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (bankFilter) list = list.filter((v) => v.branch === bankFilter)
    if (renewalFilter === 'due') {
      list = list.filter((v) => v.renewalDate && v.renewalDate <= today && !v.hasRenewal && v.status !== 'DRAFT')
    } else if (renewalFilter === 'renewed') {
      list = list.filter((v) => Number(v.renewalNumber) > 0)
    }
    if (renewalDateFilter) {
      list = list.filter((v) => v.renewalDate === renewalDateFilter && !v.hasRenewal && v.status !== 'DRAFT')
    }
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
  }, [valuations, search, bankFilter, renewalFilter, renewalDateFilter])

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
        <select className="input w-full sm:w-auto" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
          <option value="">All Banks / Branches</option>
          {banks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="input w-full sm:w-auto" value={renewalFilter} onChange={(e) => setRenewalFilter(e.target.value)}>
          <option value="">All Renewal Types</option>
          <option value="due">Due for Renewal</option>
          <option value="renewed">Renewed</option>
        </select>
        <div className="field-c w-full sm:w-auto">
          <label className="label-c">Renewal date</label>
          <input type="date" className="input" value={renewalDateFilter} onChange={(e) => setRenewalDateFilter(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map((valuation) => (
            <Link key={valuation.id} to={`/valuations/${valuation.id}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900 text-sm">{valuation.valuationNumber}</span>
                <span className="flex items-center gap-1.5">
                  {Number(valuation.renewalNumber) > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">Renewal #{valuation.renewalNumber}</span>}
                  {!Number(valuation.renewalNumber) && Number(valuation.renewalCount) > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{valuation.renewalCount} renewed</span>}
                  <StatusBadge status={valuation.status} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{valuation.customerName} • {valuation.valuationDate}</p>
              {valuation.renewalDate && <p className="mt-0.5 text-xs text-slate-400">Renewal date: {valuation.renewalDate}</p>}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-400">{valuation.branch || ''}</span>
                <span className="text-sm font-semibold text-slate-800">{inr(valuation.marketValue)}</span>
              </div>
            </Link>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {valuations.length === 0 ? 'No valuations created yet.' : 'No matching valuations found.'}
            </p>
          )}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Valuation No.</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Renewal Date</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3 text-right">Market Value</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Renewal</th>
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
                  <td className="px-5 py-3">{valuation.renewalDate || '-'}</td>
                  <td className="px-5 py-3">{valuation.branch || '-'}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.marketValue)}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.valuationFee)}</td>
                  <td className="px-5 py-3"><StatusBadge status={valuation.status} /></td>
                  <td className="px-5 py-3">
                    {Number(valuation.renewalNumber) > 0
                      ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Renewal #{valuation.renewalNumber}</span>
                      : Number(valuation.renewalCount) > 0
                        ? <span className="text-xs font-medium text-slate-600">{valuation.renewalCount} renewed</span>
                        : '-'}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-5 py-10 text-center text-slate-500">
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
