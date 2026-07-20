import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Copy, Eye, Plus, Printer, Receipt, Save, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, num } from '../../lib/format'
import { compressDataUrl } from '../../lib/imageCompress'
import { useValuationStore, REMARK_OPTIONS } from '../../store/valuationStore'
import PrintModal from '../../components/print/PrintModal'
import ImageCropModal from '../../components/ImageCropModal'

const lockedStatus = (status) => status === 'PRINTED' || status === 'LOCKED'

const LOAN_TYPES = ['', 'Gold Loan', 'Agri Gold Loan', 'Housing Loan', 'Personal Loan', 'Vehicle Loan', 'Business Loan', 'Others']

function OrnamentInput({ value, onChange, disabled, ornaments }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef(null)

  const filtered = useMemo(() => {
    const q = (filter || value || '').toLowerCase()
    if (!q) return ornaments
    return ornaments.filter((o) => o.name.toLowerCase().includes(q))
  }, [filter, value, ornaments])

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setFilter(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type ornament..."
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-40 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
          {filtered.slice(0, 12).map((o) => (
            <li key={o.id} className="cursor-pointer px-3 py-1.5 hover:bg-slate-100" onMouseDown={() => { onChange(o.name); setOpen(false) }}>
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ValuationForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [customers, setCustomers] = useState([])
  const [series, setSeries] = useState([])
  const [bankPresets, setBankPresets] = useState([])
  const [ornaments, setOrnaments] = useState([])
  const [valuation, setValuation] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [customerMediaLoading, setCustomerMediaLoading] = useState(false)
  const [cropSession, setCropSession] = useState(null)
  const customerDetailCacheRef = useRef({})
  const { form, dirty, reset, hydrate, setField, setItem, addItem, removeItem, markClean, payload } = useValuationStore()

  const syncCustomerIdentityPhotos = async (customerId) => {
    if (!customerId) {
      setField('personPhoto', '')
      setField('aadharPhotoDoc', '')
      setField('panPhoto', '')
      return
    }

    try {
      setCustomerMediaLoading(true)
      let customer = customerDetailCacheRef.current[customerId]
      if (!customer) {
        customer = await api.customers.get(customerId)
        customerDetailCacheRef.current[customerId] = customer
      }

      setField('personPhoto', customer.customerPhoto || '')
      setField('aadharPhotoDoc', customer.aadharPhoto || '')
      setField('panPhoto', customer.panPhoto || '')
      setField('acNo', customer.savingsAcNo || '')
    } catch {
      toast.error('Unable to load customer photos.')
    } finally {
      setCustomerMediaLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([api.customers.list(), api.series.list(), api.presets.banks(), api.rates.get(), api.ornaments.list()]).then(([customerRows, seriesRows, presetRows, rate, ornRows]) => {
      setCustomers(customerRows)
      setSeries(seriesRows)
      setBankPresets(presetRows)
      setOrnaments(ornRows)
      if (!isEdit) {
        reset()
        const customerId = searchParams.get('customer_id')
        if (customerId) {
          setField('customerId', customerId)
          syncCustomerIdentityPhotos(customerId)
        }
        if (rate.goldRate22k) {
          setField('goldRate22k', rate.goldRate22k)
        }
        if (seriesRows.length) {
          const preferredSeries = seriesRows.find((s) => s.formatType === 'DIGITAL_CERT') || seriesRows[0]
          setField('seriesId', String(preferredSeries.id))
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

  const disabled = lockedStatus(valuation?.status)
  const totals = useMemo(() => form.items.reduce((acc, item) => ({
    units: acc.units + (Number(item.noOfUnits) || 0),
    gross: acc.gross + (Number(item.grossWeightGm) || 0),
    net: acc.net + (Number(item.netWeightGm) || 0),
    value: acc.value + (Number(item.approxValueInr) || 0),
  }), { units: 0, gross: 0, net: 0, value: 0 }), [form.items])

  const save = async (preview = false) => {
    if (!form.customerId) return toast.error('Select a customer.')
    if (!Number(form.goldRate22k)) return toast.error('Enter the 22K gold rate.')
    if (!form.items.some((item) => item.description && Number(item.netWeightGm) > 0)) {
      return toast.error('Add at least one ornament item.')
    }

    const data = payload()
    if (!data.seriesId && series.length) {
      const preferredSeries = series.find((s) => s.formatType === 'DIGITAL_CERT') || series[0]
      data.seriesId = Number(preferredSeries.id)
    }
    if (!data.seriesId) {
      return toast.error('No number series found. Please create one in Settings > Number Series.')
    }

    setSaving(true)
    try {
      const saved = isEdit
        ? await api.valuations.update(id, data)
        : await api.valuations.create(data)
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

  const loadPhoto = async (field, sourceDataUrl) => {
    const compressed = await compressDataUrl(sourceDataUrl, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
    setField(field, compressed)
  }

  const addOrnamentPhoto = async (sourceDataUrl) => {
    const compressed = await compressDataUrl(sourceDataUrl, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 })
    setField('ornamentPhotos', [...(form.ornamentPhotos || []), compressed])
  }

  const applyPreset = async (presetId) => {
    const preset = bankPresets.find((p) => String(p.id) === String(presetId))
    if (!preset) return
    if (preset.valuationSeriesId) {
      setField('seriesId', String(preset.valuationSeriesId))
    }
    setField('branch', preset.branch || '')
    setField('branchCode', preset.branchCode || '')
    setField('empanelmentId', preset.empanelmentId || '')
    setField('rateOfInterest', preset.rateOfInterest || '')
    if (preset.loanLtv) setField('loanLtv', preset.loanLtv)
    if (preset.loanLtv) setField('bankLtv', preset.loanLtv)
    setField('bankPresetId', preset.id)
    if (preset.certificateRules) setField('certificateRules', preset.certificateRules)
    // Preview application ID (does NOT consume the number yet — that happens on save)
    if (preset.appIdPrefix && !isEdit) {
      try {
        const { applicationId } = await api.presets.previewAppId(preset.id)
        setField('applicationId', applicationId)
      } catch {}
    }
    toast.success('Bank preset applied.')
  }

  const PhotoCapture = ({ field, label }) => (
    <div>
      <p className="label">{label}</p>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {form[field] ? (
          <img src={form[field]} alt={label} className="h-44 w-full object-contain p-1" />
        ) : (
          <div className="grid h-44 place-items-center text-sm text-slate-400">
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
          onChange={(e) => openCropper(e.target.files?.[0], `Crop ${label}`, (dataUrl) => loadPhoto(field, dataUrl))}
        />
      </label>
    </div>
  )

  const ReadOnlyPhoto = ({ field, label }) => (
    <div>
      <p className="label">{label}</p>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {form[field] ? (
          <img src={form[field]} alt={label} className="h-44 w-full object-contain p-1" />
        ) : (
          <div className="grid h-44 place-items-center text-sm text-slate-400">
            <Camera size={24} />
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">Auto-filled from selected customer profile.</p>
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
        {disabled && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/sell-bills/new?valuation=${valuation?.id}&customer=${valuation?.customerId}`} className="btn-secondary"><Receipt size={16} /> Create Sales Invoice</Link>
            <button className="btn-primary" type="button" onClick={() => setPrintOpen(true)}><Printer size={16} /> Print Again</button>
          </div>
        )}
      </div>

      {disabled && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Locked: Printed on {valuation.printedAt || 'record'}. This document cannot be edited.
        </div>
      )}

      {!isEdit && series.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Number series is missing for this account. Create one in <Link className="font-semibold underline" to="/settings/series">Settings &gt; Number Series</Link>.
        </div>
      )}

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="label">Select Customer</label>
            <select className="input" value={form.customerId} onChange={(e) => {
              const cId = e.target.value
              setField('customerId', cId)
              syncCustomerIdentityPhotos(cId)
            }} disabled={disabled || isEdit}>
              <option value="">Choose customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerCode} - {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valuation Date</label>
            <input type="date" className="input" value={form.valuationDate} onChange={(e) => setField('valuationDate', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Number Series</label>
            <select className="input" value={form.seriesId} onChange={(e) => setField('seriesId', e.target.value)} disabled={disabled || isEdit}>
              <option value="">Choose number series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.seriesName} ({s.nextNumber || `${s.prefix}-${String((s.currentNumber || 0) + 1).padStart(s.numberOfDigits || 4, '0')}`})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Controls the generated valuation number.</p>
          </div>
          <div>
            <label className="label">Bank Format</label>
            <select className="input" value={form.bankPresetId || ''} onChange={(e) => applyPreset(e.target.value)} disabled={disabled}>
              <option value="">Select bank format</option>
              {bankPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.bankName} - {preset.branch}</option>)}
            </select>
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
            <label className="label">A/C No</label>
            <input className="input" value={form.acNo} onChange={(e) => setField('acNo', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Application ID</label>
            <input className="input" placeholder="Auto from bank preset" value={form.applicationId} onChange={(e) => setField('applicationId', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Gold Rate 22K (per gram)</label>
            <input type="number" className="input" value={form.goldRate22k} onChange={(e) => setField('goldRate22k', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Customer Type</label>
            <select className="input" value={LOAN_TYPES.includes(form.loanType) ? form.loanType : 'Others'} onChange={(e) => setField('loanType', e.target.value)} disabled={disabled}>
              {LOAN_TYPES.map((t) => <option key={t} value={t}>{t || '— Select —'}</option>)}
            </select>
            {(form.loanType === 'Others' || (!LOAN_TYPES.includes(form.loanType) && form.loanType)) && (
              <input className="input mt-1" placeholder="Enter customer type..." value={form.loanType === 'Others' ? '' : form.loanType} onChange={(e) => setField('loanType', e.target.value || 'Others')} disabled={disabled} />
            )}
          </div>
          <div>
            <label className="label">Loan % (LTV)</label>
            <input type="number" className="input" placeholder="e.g. 70" value={form.loanLtv} onChange={(e) => setField('loanLtv', e.target.value)} disabled={disabled} />
            <p className="mt-1 text-xs text-slate-500">% of market value offered as loan</p>
          </div>
          <div>
            <label className="label">Bank Gold Rate (per gram)</label>
            <input type="number" className="input" placeholder="e.g. 5800" value={form.bankGoldRatePerGram} onChange={(e) => setField('bankGoldRatePerGram', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Bank LTV (%)</label>
            <input type="number" className="input" placeholder="e.g. 75" value={form.bankLtv} onChange={(e) => setField('bankLtv', e.target.value)} disabled={disabled} />
            <p className="mt-1 text-xs text-slate-500">Used only for bank recommended value</p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-950">Identity Photos</h2>
          <p className="text-sm text-slate-500">These photos are fetched from customer profile and used in certificate print layouts.</p>
          {customerMediaLoading && <p className="mt-1 text-xs text-slate-500">Loading customer photos...</p>}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ReadOnlyPhoto field="personPhoto" label="Borrower Photo" />
          <ReadOnlyPhoto field="aadharPhotoDoc" label="Aadhar Card" />
          <ReadOnlyPhoto field="panPhoto" label="PAN Card" />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Ornaments</h2>
          <button type="button" className="btn-secondary" onClick={addItem} disabled={disabled}>
            <Plus size={16} /> Add Row
          </button>
        </div>

        {/* Mobile card layout */}
        <div className="md:hidden divide-y divide-slate-200">
          {form.items.map((item, index) => (
            <div key={index} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
                <button type="button" className="btn-ghost text-red-500" onClick={() => removeItem(index)} disabled={disabled || form.items.length === 1}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-500">Description</label>
                <OrnamentInput value={item.description} onChange={(v) => setItem(index, 'description', v)} disabled={disabled} ornaments={ornaments} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Remarks</label>
                <select className="input text-xs" value={item.remarks} onChange={(e) => setItem(index, 'remarks', e.target.value)} disabled={disabled}>
                  <option value="">— Select —</option>
                  {REMARK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {item.remarks === 'Others' && (
                  <input className="input mt-1 text-xs" placeholder="Enter remark..." value={item.remarksCustom} onChange={(e) => setItem(index, 'remarksCustom', e.target.value)} disabled={disabled} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Units</label>
                  <input type="number" className="input" value={item.noOfUnits} onChange={(e) => setItem(index, 'noOfUnits', e.target.value)} disabled={disabled} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Karat</label>
                  <input type="number" className="input" value={item.purityCarat} onChange={(e) => setItem(index, 'purityCarat', e.target.value)} disabled={disabled} step="0.1" placeholder="22" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Gross Wt (gm)</label>
                  <input type="number" step="0.001" className="input" value={item.grossWeightGm} onChange={(e) => setItem(index, 'grossWeightGm', e.target.value)} disabled={disabled} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Net Wt (gm)</label>
                  <input type="number" step="0.001" className="input" value={item.netWeightGm} onChange={(e) => setItem(index, 'netWeightGm', e.target.value)} disabled={disabled} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gold-50 px-3 py-2">
                <span className="text-xs text-slate-500">Approx Value</span>
                <span className="font-semibold text-slate-900">{inr(item.approxValueInr)}</span>
              </div>
            </div>
          ))}
          <div className="bg-slate-50 px-4 py-3 grid grid-cols-2 gap-2 text-xs font-semibold">
            <span>Units: {totals.units}</span>
            <span>Gross: {num(totals.gross, 3)}g</span>
            <span>Net: {num(totals.net, 3)}g</span>
            <span>Total: {inr(totals.value)}</span>
          </div>
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-[700px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr className="text-[9px] text-slate-400 normal-case tracking-normal">
                <th className="px-3 pt-2 pb-0"></th>
                <th className="px-3 pt-2 pb-0">Description of jewels / Ornaments</th>
                <th className="px-3 pt-2 pb-0"></th>
                <th className="px-3 pt-2 pb-0">No. of jewels</th>
                <th className="px-3 pt-2 pb-0">Gross weight incl. wax, stones etc.</th>
                <th className="px-3 pt-2 pb-0">Equiv. weight of carat jewellery</th>
                <th className="px-3 pt-2 pb-0">Purity</th>
                <th className="px-3 pt-2 pb-0 text-right">Approx Value (BJA 22K rate)</th>
                <th className="px-3 pt-2 pb-0"></th>
              </tr>
              <tr>
                <th className="px-3 py-2" style={{ width: 48 }}>Sr</th>
                <th className="px-3 py-2" style={{ minWidth: 180 }}>Description</th>
                <th className="px-3 py-2" style={{ minWidth: 140 }}>Remarks</th>
                <th className="px-3 py-2" style={{ width: 80 }}>Units</th>
                <th className="px-3 py-2" style={{ width: 110 }}>Gross Wt (gm)</th>
                <th className="px-3 py-2" style={{ width: 110 }}>Net Wt (gm)</th>
                <th className="px-3 py-2" style={{ width: 80 }}>Karat</th>
                <th className="px-3 py-2 text-right" style={{ width: 130 }}>Approx Value</th>
                <th className="px-3 py-2" style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    <OrnamentInput value={item.description} onChange={(v) => setItem(index, 'description', v)} disabled={disabled} ornaments={ornaments} />
                  </td>
                  <td className="px-3 py-2">
                    <select className="input text-xs" value={item.remarks} onChange={(e) => setItem(index, 'remarks', e.target.value)} disabled={disabled}>
                      <option value="">— Select —</option>
                      {REMARK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {item.remarks === 'Others' && (
                      <input className="input mt-1 text-xs" placeholder="Enter remark..." value={item.remarksCustom} onChange={(e) => setItem(index, 'remarksCustom', e.target.value)} disabled={disabled} />
                    )}
                  </td>
                  <td className="px-3 py-2"><input type="number" className="input" value={item.noOfUnits} onChange={(e) => setItem(index, 'noOfUnits', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input type="number" step="0.001" className="input" value={item.grossWeightGm} onChange={(e) => setItem(index, 'grossWeightGm', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2"><input type="number" step="0.001" className="input" value={item.netWeightGm} onChange={(e) => setItem(index, 'netWeightGm', e.target.value)} disabled={disabled} /></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="input text-center"
                      value={item.purityCarat}
                      onChange={(e) => setItem(index, 'purityCarat', e.target.value)}
                      disabled={disabled}
                      step="0.1"
                      placeholder="22"
                    />
                  </td>
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
                <td className="px-3 py-3" colSpan="3">Total</td>
                <td className="px-3 py-3">{totals.units}</td>
                <td className="px-3 py-3">{num(totals.gross, 3)}</td>
                <td className="px-3 py-3">{num(totals.net, 3)}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right">{inr(totals.value)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <p className="label">Total Market Value</p>
            <p className="rounded-md bg-gold-50 px-3 py-2 text-xl font-semibold text-slate-950">{inr(form.marketValue)}</p>
          </div>
          <div>
            <label className="label">Bank Recommended Value</label>
            <input type="number" className="input" value={form.bankRecommendedValue} disabled />
            <p className="mt-1 text-xs text-slate-500">Auto-calculated from Bank Gold Rate and Bank LTV</p>
          </div>
          <div>
            <label className="label">Recommended Loan Amount</label>
            <input type="number" className="input" value={form.loanAmount} onChange={(e) => setField('loanAmount', e.target.value)} disabled={disabled} />
            {form.suggestedLoan > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Suggested: <button type="button" className="text-gold-700 underline" onClick={() => setField('loanAmount', form.suggestedLoan)} disabled={disabled}>₹{form.suggestedLoan.toLocaleString('en-IN')}</button> (LTV {form.loanLtv}%)
              </p>
            )}
          </div>
          <div>
            <label className="label">Rate of Interest (%)</label>
            <input type="number" className="input" value={form.rateOfInterest} onChange={(e) => setField('rateOfInterest', e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label className="label">Valuation Fee</label>
            <input type="number" className="input" value={form.valuationFee} onChange={(e) => setField('valuationFee', e.target.value)} disabled={disabled} />
            <p className="mt-1 text-xs text-slate-500">Fee charged by appraiser.</p>
          </div>
        </div>
      </section>



      <section className="card p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-950">Jewellery Photos</h2>
          <p className="text-sm text-slate-500">Capture jewellery images for valuation records.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PhotoCapture field="jewelleryPhoto" label="Jewellery Photo" />
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">Additional Ornament Photos</p>
            <label className={`btn-secondary ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
              <Camera size={16} /> Add Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(e) => openCropper(e.target.files?.[0], 'Crop Ornament Photo', addOrnamentPhoto)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
            {(form.ornamentPhotos || []).map((photo, index) => (
              <div key={index} className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <img src={photo} alt={`Ornament ${index + 1}`} className="h-24 w-full object-contain p-1" />
                {!disabled && <button type="button" className="absolute right-1 top-1 rounded bg-white/90 p-1" onClick={() => setField('ornamentPhotos', form.ornamentPhotos.filter((_, i) => i !== index))}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col justify-end gap-2 sm:flex-row">
        {valuation?.status === 'DRAFT' && (
          <button
            type="button"
            className="btn-secondary text-red-600"
            disabled={deleting}
            onClick={async () => {
              if (!window.confirm('Delete this draft valuation permanently?')) return
              setDeleting(true)
              try {
                await api.valuations.remove(valuation.id)
                toast.success('Draft valuation deleted.')
                navigate('/valuations')
              } catch (err) {
                toast.error(err.message || 'Failed to delete draft.')
              } finally {
                setDeleting(false)
              }
            }}
          >
            <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete Draft'}
          </button>
        )}
        {valuation && <button type="button" className="btn-secondary" onClick={async () => {
          try {
            const copy = await api.valuations.duplicate(valuation.id)
            toast.success('Valuation duplicated. You can now edit the copy.')
            navigate(`/valuations/${copy.id}`)
          } catch (err) {
            toast.error(err.message || 'Failed to duplicate.')
          }
        }}><Copy size={16} /> Duplicate</button>}
        {!disabled && (
          <>
            <button type="button" className="btn-secondary" onClick={() => save(true)} disabled={saving}>
              <Eye size={16} /> Save & Preview Print
            </button>
            <button type="button" className="btn-primary" onClick={() => save(false)} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save as Draft'}
            </button>
          </>
        )}
      </div>


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
