import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

const csv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
const paymentModeLabel = (mode) => mode === 'RECEIVABLE_FROM_BANK' ? 'Receivable from bank' : mode

export default function PaymentList() {
  const [payments, setPayments] = useState([])
  const [valuations, setValuations] = useState([])
  const [filters, setFilters] = useState({ customerId: '', mode: '', dateFrom: '', dateTo: '' })

  useEffect(() => {
    Promise.all([api.payments.list(), api.valuations.list()]).then(([p, v]) => {
      setPayments(p)
      setValuations(v)
    })
  }, [])

  const valuationById = useMemo(() => Object.fromEntries(valuations.map((v) => [v.id, v])), [valuations])
  const customers = useMemo(() => {
    const seen = new Map()
    valuations.forEach((v) => seen.set(v.customerId, v.customerName))
    return [...seen.entries()]
  }, [valuations])
  const rows = payments.map((p) => ({ ...p, valuation: valuationById[p.valuationId] || {} })).filter((p) => {
    if (filters.customerId && String(p.valuation.customerId) !== String(filters.customerId)) return false
    if (filters.mode && p.mode !== filters.mode) return false
    if (filters.dateFrom && p.paymentDate < filters.dateFrom) return false
    if (filters.dateTo && p.paymentDate > filters.dateTo) return false
    return true
  })
  const total = rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const exportCsv = () => {
    const blob = new Blob([csv([
      ['Date', 'Customer', 'Valuation No', 'Mode', 'Reference', 'Amount'],
      ...rows.map((p) => [p.paymentDate, p.valuation.customerName, p.valuation.valuationNumber, paymentModeLabel(p.mode), p.referenceNumber, p.amount]),
    ])], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'payments.csv'
    a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">Payments</h1><p className="text-sm text-slate-500">Filter and export payment receipts.</p></div><button className="btn-secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        <select className="input" value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}><option value="">All customers</option>{customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select className="input" value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}><option value="">All modes</option><option value="RECEIVABLE_FROM_BANK">Receivable from bank</option><option value="CASH">Cash</option><option value="UPI">UPI</option></select>
        <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <button className="btn-secondary" onClick={() => setFilters({ customerId: '', mode: '', dateFrom: '', dateTo: '' })}>Clear</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Valuation No</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((p) => <tr key={p.id}><td className="px-5 py-3">{p.paymentDate}</td><td className="px-5 py-3">{p.valuation.customerName || '-'}</td><td className="px-5 py-3">{p.valuation.valuationNumber || '-'}</td><td className="px-5 py-3">{paymentModeLabel(p.mode)}</td><td className="px-5 py-3">{p.referenceNumber || '-'}</td><td className="px-5 py-3 text-right">{inr(p.amount)}</td></tr>)}</tbody>
          <tfoot className="bg-slate-50 font-semibold"><tr><td className="px-5 py-3" colSpan="5">Total</td><td className="px-5 py-3 text-right">{inr(total)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  )
}
