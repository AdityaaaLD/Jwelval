import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'

export default function BankPresets() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ bankName: 'Bank of Maharashtra', branch: '', rateOfInterest: '', loanLtv: 57, managerName: '', address: '' })
  const load = () => api.presets.banks().then(setRows)
  useEffect(() => { load() }, [])
  const save = async () => { await api.presets.createBank(form); toast.success('Bank preset added.'); setForm({ ...form, branch: '', managerName: '', address: '' }); load() }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Bank Presets</h1><p className="text-sm text-slate-500">Save branch defaults for faster valuation entry.</p></div>
      <div className="card grid gap-3 p-4 md:grid-cols-6"><input className="input" placeholder="Bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /><input className="input" placeholder="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /><input type="number" className="input" placeholder="ROI" value={form.rateOfInterest} onChange={(e) => setForm({ ...form, rateOfInterest: e.target.value })} /><input type="number" className="input" placeholder="LTV" value={form.loanLtv} onChange={(e) => setForm({ ...form, loanLtv: e.target.value })} /><input className="input" placeholder="Manager" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} /><button className="btn-primary" onClick={save}><Plus size={16} /> Add</button></div>
      <div className="card overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Bank</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">ROI</th><th className="px-5 py-3">LTV</th><th className="px-5 py-3">Manager</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="px-5 py-3">{r.bankName}</td><td className="px-5 py-3">{r.branch}</td><td className="px-5 py-3">{r.rateOfInterest || '-'}</td><td className="px-5 py-3">{r.loanLtv || '-'}</td><td className="px-5 py-3">{r.managerName || '-'}</td></tr>)}</tbody></table></div>
    </div>
  )
}
