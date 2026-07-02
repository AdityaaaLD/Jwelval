import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Loader2 } from 'lucide-react'
import QrImage from '../../components/QrImage'
import { api } from '../../lib/api'
import { upiUrl } from '../../lib/qr'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^[6-9]\d{9}$/
const UPI_RE = /^[\w.+-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/

const EMPTY_FORM = { appraiserName: '', businessName: '', mobile: '', email: '', upiId: '', address: '', empanelmentId: '', gstn: '', qualification: '', organization: '', certNumber: '' }

function normalizeMobile(input) {
  let digits = String(input || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  return digits
}

function validate(form) {
  const errors = {}
  if (!form.appraiserName.trim()) errors.appraiserName = 'Appraiser / proprietor name is required.'
  if (!form.businessName.trim()) errors.businessName = 'Business name is required.'
  const normalizedMobile = normalizeMobile(form.mobile)
  if (normalizedMobile && !MOBILE_RE.test(normalizedMobile)) errors.mobile = 'Enter a valid 10-digit mobile number.'
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.upiId.trim() && !UPI_RE.test(form.upiId.trim())) errors.upiId = 'Enter a valid UPI ID (e.g. name@bank).'
  return errors
}

export default function AppraiserProfile() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.profile.get()
      .then((p) => {
        if (cancelled) return
        setForm({
          appraiserName: p.appraiser_name || '',
          businessName: p.business_name || '',
          mobile: p.mobile || '',
          email: p.email || '',
          upiId: p.upi_id || '',
          address: p.address || '',
          empanelmentId: p.empanelment_id || '',
          gstn: p.gstn || '',
          qualification: p.qualification || '',
          organization: p.organization || '',
          certNumber: p.cert_number || '',
        })
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to load profile.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const save = async () => {
    const normalizedForm = {
      ...form,
      mobile: normalizeMobile(form.mobile),
      email: String(form.email || '').trim().toLowerCase(),
      upiId: String(form.upiId || '').trim().toLowerCase(),
    }
    const localErrors = validate(normalizedForm)
    if (Object.keys(localErrors).length) {
      setErrors(localErrors)
      toast.error('Please fix the highlighted fields.')
      return
    }
    setForm((prev) => ({ ...prev, ...normalizedForm }))
    setSaving(true)
    try {
      await api.profile.update(normalizedForm)
      setErrors({})
      toast.success('Profile saved.')
    } catch (err) {
      if (err?.code === 'VALIDATION' && err?.payload?.fields) {
        setErrors(err.payload.fields)
      }
      toast.error(err?.message || 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Appraiser Profile</h1><p className="text-sm text-slate-500">Used on receipts, UPI QR, and future certificate branding.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label className="label">Appraiser / Proprietor Name *</label>
          <input className={`input ${errors.appraiserName ? 'border-red-500' : ''}`} placeholder="e.g. Rameshwar Prakash Udawant" value={form.appraiserName} onChange={setField('appraiserName')} />
          {errors.appraiserName && <p className="mt-1 text-xs text-red-600">{errors.appraiserName}</p>}
        </div>
        <div>
          <label className="label">Business Name *</label>
          <input className={`input ${errors.businessName ? 'border-red-500' : ''}`} value={form.businessName} onChange={setField('businessName')} />
          {errors.businessName && <p className="mt-1 text-xs text-red-600">{errors.businessName}</p>}
        </div>
        <div>
          <label className="label">Mobile</label>
          <input className={`input ${errors.mobile ? 'border-red-500' : ''}`} value={form.mobile} onChange={setField('mobile')} maxLength={10} />
          {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input className={`input ${errors.email ? 'border-red-500' : ''}`} value={form.email} onChange={setField('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="label">UPI ID</label>
          <input className={`input ${errors.upiId ? 'border-red-500' : ''}`} placeholder="e.g. name@okhdfcbank" value={form.upiId} onChange={setField('upiId')} />
          {errors.upiId && <p className="mt-1 text-xs text-red-600">{errors.upiId}</p>}
        </div>
        <div><label className="label">Empanelment ID</label><input className="input" placeholder="e.g. BOMPUN1413_24" value={form.empanelmentId} onChange={setField('empanelmentId')} /></div>
        <div><label className="label">GSTN/PAN/TAN</label><input className="input" placeholder="e.g. ACHPU8474H" value={form.gstn} onChange={setField('gstn')} /></div>
        <div className="md:col-span-2"><label className="label">Address</label><textarea className="input min-h-20" value={form.address} onChange={setField('address')} /></div>
        <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-1"><p className="text-sm font-semibold text-slate-700">Certificate Header Info</p><p className="text-xs text-slate-400">Shown below the business name on all print formats.</p></div>
        <div><label className="label">Qualification / Title</label><input className="input" placeholder="e.g. Government Approved Gold Appaisal (Jewellery Gold Valuer)" value={form.qualification} onChange={setField('qualification')} /></div>
        <div><label className="label">Organization</label><input className="input" placeholder="e.g. MSME - Technology Development Center (Government of India)" value={form.organization} onChange={setField('organization')} /></div>
        <div><label className="label">Certificate / Registration No.</label><input className="input" placeholder="e.g. PPDC/Trg./OSP/2021-22/23238" value={form.certNumber} onChange={setField('certNumber')} /></div>
        {form.upiId && !errors.upiId && <div className="rounded-md border border-slate-200 p-4"><QrImage text={upiUrl({ upiId: form.upiId, name: form.businessName })} className="h-32 w-32" /><p className="mt-2 text-sm text-slate-500">UPI collection QR</p></div>}
        <button className="btn-primary md:col-span-2 disabled:cursor-not-allowed disabled:opacity-60" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
