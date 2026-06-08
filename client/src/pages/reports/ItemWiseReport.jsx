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
    valuations: a.valuations + (Number(r.valuationCount) || 0), units: a.units + (Number(r.totalUnits) || 0), gross: a.gross + (Number(r.totalGrossWt) || 0), net: a.net + (Number(r.totalNetWt) || 0), value: a.value + (Number(r.totalValue) || 0),
  }), { valuations: 0, units: 0, gross: 0, net: 0, value: 0 }), [rows])
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">Item Type Report</h1><p className="text-sm text-slate-500">Summary by ornament type — how many of each item were valuated across all customers.</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={() => exportRows('item-type-report.csv', [['Item Type', 'Valuations', 'Units', 'Gross Wt (gm)', 'Net Wt (gm)', 'Total Value'], ...rows.map((r) => [r.description, r.valuationCount, r.totalUnits, r.totalGrossWt, r.totalNetWt, r.totalValue])])}><Download size={16} /> CSV</button><button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div></div>
      <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-5 no-print"><input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /><input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /><input className="input" placeholder="Search item type" value={filters.description} onChange={(e) => setFilters({ ...filters, description: e.target.value })} /><select className="input" value={filters.format_type} onChange={(e) => setFilters({ ...filters, format_type: e.target.value })}>{['ALL', 'RUSHIKESH', 'DNYANESHWARI', 'BANK_OF_MAHA'].map((f) => <option key={f}>{f}</option>)}</select><button className="btn-primary col-span-2 md:col-span-1" onClick={load}>Apply</button></div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Sr</th>
              <th className="px-5 py-3">Item Type</th>
              <th className="px-5 py-3 text-right">Valuations</th>
              <th className="px-5 py-3 text-right">Total Units</th>
              <th className="px-5 py-3 text-right">Gross Wt (gm)</th>
              <th className="px-5 py-3 text-right">Net Wt (gm)</th>
              <th className="px-5 py-3 text-right">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.description}>
                <td className="px-5 py-3">{i + 1}</td>
                <td className="px-5 py-3 font-medium">{r.description}</td>
                <td className="px-5 py-3 text-right">{r.valuationCount}</td>
                <td className="px-5 py-3 text-right">{r.totalUnits}</td>
                <td className="px-5 py-3 text-right">{num(r.totalGrossWt, 3)}</td>
                <td className="px-5 py-3 text-right">{num(r.totalNetWt, 3)}</td>
                <td className="px-5 py-3 text-right">{inr(r.totalValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-5 py-3" colSpan="2">Grand Total</td>
              <td className="px-5 py-3 text-right">{totals.valuations}</td>
              <td className="px-5 py-3 text-right">{totals.units}</td>
              <td className="px-5 py-3 text-right">{num(totals.gross, 3)}</td>
              <td className="px-5 py-3 text-right">{num(totals.net, 3)}</td>
              <td className="px-5 py-3 text-right">{inr(totals.value)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
