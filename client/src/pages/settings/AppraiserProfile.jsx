import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Upload } from 'lucide-react'
import QrImage from '../../components/QrImage'
import { api } from '../../lib/api'
import { upiUrl } from '../../lib/qr'

export default function AppraiserProfile() {
  const [form, setForm] = useState({ appraiserName: '', businessName: '', mobile: '', email: '', upiId: '', address: '', logoPhoto: '', empanelmentId: '', gstn: '' })
  useEffect(() => { api.profile.get().then((p) => setForm({ appraiserName: p.appraiser_name || '', businessName: p.business_name || '', mobile: p.mobile || '', email: p.email || '', upiId: p.upi_id || '', address: p.address || '', logoPhoto: p.logo_photo || '', empanelmentId: p.empanelment_id || '', gstn: p.gstn || '' })) }, [])
  const photo = (file) => { if (!file) return; const r = new FileReader(); r.onload = () => setForm({ ...form, logoPhoto: r.result }); r.readAsDataURL(file) }
  const save = async () => { await api.profile.update(form); toast.success('Profile saved.') }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Appraiser Profile</h1><p className="text-sm text-slate-500">Used on receipts, UPI QR, and future certificate branding.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div><label className="label">Appraiser Name</label><input className="input" value={form.appraiserName} onChange={(e) => setForm({ ...form, appraiserName: e.target.value })} /></div>
        <div><label className="label">Business Name</label><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
        <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">UPI ID</label><input className="input" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} /></div>
        <div><label className="label">Empanelment ID</label><input className="input" placeholder="e.g. BOMPUN1413_24" value={form.empanelmentId} onChange={(e) => setForm({ ...form, empanelmentId: e.target.value })} /></div>
        <div><label className="label">GSTN/PAN/TAN</label><input className="input" placeholder="e.g. ACHPU8474H" value={form.gstn} onChange={(e) => setForm({ ...form, gstn: e.target.value })} /></div>
        <div><label className="label">Logo</label><label className="btn-secondary w-full"><Upload size={16} /> Upload Logo<input className="sr-only" type="file" accept="image/*" onChange={(e) => photo(e.target.files?.[0])} /></label></div>
        <div className="md:col-span-2"><label className="label">Address</label><textarea className="input min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        {form.upiId && <div className="rounded-md border border-slate-200 p-4"><QrImage text={upiUrl({ upiId: form.upiId, name: form.businessName })} className="h-32 w-32" /><p className="mt-2 text-sm text-slate-500">UPI collection QR</p></div>}
        <button className="btn-primary md:col-span-2" onClick={save}><Save size={16} /> Save Profile</button>
      </div>
    </div>
  )
}
