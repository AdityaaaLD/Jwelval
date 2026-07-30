import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, Check, X, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { compressImage } from '../../lib/imageCompress'

const emptyForm = { bankName: 'Bank of Maharashtra', branch: '', branchCode: '', rateOfInterest: '', loanLtv: 57, empanelmentId: '', managerName: '', bankLogo: '', address: '', appIdPrefix: '', appIdDigits: 10, certificateRules: '' }

export default function BankPresets() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ ...emptyForm })
  const [editId, setEditId] = useState(null)
  const load = () => api.presets.banks().then(setRows)
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.bankName.trim()) return toast.error('Bank name is required.')
    if (editId) {
      await api.presets.updateBank(editId, form)
      toast.success('Preset updated.')
      setEditId(null)
    } else {
      await api.presets.createBank(form)
      toast.success('Bank preset added.')
    }
    setForm({ ...emptyForm })
    load()
  }

  const startEdit = (r) => {
    setEditId(r.id)
    setForm({ bankName: r.bankName, branch: r.branch, branchCode: r.branchCode || '', rateOfInterest: r.rateOfInterest || '', loanLtv: r.loanLtv || 57, empanelmentId: r.empanelmentId || '', managerName: r.managerName || '', bankLogo: r.bankLogo || '', address: r.address || '', appIdPrefix: r.appIdPrefix || '', appIdDigits: r.appIdDigits || 10, certificateRules: r.certificateRules || '' })
  }

  const cancelEdit = () => { setEditId(null); setForm({ ...emptyForm }) }

  const remove = async (id) => {
    if (!confirm('Delete this bank preset?')) return
    await api.presets.deleteBank(id)
    toast.success('Deleted.')
    load()
  }

  const uploadBankLogo = async (file) => {
    if (!file) return
    try {
      const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 500, quality: 0.85 })
      setForm((f) => ({ ...f, bankLogo: compressed }))
    } catch {
      toast.error('Unable to process bank logo image.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Bank Presets</h1>
        <p className="text-sm text-slate-500">Store branch defaults. On valuation form, selecting a preset auto-fills Branch, Branch Code, ROI, and Application ID.</p>
      </div>
      <div className="card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div><label className="label">Bank Name *</label><input className="input" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
          <div><label className="label">Branch Name</label><input className="input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
          <div><label className="label">Branch Code</label><input className="input" value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} /></div>
          <div><label className="label">Rate of Interest (%)</label><input type="number" className="input" value={form.rateOfInterest} onChange={(e) => setForm({ ...form, rateOfInterest: e.target.value })} /></div>
          <div><label className="label">LTV (%)</label><input type="number" className="input" value={form.loanLtv} onChange={(e) => setForm({ ...form, loanLtv: e.target.value })} /></div>
          <div><label className="label">Empanelment ID</label><input className="input" value={form.empanelmentId} onChange={(e) => setForm({ ...form, empanelmentId: e.target.value })} /></div>
          <div><label className="label">Manager Name</label><input className="input" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} /></div>
          <div><label className="label">App ID Prefix</label><input className="input" value={form.appIdPrefix} onChange={(e) => setForm({ ...form, appIdPrefix: e.target.value })} /></div>
          <div><label className="label">App ID Digits</label><input type="number" className="input" value={form.appIdDigits} onChange={(e) => setForm({ ...form, appIdDigits: e.target.value })} /></div>
        </div>
        <div>
          <label className="label">Bank Logo (horizontal)</label>
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 md:flex-row md:items-center">
            <div className="h-20 w-full max-w-md overflow-hidden rounded border border-slate-200 bg-slate-50">
              {form.bankLogo
                ? <img src={form.bankLogo} alt="Bank logo" className="h-full w-full object-contain" />
                : <div className="grid h-full w-full place-items-center text-xs text-slate-400">No bank logo</div>}
            </div>
            <div className="flex gap-2">
              <label className="btn-secondary">
                <Upload size={16} /> Upload Logo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadBankLogo(e.target.files?.[0])} />
              </label>
              {form.bankLogo && <button type="button" className="btn-secondary" onClick={() => setForm((f) => ({ ...f, bankLogo: '' }))}>Remove</button>}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">Shown on valuation certificate near the declaration section.</p>
        </div>
        <div>
          <label className="label">Certificate Rules / Declaration Text</label>
          <textarea className="input" rows={4} placeholder="Enter bank-specific certificate rules or declaration text that will appear on the printed valuation report..." value={form.certificateRules} onChange={(e) => setForm({ ...form, certificateRules: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={save}>{editId ? <><Check size={16} /> Update</> : <><Plus size={16} /> Add Preset</>}</button>
          {editId && <button className="btn-secondary" onClick={cancelEdit}><X size={16} /> Cancel</button>}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Bank</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">ROI%</th>
              <th className="px-4 py-3">LTV%</th>
              <th className="px-4 py-3">Empanelment ID</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">App Prefix</th>
              <th className="px-4 py-3">Next #</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={editId === r.id ? 'bg-gold-50' : ''}>
                <td className="px-4 py-3">{r.bankName}</td>
                <td className="px-4 py-3">{r.branch || '-'}</td>
                <td className="px-4 py-3">{r.branchCode || '-'}</td>
                <td className="px-4 py-3">{r.rateOfInterest || '-'}</td>
                <td className="px-4 py-3">{r.loanLtv || '-'}</td>
                <td className="px-4 py-3">{r.empanelmentId || '-'}</td>
                <td className="px-4 py-3">{r.managerName || '-'}</td>
                <td className="px-4 py-3">{r.appIdPrefix || '-'}</td>
                <td className="px-4 py-3">{(r.appIdCurrentNumber || 0) + 1}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex gap-1">
                    <button className="btn-ghost" onClick={() => startEdit(r)}><Pencil size={15} /></button>
                    <button className="btn-ghost text-red-500" onClick={() => remove(r.id)}><Trash2 size={15} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
