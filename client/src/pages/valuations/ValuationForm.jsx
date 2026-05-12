import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Copy, Eye, Plus, Printer, Save, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, num } from '../../lib/format'
import { useValuationStore } from '../../store/valuationStore'
import PrintModal from '../../components/print/PrintModal'
import PaymentSection from '../payments/PaymentSection'

const lockedStatus = (status) => status === 'PRINTED' || status === 'LOCKED'

export default function ValuationForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [customers, setCustomers] = useState([])
  const [series, setSeries] = useState([])
  const [bankPresets, setBankPresets] = useState([])
  const [valuation, setValuation] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { form, dirty, reset, hydrate, setField, setItem, addItem, removeItem, markClean, payload } = useValuationStore()

  useEffect(() => {
    Promise.all([api.customers.list(), api.series.list(), api.presets.banks(), api.rates.get()]).then(([customerRows, seriesRows, presetRows, rate]) => {
      setCustomers(customerRows)
      setSeries(seriesRows)
      setBankPresets(presetRows)
      if (!isEdit) {
        reset()
        const customerId = searchParams.get('customer_id')
        if (customerId) setField('customerId', customerId)
        if (rate.goldRate22k) {
          setField('goldRate22k', rate.goldRate22k)
          setField('goldRate24k', rate.goldRate24k)
        }
      }
    })
  }, [isEdit, reset, searchParams, setField])

  useEffect(() => {
    if (!isEdit) return
    api.valuations.get(id).then((row) => {
      setValuation(row)
      hydrate(row)
    })
  }, [hydrate, id, isEdit])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirty) return
      if (!isEdit) {
        localStorage.setItem('jewelval:new-valuation-draft', JSON.stringify(form))
        return
      }
      if (valuation?.status === 'DRAFT') {
        api.valuations.update(id, payload()).then(() => markClean()).catch(() => {})
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [dirty, form, id, isEdit, markClean, payload, valuation?.status])

  const selectedSeries = useMemo(
    () => series.find((item) => String(item.id) === String(form.seriesId)),
    [form.seriesId, series]
  )
  const disabled = lockedStatus(valuation?.status)
  const totals = useMemo(() => form.items.reduce((acc, item) => ({
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    gold24: acc.gold24 + (Number(item.net24kGoldGm) || 0),
    gold22: acc.gold22 + (Number(item.net22kGoldGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { gross: 0, net: 0, gold24: 0, gold22: 0, value: 0 }), [form.items])

  const save = async (preview = false) => {
    if (!form.customerId) return toast.error('Select a customer.')
    if (!form.seriesId) return toast.error('Select a number series.')
    if (!Number(form.goldRate22k)) return toast.error('Enter the 22K gold rate.')
    if (!form.items.some((item) => item.description && Number(item.netWeightGm) > 0)) {
      return toast.error('Add at least one ornament item.')
    }

    setSaving(true)
    try {
      const saved = isEdit
        ? await api.valuations.update(id, payload())
        : await api.valuations.create(payload())
      markClean()
      toast.success(preview ? 'Draft saved. Print preview is next.' : 'Draft saved.')
      setValuation(saved)
      hydrate(saved)
      if (preview) setPrintOpen(true)
      if (!isEdit) navigate(`/valuations/${saved.id}`)
    } catch (error) {
      toast.error(error.message || 'Unable to save valuation.')
    } finally {
      setSaving(false)
    }
  }

  const loadPhoto = (field, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setField(field, reader.result)
    reader.readAsDataURL(file)
  }

  const addOrnamentPhoto = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setField('ornamentPhotos', [...(form.ornamentPhotos || []), reader.result])
    reader.readAsDataURL(file)
  }

  const applyPreset = (presetId) => {
    const preset = bankPresets.find((p) => String(p.id) === String(presetId))
    if (!preset) return
    setField('branch', preset.branch || '')
    setField('rateOfInterest', preset.rateOfInterest || '')
    toast.success('Bank preset applied.')
  }

  const PhotoCapture = ({ field, label }) => (
    <div>
      <p className="label">{label}</p>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {form[field] ? (
          <img src={form[field]} alt={label} className="h-40 w-full object-cover" />
        ) : (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            <Camera size={24} />
          </div>
        )}
      </div>
      <label className={`btn-secondary mt-2 w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload size={16} /> Capture / Upload
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => loadPhoto(field, e.target.files?.[0])}
        />
      </label>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/valuations" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              {valuation?.valuationNumber || 'New Valuation'}
            </h1>
        <p className="text-sm text-slate-500">Gold valuation certificate for bank submission.</p>
          </div>
        </div>
        {disabled && <button className="btn-primary" type="button" onClick={() => setPrintOpen(true)}><Printer size={16} /> Print Again</button>}
      </div>

      {disabled && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Locked: Printed on {valuation.printedAt || 'record'}. This document cannot be edited.
        </div>
      )}

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="label">Select Customer</label>
            <select className="input" value={form.customerId} onChange={(e) => setField('customerId', e.target.value)} disabled={disabled || isEdit}>
              <option value="">Choose customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerCode} - {customer.name} - {customer.mobile || 'No mobile'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Number Series</label>
            <select className="input" value={form.seriesId} onChange={(e) => setField('seriesId', e.target.value)} disabled={disabled || isEdit}>
              <option value="">Choose series</option>
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.seriesName} - {item.formatType}
                </option>
              ))}
            </select>
            {selectedSeries?.nextNumber && (
              <p className="mt-1 text-xs text-slate-500">Next: {selectedSeries.nextNumber}</p>
            )}
          </div>
          <div>
            <label className="label">Valuation Date</label>
            <input type="date" className="input" value={form.valuationDate} onChange={(e) => setField('valuationDate', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Branch</label>
            <input className="input" value={form.branch} onChange={(e) => setField('branch', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Branch Code</label>
            <input className="input" placeholder="e.g. 0859" value={form.branchCode} onChange={(e) => setField('branchCode', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Bank/Branch Preset</label>
            <select className="input" onChange={(e) => applyPreset(e.target.value)} disabled={disabled}>
              <option value="">Apply preset</option>
              {bankPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.bankName} - {preset.branch}</option>)}
            </select>
          </div>
          <div>
            <label className="label">A/C No</label>
            <input className="input" value={form.acNo} onChange={(e) => setField('acNo', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Application ID</label>
            <input className="input" placeholder="e.g. BOMGL0000097726" value={form.applicationId} onChange={(e) => setField('applicationId', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Gold Rate 22K Today</label>
            <input type="number" className="input" value={form.goldRate22k} onChange={(e) => setField('goldRate22k', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Gold Rate 24K Today</label>
            <input type="number" className="input" value={form.goldRate24k} onChange={(e) => setField('goldRate24k', e.target.value)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-950">Photos</h2>
          <p className="text-sm text-slate-500">Capture borrower and jewellery photos directly from the device camera.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PhotoCapture field="personPhoto" label="Borrower Photo" />
          <PhotoCapture field="jewelleryPhoto" label="Jewellery Photo" />
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">Additional Ornament Photos</p>
            <label className={`btn-secondary ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
              <Camera size={16} /> Add Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(e) => addOrnamentPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
            {(form.ornamentPhotos || []).map((photo, index) => (
              <div key={index} className="relative overflow-hidden rounded-md border border-slate-200">
                <img src={photo} alt={`Ornament ${index + 1}`} className="h-24 w-full object-cover" />
                {!disabled && <button type="button" className="absolute right-1 top-1 rounded bg-white/90 p-1" onClick={() => setField('ornamentPhotos', form.ornamentPhotos.filter((_, i) => i !== index))}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Ornaments</h2>
          <button type="button" className="btn-secondary" onClick={addItem} disabled={disabled}>
            <Plus size={16} /> Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Sr</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Digital ID</th>
                <th className="px-3 py-3">Units</th>
                <th className="px-3 py-3">Purity %</th>
                <th className="px-3 py-3">Carat</th>
                <th className="px-3 py-3">Gross Wt</th>
                <th className="px-3 py-3">Net Wt</th>
                <th className="px-3 py-3">Net 24K</th>
                <th className="px-3 py-3">Net 22K</th>
                <th className="px-3 py-3 text-right">Approx Value</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2"><input className="input" value={item.description} onChange={(e) => setItem(index, 'description', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input className="input" placeholder="BOM..." value={item.digitalId} onChange={(e) => setItem(index, 'digitalId', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input type="number" className="input" value={item.noOfUnits} onChange={(e) => setItem(index, 'noOfUnits', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input type="number" className="input" value={item.purityPercent} onChange={(e) => setItem(index, 'purityPercent', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2 font-medium">{num(item.purityCarat, 2)}</td>
                  <td className="px-3 py-2"><input type="number" className="input" value={item.grossWeightGm} onChange={(e) => setItem(index, 'grossWeightGm', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input type="number" className="input" value={item.netWeightGm} onChange={(e) => setItem(index, 'netWeightGm', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2">{num(item.net24kGoldGm, 3)}</td>
                  <td className="px-3 py-2">{num(item.net22kGoldGm, 3)}</td>
                  <td className="px-3 py-2 text-right font-medium">{inr(item.approxValueInr)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="btn-ghost" onClick={() => removeItem(index)} disabled={disabled || form.items.length === 1}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm font-semibold">
              <tr>
                <td className="px-3 py-3" colSpan="5">Total</td>
                <td className="px-3 py-3">{num(totals.gross, 3)}</td>
                <td className="px-3 py-3">{num(totals.net, 3)}</td>
                <td className="px-3 py-3">{num(totals.gold24, 3)}</td>
                <td className="px-3 py-3">{num(totals.gold22, 3)}</td>
                <td className="px-3 py-3 text-right">{inr(totals.value)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="label">Total Market Value</p>
            <p className="rounded-md bg-gold-50 px-3 py-2 text-xl font-semibold text-slate-950">{inr(form.marketValue)}</p>
          </div>
          <div>
            <label className="label">Recommended Loan Amount</label>
            <input type="number" className="input" value={form.loanAmount} onChange={(e) => setField('loanAmount', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Rate of Interest</label>
            <input type="number" className="input" value={form.rateOfInterest} onChange={(e) => setField('rateOfInterest', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Valuation Fee</label>
            <input type="number" className="input" value={form.valuationFee} onChange={(e) => setField('valuationFee', e.target.value)} disabled={disabled} />
            <p className="mt-1 text-xs text-slate-500">Fee charged by appraiser.</p>
          </div>
        </div>
      </section>

      {!disabled && (
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          {valuation && <button type="button" className="btn-secondary" onClick={async () => {
            const copy = await api.valuations.duplicate(valuation.id)
            toast.success('Valuation duplicated.')
            navigate(`/valuations/${copy.id}`)
          }}><Copy size={16} /> Duplicate</button>}
          <button type="button" className="btn-secondary" onClick={() => save(true)} disabled={saving}>
            <Eye size={16} /> Save & Preview Print
          </button>
          <button type="button" className="btn-primary" onClick={() => save(false)} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      )}

      {valuation && <PaymentSection valuation={valuation} />}

      {printOpen && valuation && (
        <PrintModal
          valuation={valuation}
          onClose={() => setPrintOpen(false)}
          onLocked={(locked) => {
            setValuation(locked)
            hydrate(locked)
          }}
        />
      )}
    </div>
  )
}
