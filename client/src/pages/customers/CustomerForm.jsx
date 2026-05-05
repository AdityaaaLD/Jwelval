import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, FileScan, Save, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { scanAadhaarImage } from '../../lib/aadharOcr'

const emptyCustomer = {
  name: '',
  mobile: '',
  address: '',
  aadharNumber: '',
  aadharPhoto: '',
  savingsAcNo: '',
  bankName: '',
  branch: '',
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyCustomer)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [ocrText, setOcrText] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api.customers.get(id).then((customer) => {
      setForm({
        name: customer.name || '',
        mobile: customer.mobile || '',
        address: customer.address || '',
        aadharNumber: customer.aadharNumber || '',
        aadharPhoto: customer.aadharPhoto || '',
        savingsAcNo: customer.savingsAcNo || '',
        bankName: customer.bankName || '',
        branch: customer.branch || '',
      })
    })
  }, [id, isEdit])

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const scanAadhaar = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const image = reader.result
      setForm((current) => ({ ...current, aadharPhoto: image }))
      setScanning(true)
      try {
        const parsed = await scanAadhaarImage(image)
        setOcrText(parsed.rawText)
        setForm((current) => ({
          ...current,
          name: parsed.name || current.name,
          aadharNumber: parsed.aadharNumber || current.aadharNumber,
          address: parsed.address || current.address,
        }))
        toast.success('Aadhaar scan completed. Please verify the fields.')
      } catch (error) {
        toast.error('Could not read Aadhaar details from this image.')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return toast.error('Customer name is required.')
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) return toast.error('Mobile must be 10 digits.')

    setSaving(true)
    try {
      if (isEdit) await api.customers.update(id, form)
      else await api.customers.create(form)
      toast.success(isEdit ? 'Customer updated.' : 'Customer created.')
      navigate('/customers')
    } catch (error) {
      toast.error(error.message || 'Unable to save customer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/customers" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
          <p className="text-sm text-slate-500">Capture borrower identity and bank details.</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-5">
        <section className="mb-5 rounded-md border border-gold-200 bg-gold-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full md:w-52">
              <div className="grid h-32 place-items-center overflow-hidden rounded-md border border-gold-200 bg-white text-sm text-slate-500">
                {form.aadharPhoto ? <img src={form.aadharPhoto} alt="Aadhaar card" className="h-full w-full object-cover" /> : <FileScan size={28} />}
              </div>
              <label className="btn-secondary mt-2 w-full">
                <Upload size={16} /> {scanning ? 'Scanning...' : 'Scan Aadhaar'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={scanning}
                  onChange={(event) => scanAadhaar(event.target.files?.[0])}
                />
              </label>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-950">Aadhaar auto-fill</h2>
              <p className="mt-1 text-sm text-slate-600">
                Upload or capture the Aadhaar card to fill name, Aadhaar number, and address. Verify details before saving.
              </p>
              {ocrText && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">View scanned text</summary>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{ocrText}</pre>
                </details>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name*</label>
            <input id="name" className="input" value={form.name} onChange={update('name')} required />
          </div>
          <div>
            <label className="label" htmlFor="mobile">Mobile*</label>
            <input id="mobile" className="input" value={form.mobile} onChange={update('mobile')} maxLength="10" required />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="address">Address</label>
            <textarea id="address" className="input min-h-24" value={form.address} onChange={update('address')} />
          </div>
          <div>
            <label className="label" htmlFor="aadhar">Aadhar Number</label>
            <input id="aadhar" className="input" value={form.aadharNumber} onChange={update('aadharNumber')} maxLength="12" />
          </div>
          <div>
            <label className="label" htmlFor="savings">Savings A/C No</label>
            <input id="savings" className="input" value={form.savingsAcNo} onChange={update('savingsAcNo')} />
          </div>
          <div>
            <label className="label" htmlFor="bank">Bank Name</label>
            <input id="bank" className="input" value={form.bankName} onChange={update('bankName')} />
          </div>
          <div>
            <label className="label" htmlFor="branch">Branch</label>
            <input id="branch" className="input" value={form.branch} onChange={update('branch')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
