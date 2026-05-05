import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import { api } from '../../lib/api'
import { today } from '../../lib/format'

export default function DailyRates() {
  const [form, setForm] = useState({ rateDate: today(), goldRate22k: '', goldRate24k: '' })
  useEffect(() => { api.rates.get(form.rateDate).then((r) => setForm({ rateDate: r.rateDate, goldRate22k: r.goldRate22k || '', goldRate24k: r.goldRate24k || '' })) }, [])
  const save = async () => {
    const goldRate24k = form.goldRate24k || +(Number(form.goldRate22k) * 24 / 22).toFixed(2)
    await api.rates.save({ ...form, goldRate24k })
    toast.success('Daily gold rate saved.')
  }
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Daily Gold Rate</h1><p className="text-sm text-slate-500">Save once per day; new valuations auto-fill from here.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-3">
        <div><label className="label">Date</label><input type="date" className="input" value={form.rateDate} onChange={(e) => setForm({ ...form, rateDate: e.target.value })} /></div>
        <div><label className="label">22K Rate</label><input type="number" className="input" value={form.goldRate22k} onChange={(e) => setForm({ ...form, goldRate22k: e.target.value, goldRate24k: +(Number(e.target.value) * 24 / 22).toFixed(2) })} /></div>
        <div><label className="label">24K Rate</label><input type="number" className="input" value={form.goldRate24k} onChange={(e) => setForm({ ...form, goldRate24k: e.target.value })} /></div>
        <button className="btn-primary md:col-span-3" onClick={save}><Save size={16} /> Save Rate</button>
      </div>
    </div>
  )
}
