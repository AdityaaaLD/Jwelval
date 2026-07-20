import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, FileScan, Save, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { scanAadhaarImage } from '../../lib/aadharOcr'
import ImageCropModal from '../../components/ImageCropModal'
import { compressDataUrl } from '../../lib/imageCompress'

const emptyCustomer = {
  name: '',
  mobile: '',
  alternateMobile: '',
  address: '',
  currentAddress: '',
  currentAddressDifferent: false,
  aadharNumber: '',
  aadharPhoto: '',
  aadharPhotoBack: '',
  panPhoto: '',
  customerPhoto: '',
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
  const [scanningFront, setScanningFront] = useState(false)
  const [scanningBack, setScanningBack] = useState(false)
  const [ocrTextFront, setOcrTextFront] = useState('')
  const [ocrTextBack, setOcrTextBack] = useState('')
  const [cropSession, setCropSession] = useState(null)

  const showOcrWarnings = (parsed) => {
    const warnings = parsed?.warnings || []
    for (const warning of warnings) {
      toast.error(warning)
    }
    if (parsed?.ocrConfidence && parsed.ocrConfidence < 65) {
      toast.error('OCR confidence is low. Please verify all extracted fields carefully.')
    }
  }

  useEffect(() => {
    if (!isEdit) return
    api.customers.get(id).then((customer) => {
      setForm({
        name: customer.name || '',
        mobile: customer.mobile || '',
        alternateMobile: customer.alternateMobile || '',
        address: customer.address || '',
        currentAddress: customer.currentAddress || '',
        currentAddressDifferent: Boolean(customer.currentAddressDifferent),
        aadharNumber: customer.aadharNumber || '',
        aadharPhoto: customer.aadharPhoto || '',
        aadharPhotoBack: customer.aadharPhotoBack || '',
        panPhoto: customer.panPhoto || '',
        customerPhoto: customer.customerPhoto || '',
        savingsAcNo: customer.savingsAcNo || '',
        bankName: customer.bankName || '',
        branch: customer.branch || '',
      })
    })
  }, [id, isEdit])

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const updateCurrentAddressToggle = (event) => {
    const checked = event.target.checked
    setForm((current) => ({
      ...current,
      currentAddressDifferent: checked,
      currentAddress: checked ? current.currentAddress : '',
    }))
  }

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })

  const openCropper = async (file, title, onApply) => {
    if (!file) return
    try {
      const src = await readFileAsDataUrl(file)
      setCropSession({ src, title, onApply })
    } catch {
      toast.error('Unable to open image editor.')
    }
  }

  const handleCropApply = async (croppedDataUrl) => {
    const current = cropSession
    setCropSession(null)
    if (!current?.onApply) return
    await current.onApply(croppedDataUrl)
  }

  const scanFront = async (sourceDataUrl) => {
    const compressed = await compressDataUrl(sourceDataUrl, { maxWidth: 1400, maxHeight: 1000, quality: 0.82 })
    setForm((current) => ({ ...current, aadharPhoto: compressed }))
    setScanningFront(true)
    try {
      const parsed = await scanAadhaarImage(compressed, 'front')
      setOcrTextFront(parsed.rawText)
      showOcrWarnings(parsed)
      setForm((current) => ({
        ...current,
        name: parsed.name || current.name,
        aadharNumber: parsed.aadharValid ? (parsed.aadharNumber || current.aadharNumber) : current.aadharNumber,
        mobile: parsed.mobile || current.mobile,
      }))
      toast.success(parsed.aadharValid ? 'Front side scanned. Please verify fields.' : 'Front side scanned with warnings. Aadhaar not auto-filled.')
    } catch (error) {
      toast.error('Could not read front side details.')
    } finally {
      setScanningFront(false)
    }
  }

  const uploadPhoto = async (field, sourceDataUrl) => {
    const compressed = await compressDataUrl(sourceDataUrl, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
    setForm((current) => ({ ...current, [field]: compressed }))
  }

  const scanBack = async (sourceDataUrl) => {
    const compressed = await compressDataUrl(sourceDataUrl, { maxWidth: 1400, maxHeight: 1000, quality: 0.82 })
    setForm((current) => ({ ...current, aadharPhotoBack: compressed }))
    setScanningBack(true)
    try {
      const parsed = await scanAadhaarImage(compressed, 'back')
      setOcrTextBack(parsed.rawText)
      showOcrWarnings(parsed)
      setForm((current) => ({
        ...current,
        address: parsed.address || current.address,
        currentAddressDifferent: false,
        currentAddress: '',
      }))
      toast.success('Back side scanned. Please verify address.')
    } catch (error) {
      toast.error('Could not read back side details.')
    } finally {
      setScanningBack(false)
    }
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
          <div className="mb-3">
            <h2 className="font-semibold text-slate-950">Aadhaar Auto-fill</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload front side for name, Aadhaar number & mobile. Upload back side for address. Verify all details before saving.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Front Side</p>
              <div className="grid h-44 place-items-center overflow-hidden rounded-md border border-gold-200 bg-white text-sm text-slate-500">
                {form.aadharPhoto ? <img src={form.aadharPhoto} alt="Aadhaar front" className="h-full w-full object-contain p-1" /> : <FileScan size={28} />}
              </div>
              <label className="btn-secondary mt-2 w-full">
                <Upload size={16} /> {scanningFront ? 'Scanning...' : 'Scan Front'}
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanningFront} onChange={(e) => openCropper(e.target.files?.[0], 'Crop Aadhaar Front', scanFront)} />
              </label>
              {ocrTextFront && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">View front OCR</summary>
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{ocrTextFront}</pre>
                </details>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Back Side</p>
              <div className="grid h-44 place-items-center overflow-hidden rounded-md border border-gold-200 bg-white text-sm text-slate-500">
                {form.aadharPhotoBack ? <img src={form.aadharPhotoBack} alt="Aadhaar back" className="h-full w-full object-contain p-1" /> : <FileScan size={28} />}
              </div>
              <label className="btn-secondary mt-2 w-full">
                <Upload size={16} /> {scanningBack ? 'Scanning...' : 'Scan Back'}
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanningBack} onChange={(e) => openCropper(e.target.files?.[0], 'Crop Aadhaar Back', scanBack)} />
              </label>
              {ocrTextBack && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">View back OCR</summary>
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{ocrTextBack}</pre>
                </details>
              )}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3">
            <h2 className="font-semibold text-slate-950">Additional Identity Photos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Capture customer and PAN photos once here. These are auto-used in valuation forms when this customer is selected.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Customer Photo</p>
              <div className="grid h-44 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white text-sm text-slate-500">
                {form.customerPhoto ? <img src={form.customerPhoto} alt="Customer" className="h-full w-full object-contain p-1" /> : <FileScan size={28} />}
              </div>
              <label className="btn-secondary mt-2 w-full">
                <Upload size={16} /> Capture / Upload
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => openCropper(e.target.files?.[0], 'Crop Customer Photo', (dataUrl) => uploadPhoto('customerPhoto', dataUrl))} />
              </label>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">PAN Card Photo</p>
              <div className="grid h-44 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white text-sm text-slate-500">
                {form.panPhoto ? <img src={form.panPhoto} alt="PAN" className="h-full w-full object-contain p-1" /> : <FileScan size={28} />}
              </div>
              <label className="btn-secondary mt-2 w-full">
                <Upload size={16} /> Capture / Upload
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => openCropper(e.target.files?.[0], 'Crop PAN Photo', (dataUrl) => uploadPhoto('panPhoto', dataUrl))} />
              </label>
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
          <div>
            <label className="label" htmlFor="altMobile">Alternate Mobile</label>
            <input id="altMobile" className="input" value={form.alternateMobile} onChange={update('alternateMobile')} maxLength="10" />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="address">Address</label>
            <textarea id="address" className="input min-h-24" value={form.address} onChange={update('address')} />
          </div>
          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="currentAddressDifferent">
              <input
                id="currentAddressDifferent"
                type="checkbox"
                checked={form.currentAddressDifferent}
                onChange={updateCurrentAddressToggle}
              />
              Current address is different from Aadhaar address
            </label>
          </div>
          {form.currentAddressDifferent && (
            <div className="md:col-span-2">
              <label className="label" htmlFor="currentAddress">Current Address</label>
              <textarea id="currentAddress" className="input min-h-24" value={form.currentAddress} onChange={update('currentAddress')} />
            </div>
          )}
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

      <ImageCropModal
        open={Boolean(cropSession)}
        title={cropSession?.title || 'Adjust Image'}
        src={cropSession?.src || ''}
        onCancel={() => setCropSession(null)}
        onApply={handleCropApply}
      />
    </div>
  )
}
