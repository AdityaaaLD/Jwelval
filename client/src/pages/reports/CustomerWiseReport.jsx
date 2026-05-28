import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

const exportRows = (filename, rows) => {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

export default function CustomerWiseReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', customer_id: '', status: 'LOCKED' })
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [valuations, setValuations] = useState([])
  const load = () => api.reports.customerWise(filters).then(setRows)
  useEffect(() => { api.customers.list().then(setCustomers); api.valuations.list().then(setValuations); load() }, [])
  const totals = useMemo(() => rows.reduce((a, r) => ({ count: a.count + (Number(r.valuationCount) || 0), value: a.value + (Number(r.totalMarketValue) || 0), loans: a.loans + (Number(r.totalLoanAmount) || 0), fees: a.fees + (Number(r.totalValuationFee) || 0), paid: a.paid + (Number(r.totalPayments) || 0), out: a.out + (Number(r.outstanding) || 0) }), { count: 0, value: 0, loans: 0, fees: 0, paid: 0, out: 0 }), [rows])
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">Customer-wise Report</h1><p className="text-sm text-slate-500">Printed valuations grouped by customer.</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => exportRows('customer-wise-report.csv', [['Code', 'Name', 'Valuations', 'Value', 'Loan', 'Fee', 'Paid', 'Fee Receivable'], ...rows.map((r) => [r.customerCode, r.customerName, r.valuationCount, r.totalMarketValue, r.totalLoanAmount, r.totalValuationFee, r.totalPayments, r.outstanding])])}><Download size={16} /> CSV</button><button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div></div>
      <div className="card grid gap-3 p-4 md:grid-cols-4 no-print"><input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /><input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /><select className="input" value={filters.customer_id} onChange={(e) => setFilters({ ...filters, customer_id: e.target.value })}><option value="">All customers</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn-primary" onClick={load}>Apply</button></div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Sr</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3 text-right">Valuations</th><th className="px-5 py-3 text-right">Value</th><th className="px-5 py-3 text-right">Loan</th><th className="px-5 py-3 text-right">Fee</th><th className="px-5 py-3 text-right">Paid</th><th className="px-5 py-3 text-right">Fee Receivable</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r, i) => <><tr key={r.customerId} className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === r.customerId ? null : r.customerId)}><td className="px-5 py-3">{i + 1}</td><td className="px-5 py-3">{r.customerCode}</td><td className="px-5 py-3">{r.customerName}</td><td className="px-5 py-3 text-right">{r.valuationCount}</td><td className="px-5 py-3 text-right">{inr(r.totalMarketValue)}</td><td className="px-5 py-3 text-right">{inr(r.totalLoanAmount)}</td><td className="px-5 py-3 text-right">{inr(r.totalValuationFee)}</td><td className="px-5 py-3 text-right">{inr(r.totalPayments)}</td><td className="px-5 py-3 text-right">{inr(r.outstanding)}</td></tr>{expanded === r.customerId && <tr><td colSpan="9" className="bg-slate-50 px-8 py-3">{valuations.filter((v) => v.customerId === r.customerId).map((v) => <div key={v.id} className="flex justify-between border-b border-slate-200 py-1 last:border-0"><span>{v.valuationNumber} - {v.valuationDate}</span><span>{inr(v.marketValue)}</span></div>)}</td></tr>}</>)}</tbody><tfoot className="bg-slate-50 font-semibold"><tr><td className="px-5 py-3" colSpan="3">Grand Total</td><td className="px-5 py-3 text-right">{totals.count}</td><td className="px-5 py-3 text-right">{inr(totals.value)}</td><td className="px-5 py-3 text-right">{inr(totals.loans)}</td><td className="px-5 py-3 text-right">{inr(totals.fees)}</td><td className="px-5 py-3 text-right">{inr(totals.paid)}</td><td className="px-5 py-3 text-right">{inr(totals.out)}</td></tr></tfoot></table>
      </div>
    </div>
  )
}
