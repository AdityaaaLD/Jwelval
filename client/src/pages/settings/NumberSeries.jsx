import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Save, X } from 'lucide-react'
import { api } from '../../lib/api'

const formats = [
  ['RUSHIKESH', 'Rushikesh Jewellers'],
  ['DNYANESHWARI', 'Dnyaneshwari Jewellers'],
  ['BANK_OF_MAHA', 'Bank of Maharashtra'],
  ['DIGITAL_CERT', 'Digital Certificate'],
]

export default function NumberSeries() {
  const [series, setSeries] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ seriesName: '', prefix: '', formatType: 'RUSHIKESH', startingNumber: 1, numberOfDigits: 4 })
  const load = () => api.series.list().then(setSeries)
  useEffect(() => { load() }, [])
  const preview = `${form.prefix || 'PREFIX'}-${String(form.startingNumber || 1).padStart(Number(form.numberOfDigits) || 4, '0')}`
  const save = async (event) => {
    event.preventDefault()
    if (editing) await api.series.update(editing.id, { seriesName: editing.seriesName })
    else await api.series.create(form)
    toast.success('Series saved.')
    setOpen(false); setEditing(null); setForm({ seriesName: '', prefix: '', formatType: 'RUSHIKESH', startingNumber: 1, numberOfDigits: 4 })
    load()
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-slate-950">Number Series</h1><p className="text-sm text-slate-500">Independent running numbers for each document format.</p></div><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Create Series</button></div>
      <div className="card overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Series Name</th><th className="px-5 py-3">Prefix</th><th className="px-5 py-3">Format</th><th className="px-5 py-3 text-right">Current</th><th className="px-5 py-3">Next</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{series.map((s) => <tr key={s.id}><td className="px-5 py-3 font-medium">{s.seriesName}</td><td className="px-5 py-3">{s.prefix}</td><td className="px-5 py-3">{s.formatType}</td><td className="px-5 py-3 text-right">{s.currentNumber}</td><td className="px-5 py-3">{s.nextNumber}</td><td className="px-5 py-3">{s.createdAt?.slice(0, 10)}</td><td className="px-5 py-3"><button className="text-gold-700" onClick={() => setEditing({ id: s.id, seriesName: s.seriesName })}>Edit Name</button></td></tr>)}</tbody></table></div>
      {(open || editing) && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={save} className="card w-full max-w-lg p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? 'Edit Series Name' : 'Create Series'}</h2><button type="button" className="btn-ghost" onClick={() => { setOpen(false); setEditing(null) }}><X size={16} /></button></div>{editing ? <><p className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">Changing series settings may affect document continuity.</p><label className="label mt-4">Series Name</label><input className="input" value={editing.seriesName} onChange={(e) => setEditing({ ...editing, seriesName: e.target.value })} /></> : <div className="mt-4 grid gap-4"><div><label className="label">Series Name*</label><input className="input" value={form.seriesName} onChange={(e) => setForm({ ...form, seriesName: e.target.value })} required /></div><div><label className="label">Prefix*</label><input className="input" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} required /></div><div><label className="label">Format Type*</label><select className="input" value={form.formatType} onChange={(e) => setForm({ ...form, formatType: e.target.value })}>{formats.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Starting Number</label><input type="number" className="input" value={form.startingNumber} onChange={(e) => setForm({ ...form, startingNumber: e.target.value })} /></div><div><label className="label">Digits</label><select className="input" value={form.numberOfDigits} onChange={(e) => setForm({ ...form, numberOfDigits: e.target.value })}>{[3,4,5].map((d) => <option key={d}>{d}</option>)}</select></div></div><p className="rounded-md bg-gold-50 p-3 text-sm font-medium">Next valuation number will be: {preview}</p></div>}<div className="mt-5 flex justify-end"><button className="btn-primary"><Save size={16} /> Save</button></div></form></div>}
    </div>
  )
}
