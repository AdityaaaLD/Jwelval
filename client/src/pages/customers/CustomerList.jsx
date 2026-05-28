import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { maskAadhar } from '../../lib/format'

export default function CustomerList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.customers.list()
      .then(setCustomers)
      .finally(() => setLoading(false))
  }, [location.key])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      [c.customerCode, c.name, c.mobile].some((value) => String(value || '').toLowerCase().includes(q))
    )
  }, [customers, query])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Customers</h1>
          <p className="text-sm text-slate-500">Maintain borrower details and valuation history.</p>
        </div>
        <Link to="/customers/new" className="btn-primary">
          <Plus size={16} /> New Customer
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              className="input pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, or mobile"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Customer Code</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Mobile</th>
                <th className="px-5 py-3">Aadhar</th>
                <th className="px-5 py-3 text-right">Valuations</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-slate-900">{customer.customerCode}</td>
                  <td className="px-5 py-3">{customer.name}</td>
                  <td className="px-5 py-3">{customer.mobile || '-'}</td>
                  <td className="px-5 py-3">{maskAadhar(customer.aadharNumber) || '-'}</td>
                  <td className="px-5 py-3 text-right">{customer.valuationCount || 0}</td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="text-gold-700 hover:text-gold-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-500">
                    No customers found.
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
