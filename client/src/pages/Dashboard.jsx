import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, FileText, IndianRupee, Wallet } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { api } from '../lib/api'
import { inr } from '../lib/format'

const statCards = [
  { key: 'totalCustomers', label: 'Total Customers', icon: Users },
  { key: 'valuationsThisMonth', label: 'Valuations This Month', icon: FileText },
  { key: 'marketValueThisMonth', label: 'Market Value This Month', icon: IndianRupee, money: true },
  { key: 'pendingPayments', label: 'Pending Fees', icon: Wallet, money: true },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const valueFor = (card) => {
    const value = data?.[card.key] || 0
    return card.money ? inr(value) : value.toLocaleString('en-IN')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
          <p className="text-sm text-slate-500">Monthly valuation activity and recent documents.</p>
        </div>
        <Link to="/valuations/new" className="btn-primary">New Valuation</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{card.label}</p>
                <Icon className="text-gold-600" size={20} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {loading ? '...' : valueFor(card)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Recent Valuations</h2>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {(data?.recent || []).map((v) => (
            <Link key={v.id} to={`/valuations/${v.id}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 text-sm">{v.valuationNumber}</span>
                <StatusBadge status={v.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{v.customerName} • {v.valuationDate}</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{inr(v.marketValue)}</p>
            </Link>
          ))}
          {!loading && (data?.recent || []).length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No valuations yet.</p>
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
                <th className="px-5 py-3 text-right">Value</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(data?.recent || []).map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <Link to={`/valuations/${v.id}`} className="hover:text-gold-700">
                      {v.valuationNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{v.customerName}</td>
                  <td className="px-5 py-3">{v.valuationDate}</td>
                  <td className="px-5 py-3 text-right font-medium">{inr(v.marketValue)}</td>
                  <td className="px-5 py-3"><StatusBadge status={v.status} /></td>
                </tr>
              ))}
              {!loading && (data?.recent || []).length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-slate-500">
                    No valuations yet.
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
