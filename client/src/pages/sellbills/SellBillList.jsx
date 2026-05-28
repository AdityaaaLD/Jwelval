import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'

export default function SellBillList() {
  const [rows, setRows] = useState([])
  useEffect(() => { api.sellBills.list().then(setRows) }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Sell Bills</h1>
          <p className="text-sm text-slate-500">Jewellery sell bills with 3% GST.</p>
        </div>
        <Link to="/sell-bills/new" className="btn-primary"><Plus size={16} /> New Bill</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Bill No</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-5 py-3 font-medium">
                  <Link to={`/sell-bills/${b.id}`} className="text-gold-600 hover:underline">{b.billNumber}</Link>
                </td>
                <td className="px-5 py-3">{b.billDate}</td>
                <td className="px-5 py-3">{b.customerName}</td>
                <td className="px-5 py-3 text-right">{inr(b.total)}</td>
                <td className="px-5 py-3 text-right">{inr(b.balance)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="5" className="px-5 py-8 text-center text-slate-400">No sell bills yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
