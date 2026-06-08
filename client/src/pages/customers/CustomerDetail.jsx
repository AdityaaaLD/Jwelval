import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, FilePlus } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { inr, maskAadhar } from '../../lib/format'

export default function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)

  useEffect(() => {
    api.customers.get(id).then(setCustomer)
  }, [id])

  const totals = useMemo(() => {
    const valuations = customer?.valuations || []
    return valuations.reduce((acc, valuation) => ({
      value: acc.value + (Number(valuation.marketValue) || 0),
      loans: acc.loans + (Number(valuation.loanAmount) || 0),
      fees: acc.fees + (Number(valuation.valuationFee) || 0),
    }), { value: 0, loans: 0, fees: 0 })
  }, [customer])

  if (!customer) {
    return <div className="card p-6 text-sm text-slate-500">Loading customer...</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/customers" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{customer.name}</h1>
            <p className="text-sm text-slate-500">{customer.customerCode}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${id}/edit`} className="btn-secondary"><Edit size={16} /> Edit</Link>
          <Link to={`/valuations/new?customer_id=${id}`} className="btn-primary"><FilePlus size={16} /> New Valuation</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-950">Customer Details</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Mobile</dt><dd className="font-medium">{customer.mobile || '-'}</dd></div>
            <div><dt className="text-slate-500">Aadhar</dt><dd className="font-medium">{maskAadhar(customer.aadharNumber) || '-'}</dd></div>
            <div><dt className="text-slate-500">Savings A/C No</dt><dd className="font-medium">{customer.savingsAcNo || '-'}</dd></div>
            <div><dt className="text-slate-500">Bank</dt><dd className="font-medium">{customer.bankName || '-'}</dd></div>
            <div><dt className="text-slate-500">Branch</dt><dd className="font-medium">{customer.branch || '-'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-medium">{customer.address || '-'}</dd></div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-950">Summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Total valuations</dt><dd className="font-semibold">{customer.valuations.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Total value</dt><dd className="font-semibold">{inr(totals.value)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Total loans</dt><dd className="font-semibold">{inr(totals.loans)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Valuation fees</dt><dd className="font-semibold">{inr(totals.fees)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Valuation History</h2>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {customer.valuations.map((valuation) => (
            <Link key={valuation.id} to={`/valuations/${valuation.id}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 text-sm">{valuation.valuationNumber}</span>
                <StatusBadge status={valuation.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{valuation.valuationDate} • {valuation.formatType}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-400">Loan: {inr(valuation.loanAmount)}</span>
                <span className="text-sm font-semibold text-slate-800">{inr(valuation.marketValue)}</span>
              </div>
            </Link>
          ))}
          {customer.valuations.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No valuation history yet.</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">No.</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Format</th>
                <th className="px-5 py-3 text-right">Market Value</th>
                <th className="px-5 py-3 text-right">Loan Amount</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {customer.valuations.map((valuation) => (
                <tr key={valuation.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/valuations/${valuation.id}`} className="hover:text-gold-700">
                      {valuation.valuationNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{valuation.valuationDate}</td>
                  <td className="px-5 py-3">{valuation.formatType}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.marketValue)}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.loanAmount)}</td>
                  <td className="px-5 py-3 text-right">{inr(valuation.valuationFee)}</td>
                  <td className="px-5 py-3"><StatusBadge status={valuation.status} /></td>
                  <td className="px-5 py-3">
                    <Link to={`/valuations/${valuation.id}`} className="text-gold-700 hover:text-gold-800">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {customer.valuations.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-5 py-10 text-center text-slate-500">
                    No valuation history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
