import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import QrImage from '../../components/QrImage'
import { api } from '../../lib/api'
import { upiUrl } from '../../lib/qr'

export default function AppraiserProfile() {
  const [form, setForm] = useState({ appraiserName: '', businessName: '', mobile: '', email: '', upiId: '', address: '', empanelmentId: '', gstn: '', qualification: '', organization: '', certNumber: '' })
  useEffect(() => { api.profile.get().then((p) => setForm({ appraiserName: p.appraiser_name || '', businessName: p.business_name || '', mobile: p.mobile || '', email: p.email || '', upiId: p.upi_id || '', address: p.address || '', empanelmentId: p.empanelment_id || '', gstn: p.gstn || '', qualification: p.qualification || '', organization: p.organization || '', certNumber: p.cert_number || '' })) }, [])
  const save = async () => { await api.profile.update(form); toast.success('Profile saved.') }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Appraiser Profile</h1><p className="text-sm text-slate-500">Used on receipts, UPI QR, and future certificate branding.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div><label className="label">Appraiser / Proprietor Name</label><input className="input" placeholder="e.g. Rameshwar Prakash Udawant" value={form.appraiserName} onChange={(e) => setForm({ ...form, appraiserName: e.target.value })} /></div>
        <div><label className="label">Business Name</label><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
        <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">UPI ID</label><input className="input" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} /></div>
        <div><label className="label">Empanelment ID</label><input className="input" placeholder="e.g. BOMPUN1413_24" value={form.empanelmentId} onChange={(e) => setForm({ ...form, empanelmentId: e.target.value })} /></div>
        <div><label className="label">GSTN/PAN/TAN</label><input className="input" placeholder="e.g. ACHPU8474H" value={form.gstn} onChange={(e) => setForm({ ...form, gstn: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="label">Address</label><textarea className="input min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-1"><p className="text-sm font-semibold text-slate-700">Certificate Header Info</p><p className="text-xs text-slate-400">Shown below the business name on all print formats.</p></div>
        <div><label className="label">Qualification / Title</label><input className="input" placeholder="e.g. Government Approved Gold Appaisal (Jewellery Gold Valuer)" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></div>
        <div><label className="label">Organization</label><input className="input" placeholder="e.g. MSME - Technology Development Center (Government of India)" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></div>
        <div><label className="label">Certificate / Registration No.</label><input className="input" placeholder="e.g. PPDC/Trg./OSP/2021-22/23238" value={form.certNumber} onChange={(e) => setForm({ ...form, certNumber: e.target.value })} /></div>
        {form.upiId && <div className="rounded-md border border-slate-200 p-4"><QrImage text={upiUrl({ upiId: form.upiId, name: form.businessName })} className="h-32 w-32" /><p className="mt-2 text-sm text-slate-500">UPI collection QR</p></div>}
        <button className="btn-primary md:col-span-2" onClick={save}><Save size={16} /> Save Profile</button>
      </div>
    </div>
  )
}
