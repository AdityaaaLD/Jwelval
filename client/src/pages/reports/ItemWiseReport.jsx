import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, num } from '../../lib/format'

const exportRows = (filename, rows) => {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

export default function ItemWiseReport() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', description: '', format_type: 'ALL' })
  const [rows, setRows] = useState([])
  const load = () => api.reports.itemWise(filters).then(setRows)
  useEffect(() => { load() }, [])
  const totals = useMemo(() => rows.reduce((a, r) => ({
    valuations: a.valuations + (Number(r.valuationCount) || 0), units: a.units + (Number(r.totalUnits) || 0), gross: a.gross + (Number(r.totalGrossWt) || 0), net: a.net + (Number(r.totalNetWt) || 0), gold24: a.gold24 + (Number(r.total24kGm) || 0), gold22: a.gold22 + (Number(r.total22kGm) || 0), value: a.value + (Number(r.totalValue) || 0),
  }), { valuations: 0, units: 0, gross: 0, net: 0, gold24: 0, gold22: 0, value: 0 }), [rows])
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">Item-wise Report</h1><p className="text-sm text-slate-500">Aggregated ornament movement and value.</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => exportRows('item-wise-report.csv', [['Item', 'Valuations', 'Units', 'Gross', 'Net', '24K', '22K', 'Value'], ...rows.map((r) => [r.description, r.valuationCount, r.totalUnits, r.totalGrossWt, r.totalNetWt, r.total24kGm, r.total22kGm, r.totalValue])])}><Download size={16} /> CSV</button><button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div></div>
      <div className="card grid gap-3 p-4 md:grid-cols-5 no-print"><input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /><input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /><input className="input" placeholder="Item description" value={filters.description} onChange={(e) => setFilters({ ...filters, description: e.target.value })} /><select className="input" value={filters.format_type} onChange={(e) => setFilters({ ...filters, format_type: e.target.value })}>{['ALL', 'RUSHIKESH', 'DNYANESHWARI', 'BANK_OF_MAHA'].map((f) => <option key={f}>{f}</option>)}</select><button className="btn-primary" onClick={load}>Apply</button></div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Sr</th><th className="px-5 py-3">Item Description</th><th className="px-5 py-3 text-right">Valuations</th><th className="px-5 py-3 text-right">Units</th><th className="px-5 py-3 text-right">Gross</th><th className="px-5 py-3 text-right">Net</th><th className="px-5 py-3 text-right">24K</th><th className="px-5 py-3 text-right">22K</th><th className="px-5 py-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r, i) => <tr key={r.description}><td className="px-5 py-3">{i + 1}</td><td className="px-5 py-3">{r.description}</td><td className="px-5 py-3 text-right">{r.valuationCount}</td><td className="px-5 py-3 text-right">{r.totalUnits}</td><td className="px-5 py-3 text-right">{num(r.totalGrossWt, 3)}</td><td className="px-5 py-3 text-right">{num(r.totalNetWt, 3)}</td><td className="px-5 py-3 text-right">{num(r.total24kGm, 3)}</td><td className="px-5 py-3 text-right">{num(r.total22kGm, 3)}</td><td className="px-5 py-3 text-right">{inr(r.totalValue)}</td></tr>)}</tbody><tfoot className="bg-slate-50 font-semibold"><tr><td className="px-5 py-3" colSpan="2">Grand Total</td><td className="px-5 py-3 text-right">{totals.valuations}</td><td className="px-5 py-3 text-right">{totals.units}</td><td className="px-5 py-3 text-right">{num(totals.gross, 3)}</td><td className="px-5 py-3 text-right">{num(totals.net, 3)}</td><td className="px-5 py-3 text-right">{num(totals.gold24, 3)}</td><td className="px-5 py-3 text-right">{num(totals.gold22, 3)}</td><td className="px-5 py-3 text-right">{inr(totals.value)}</td></tr></tfoot></table>
      </div>
    </div>
  )
}
