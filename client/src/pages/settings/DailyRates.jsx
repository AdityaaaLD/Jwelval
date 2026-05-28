import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import { api } from '../../lib/api'
import { today } from '../../lib/format'

export default function DailyRates() {
  const [form, setForm] = useState({ rateDate: today(), goldRate22k: '' })
  useEffect(() => { api.rates.get(form.rateDate).then((r) => setForm({ rateDate: r.rateDate, goldRate22k: r.goldRate22k || '' })) }, [])
  const goldRate24k = form.goldRate22k ? +(Number(form.goldRate22k) * 24 / 22).toFixed(2) : ''
  const save = async () => {
    if (!Number(form.goldRate22k)) return toast.error('Enter 22K gold rate per gram.')
    await api.rates.save({ ...form, goldRate24k })
    toast.success('Daily gold rate saved.')
  }
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Daily Gold Rate</h1><p className="text-sm text-slate-500">Save once per day; new valuations auto-fill from here. 24K rate is auto-derived.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div><label className="label">Date</label><input type="date" className="input" value={form.rateDate} onChange={(e) => setForm({ ...form, rateDate: e.target.value })} /></div>
        <div><label className="label">22K Gold Rate (₹ per gram)</label><input type="number" className="input" placeholder="e.g. 5800" value={form.goldRate22k} onChange={(e) => setForm({ ...form, goldRate22k: e.target.value })} /></div>
        {goldRate24k && <p className="text-sm text-slate-500 md:col-span-2">24K rate (auto-calculated): ₹{goldRate24k}/gram</p>}
        <button className="btn-primary md:col-span-2" onClick={save}><Save size={16} /> Save Rate</button>
      </div>
    </div>
  )
}
