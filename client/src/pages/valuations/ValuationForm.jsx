import { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, ChevronDown, Copy, Eye, Plus, Printer, Receipt, Save, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDateDMY, inr, maskAadhar, num, parseDateInputToISO } from '../../lib/format'
import { compressDataUrl } from '../../lib/imageCompress'
import { useValuationStore, REMARK_OPTIONS } from '../../store/valuationStore'
import PrintModal from '../../components/print/PrintModal'
import ImageCropModal from '../../components/ImageCropModal'

const lockedStatus = (status) => status === 'PRINTED' || status === 'LOCKED'

const LOAN_TYPES = ['', 'Gold Loan', 'Agri Gold Loan', 'Housing Loan', 'Personal Loan', 'Vehicle Loan', 'Business Loan', 'Others']

function OrnamentInput({ value, onChange, disabled, ornaments }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef(null)
  const [pos, setPos] = useState(null)

  const filtered = useMemo(() => {
    const q = (filter || value || '').toLowerCase()
    if (!q) return ornaments
    return ornaments.filter((o) => o.name.toLowerCase().includes(q))
  }, [filter, value, ornaments])

  // Position the dropdown in a fixed-position portal so it floats above the page
  // (and is never clipped by the ornaments table's horizontal scroll container).
  const computePos = () => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < 240 && r.top > spaceBelow
    // Match the field, but keep a readable min width and never overflow the screen edge.
    const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({
      left,
      width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.min(260, Math.max(140, openUp ? r.top - 8 : spaceBelow - 8)),
    })
  }

  const openMenu = () => { computePos(); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const update = () => computePos()
    // capture=true so we also react to the inner table scroll, not just window scroll
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input-c"
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setFilter(e.target.value); openMenu() }}
        onFocus={openMenu}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type ornament..."
      />
      {open && pos && filtered.length > 0 && createPortal(
        <ul
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, zIndex: 70 }}
          className="overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-xl"
        >
          {filtered.slice(0, 40).map((o) => (
            <li
              key={o.id}
              className="cursor-pointer px-3 py-2 hover:bg-gold-50 active:bg-gold-100"
              onMouseDown={(e) => { e.preventDefault(); onChange(o.name); setOpen(false) }}
            >
              {o.name}
            </li>
          ))}
        </ul>,
        document.body
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
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tab, setTab] = useState('details')
  const customerDetailCacheRef = useRef({})
  const lastItemRef = useRef(null)
  const { form, dirty, reset, hydrate, setField, setItem, addItem, removeItem, markClean, payload } = useValuationStore()
  const preferredSeries = useMemo(
    () => series.find((s) => s.formatType === 'DIGITAL_CERT') || series[0] || null,
    [series]
  )
  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(form.customerId)) || null,
    [customers, form.customerId]
  )

  const handleValuationDateInput = (value) => {
    if (value === '') {
      setField('valuationDate', '')
      return
    }
    const iso = parseDateInputToISO(value)
    if (iso) setField('valuationDate', iso)
  }

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
        const preferred = seriesRows.find((s) => s.formatType === 'DIGITAL_CERT') || seriesRows[0]
        if (preferred?.id) setField('seriesId', String(preferred.id))
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

  // Adds a new ornament row and moves focus to its description — keeps entry as fast as writing on paper.
  const addItemAndFocus = () => {
    addItem()
    requestAnimationFrame(() => {
      lastItemRef.current?.querySelector('input')?.focus()
    })
  }

  const save = async (preview = false) => {
    // On any validation error, jump to the tab that holds the offending field so the fix is one tap away.
    if (!form.customerId) { setTab('details'); return toast.error('Select a customer.') }
    if (!form.bankPresetId) { setTab('details'); return toast.error('Select a bank format.') }
    if (!String(form.branch || '').trim()) { setTab('details'); return toast.error('Branch is required.') }
    if (!Number(form.goldRate22k)) { setTab('details'); return toast.error('Enter the 22K gold rate.') }
    if (!form.items.some((item) => item.description && Number(item.netWeightGm) > 0)) {
      setTab('items'); return toast.error('Add at least one ornament item.')
    }
    if (!form.jewelleryPhoto) { setTab('finish'); return toast.error('Jewellery photo is required.') }

    const data = payload()
    if (!data.seriesId && preferredSeries?.id) {
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
    setField('branch', preset.branch || '')
    setField('branchCode', preset.branchCode || '')
    setField('empanelmentId', preset.empanelmentId || '')
    setField('rateOfInterest', preset.rateOfInterest || '')
    if (preset.loanLtv) setField('loanLtv', preset.loanLtv)
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
      <p className="label-c mb-1">{label}</p>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {form[field] ? (
          <img src={form[field]} alt={label} className="h-28 w-full object-contain p-1" />
        ) : (
          <div className="grid h-28 place-items-center text-slate-400">
            <Camera size={22} />
          </div>
        )}
      </div>
      <label className={`btn-secondary mt-1.5 w-full py-1.5 text-xs ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload size={14} /> {form[field] ? 'Replace' : 'Capture / Upload'}
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
      <p className="label-c mb-1">{label}</p>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {form[field] ? (
          <img src={form[field]} alt={label} className="h-24 w-full object-contain p-1" />
        ) : (
          <div className="grid h-24 place-items-center text-slate-400">
            <Camera size={20} />
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pb-24 sm:pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/valuations" className="btn-secondary shrink-0"><ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span></Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
              {valuation?.valuationNumber || 'New Valuation'}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">Gold valuation certificate for bank submission.</p>
          </div>
        </div>
        {disabled && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link to={`/sell-bills/new?valuation=${valuation?.id}&customer=${valuation?.customerId}`} className="btn-secondary"><Receipt size={16} /> <span className="hidden sm:inline">Create Sales Invoice</span></Link>
            <button className="btn-primary" type="button" onClick={() => setPrintOpen(true)}><Printer size={16} /> Print <span className="hidden sm:inline">Again</span></button>
          </div>
        )}
      </div>

      {/* Pinned report snapshot — lets the appraiser verify borrower + key figures at any time without scrolling. */}
      <div className="sticky top-0 z-20 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <button
          type="button"
          onClick={() => setSnapshotOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">
              {selectedCustomer?.name || 'No customer selected'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-right leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-slate-400">Market Value</span>
              <span className="block text-sm font-bold text-gold-700">{inr(form.marketValue)}</span>
            </span>
            <ChevronDown size={18} className={`text-slate-400 transition-transform ${snapshotOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {snapshotOpen && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-2 sm:grid-cols-4">
            <div className="snap-cell"><span className="snap-key">Aadhaar</span><span className="snap-val">{maskAadhar(selectedCustomer?.aadharNumber) || '-'}</span></div>
            <div className="snap-cell"><span className="snap-key">Mobile</span><span className="snap-val">{selectedCustomer?.mobile || '-'}</span></div>
            <div className="snap-cell"><span className="snap-key">A/C No</span><span className="snap-val">{form.acNo || selectedCustomer?.savingsAcNo || '-'}</span></div>
            <div className="snap-cell"><span className="snap-key">Net Wt</span><span className="snap-val">{num(totals.net, 3)} g</span></div>
            <div className="snap-cell"><span className="snap-key">Gross Wt</span><span className="snap-val">{num(totals.gross, 3)} g</span></div>
            <div className="snap-cell"><span className="snap-key">Items</span><span className="snap-val">{totals.units}</span></div>
            <div className="snap-cell"><span className="snap-key">Loan Amount</span><span className="snap-val">{inr(form.loanAmount)}</span></div>
            <div className="snap-cell"><span className="snap-key">Gold 22K/g</span><span className="snap-val">{form.goldRate22k ? inr(form.goldRate22k) : '-'}</span></div>
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

      {/* Step tabs — split the form into short, trackable screens so it never becomes one long scroll. */}
      <div className="sticky top-[46px] z-10 -mx-4 grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50/95 px-4 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:p-1">
        {[
          { key: 'details', label: 'Details' },
          { key: 'items', label: `Ornaments${form.items.length ? ` (${form.items.length})` : ''}` },
          { key: 'finish', label: 'Loan & Photos' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              tab === t.key ? 'bg-gold-500 text-ink-900 shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== DETAILS TAB ===================== */}
      {tab === 'details' && (<>
      {/* Document — who & which certificate */}
      <div className="sheet">
        <div className="sheet-strip"><span className="sheet-title">Document</span></div>
        <div className="sheet-body grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="field-c col-span-2">
            <label className="label-c">Customer <span className="text-red-500">*</span></label>
            <select className="input-c" value={form.customerId} onChange={(e) => {
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
          <div className="field-c col-span-2">
            <label className="label-c">Bank Format <span className="text-red-500">*</span></label>
            <select className="input-c" onChange={(e) => applyPreset(e.target.value)} disabled={disabled}>
              <option value="">Select bank format</option>
              {bankPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.bankName} - {preset.branch}</option>)}
            </select>
          </div>
          <div className="field-c">
            <label className="label-c">Valuation Date</label>
            <input
              type="text"
              inputMode="numeric"
              className="input-c"
              value={formatDateDMY(form.valuationDate)}
              onChange={(e) => handleValuationDateInput(e.target.value)}
              placeholder="dd-mm-yyyy"
              disabled={disabled}
            />
          </div>
          <div className="field-c col-span-2 sm:col-span-3">
            <label className="label-c">Number Series</label>
            <select className="input-c" value={form.seriesId} onChange={(e) => setField('seriesId', e.target.value)} disabled={disabled || isEdit}>
              <option value="">Choose number series</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.seriesName} ({s.nextNumber || `${s.prefix}-${String((s.currentNumber || 0) + 1).padStart(s.numberOfDigits || 4, '0')}`})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Account & Loan terms */}
      <div className="sheet">
        <div className="sheet-strip"><span className="sheet-title">Account &amp; Loan</span></div>
        <div className="sheet-body grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className="field-c">
            <label className="label-c">Branch <span className="text-red-500">*</span></label>
            <input className="input-c" value={form.branch} onChange={(e) => setField('branch', e.target.value)} disabled={disabled} />
          </div>
          <div className="field-c">
            <label className="label-c">A/C No</label>
            <input className="input-c" value={form.acNo} onChange={(e) => setField('acNo', e.target.value)} disabled={disabled} />
          </div>
          <div className="field-c">
            <label className="label-c">Application ID</label>
            <input className="input-c" placeholder="Auto from preset" value={form.applicationId} onChange={(e) => setField('applicationId', e.target.value)} disabled={disabled} />
          </div>
          <div className="field-c">
            <label className="label-c">Customer Type</label>
            <select className="input-c" value={LOAN_TYPES.includes(form.loanType) ? form.loanType : 'Others'} onChange={(e) => setField('loanType', e.target.value)} disabled={disabled}>
              {LOAN_TYPES.map((t) => <option key={t} value={t}>{t || '— Select —'}</option>)}
            </select>
            {(form.loanType === 'Others' || (!LOAN_TYPES.includes(form.loanType) && form.loanType)) && (
              <input className="input-c mt-1" placeholder="Enter customer type..." value={form.loanType === 'Others' ? '' : form.loanType} onChange={(e) => setField('loanType', e.target.value || 'Others')} disabled={disabled} />
            )}
          </div>
          <div className="field-c">
            <label className="label-c">Tenure (Months)</label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              className="input-c"
              placeholder="e.g. 12"
              value={form.tenureMonths}
              onChange={(e) => setField('tenureMonths', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Gold rates */}
      <div className="sheet">
        <div className="sheet-strip"><span className="sheet-title">Gold Rates</span></div>
        <div className="sheet-body grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className="field-c">
            <label className="label-c">Gold Rate 22K / g <span className="text-red-500">*</span></label>
            <input type="number" inputMode="decimal" className="input-c" value={form.goldRate22k} onChange={(e) => setField('goldRate22k', e.target.value)} disabled={disabled} />
          </div>
          <div className="field-c">
            <label className="label-c">Bank Gold Rate / g</label>
            <input type="number" inputMode="decimal" className="input-c" placeholder="e.g. 5800" value={form.bankGoldRatePerGram} onChange={(e) => setField('bankGoldRatePerGram', e.target.value)} disabled={disabled} />
          </div>
        </div>
      </div>

      {/* Less-used register/renewal fields — collapsed by default to keep the sheet short */}
      <div className="sheet">
        <button type="button" onClick={() => setMoreOpen((v) => !v)} className="sheet-strip w-full">
          <span className="sheet-title">More details (register, packets, renewal)</span>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>
        {moreOpen && (
          <div className="sheet-body grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="field-c">
              <label className="label-c">Branch Code</label>
              <input className="input-c" placeholder="e.g. 0859" value={form.branchCode} onChange={(e) => setField('branchCode', e.target.value)} disabled={disabled} />
            </div>
            <div className="field-c">
              <label className="label-c">Gold Loan Register No.</label>
              <input
                className="input-c"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 125"
                value={form.goldLoanRegisterNo}
                onChange={(e) => setField('goldLoanRegisterNo', e.target.value.replace(/\D/g, ''))}
                disabled={disabled}
              />
            </div>
            <div className="field-c">
              <label className="label-c">Gold Packets No.</label>
              <input
                className="input-c"
                placeholder="e.g. GP-12A"
                value={form.goldPacketsNo}
                onChange={(e) => setField('goldPacketsNo', e.target.value.toUpperCase())}
                disabled={disabled}
              />
            </div>
            <div className="field-c">
              <label className="label-c">Renewal Date</label>
              <input
                type="date"
                className="input-c"
                value={form.renewalDate || ''}
                onChange={(e) => setField('renewalDate', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Identity photos — auto-filled from customer, kept compact */}
      <div className="sheet">
        <div className="sheet-strip">
          <span className="sheet-title">Identity Photos</span>
          {customerMediaLoading && <span className="text-[11px] text-slate-400">Loading…</span>}
        </div>
        <div className="sheet-body grid grid-cols-3 gap-2.5">
          <ReadOnlyPhoto field="personPhoto" label="Borrower" />
          <ReadOnlyPhoto field="aadharPhotoDoc" label="Aadhaar" />
          <ReadOnlyPhoto field="panPhoto" label="PAN" />
        </div>
      </div>

      </>)}

      {/* ===================== ORNAMENTS TAB ===================== */}
      {tab === 'items' && (
      <div className="sheet">
        <div className="sheet-strip">
          <span className="sheet-title">Ornaments ({form.items.length})</span>
          <button type="button" className="btn-primary py-1 text-xs" onClick={addItemAndFocus} disabled={disabled}>
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Spreadsheet-style grid. The whole table (Description included) scrolls together as one
            smooth horizontal strip; rows flow down the page within this dedicated tab so sideways
            swiping never fights vertical scrolling. */}
        <div className="orn-scroll">
          <table className="orn-table text-sm">
            <thead>
              <tr>
                <th className="orn-th" style={{ width: 32, minWidth: 32 }}>#</th>
                <th className="orn-th text-left" style={{ width: 180, minWidth: 180 }}>Description</th>
                <th className="orn-th text-left" style={{ width: 140, minWidth: 140 }}>Remarks</th>
                <th className="orn-th" style={{ width: 70, minWidth: 70 }}>Units</th>
                <th className="orn-th" style={{ width: 90, minWidth: 90 }}>Gross g</th>
                <th className="orn-th" style={{ width: 90, minWidth: 90 }}>Net g</th>
                <th className="orn-th" style={{ width: 64, minWidth: 64 }}>Karat</th>
                <th className="orn-th text-right" style={{ width: 116, minWidth: 116 }}>Value</th>
                <th className="orn-th" style={{ width: 44, minWidth: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, index) => (
                <tr key={index} ref={index === form.items.length - 1 ? lastItemRef : null} className="odd:bg-white even:bg-slate-50/50">
                  <td className="orn-td text-center text-xs font-semibold text-slate-400">{index + 1}</td>
                  <td className="orn-td">
                    <OrnamentInput value={item.description} onChange={(v) => setItem(index, 'description', v)} disabled={disabled} ornaments={ornaments} />
                  </td>
                  <td className="orn-td">
                    <select className="input-c text-xs" value={item.remarks} onChange={(e) => setItem(index, 'remarks', e.target.value)} disabled={disabled}>
                      <option value="">—</option>
                      {REMARK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {item.remarks === 'Others' && (
                      <input className="input-c mt-1 text-xs" placeholder="Enter remark..." value={item.remarksCustom} onChange={(e) => setItem(index, 'remarksCustom', e.target.value)} disabled={disabled} />
                    )}
                  </td>
                  <td className="orn-td"><input type="number" inputMode="numeric" className="input-c px-1 text-center" value={item.noOfUnits} onChange={(e) => setItem(index, 'noOfUnits', e.target.value)} disabled={disabled} /></td>
                  <td className="orn-td"><input type="number" inputMode="decimal" step="0.001" className="input-c px-1 text-center" value={item.grossWeightGm} onChange={(e) => setItem(index, 'grossWeightGm', e.target.value)} disabled={disabled} /></td>
                  <td className="orn-td">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      className="input-c px-1 text-center"
                      value={item.netWeightGm}
                      onChange={(e) => setItem(index, 'netWeightGm', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && index === form.items.length - 1) { e.preventDefault(); addItemAndFocus() } }}
                      disabled={disabled}
                    />
                  </td>
                  <td className="orn-td"><input type="number" className="input-c px-1 text-center" value={item.purityCarat} onChange={(e) => setItem(index, 'purityCarat', e.target.value)} disabled={disabled} step="0.1" placeholder="22" /></td>
                  <td className="orn-td text-right font-medium tabular-nums whitespace-nowrap">{inr(item.approxValueInr)}</td>
                  <td className="orn-td text-center">
                    <button type="button" className="text-red-500 disabled:opacity-40" onClick={() => removeItem(index)} disabled={disabled || form.items.length === 1}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="orn-tf"></td>
                <td className="orn-tf text-left">Total</td>
                <td className="orn-tf"></td>
                <td className="orn-tf text-center">{totals.units}</td>
                <td className="orn-tf text-center tabular-nums">{num(totals.gross, 3)}</td>
                <td className="orn-tf text-center tabular-nums">{num(totals.net, 3)}</td>
                <td className="orn-tf"></td>
                <td className="orn-tf text-right tabular-nums whitespace-nowrap text-gold-700">{inr(totals.value)}</td>
                <td className="orn-tf"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3">
          <p className="text-[11px] text-slate-400">Tip: press Enter in a row’s “Net g” to jump to the next row. Swipe the table sideways to reach every column.</p>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={addItemAndFocus} disabled={disabled}>
            <Plus size={16} /> Add Ornament
          </button>
        </div>
      </div>
      )}

      {/* ===================== LOAN & PHOTOS TAB ===================== */}
      {tab === 'finish' && (<>

      {/* Valuation & loan figures */}
      <div className="sheet">
        <div className="sheet-strip"><span className="sheet-title">Valuation &amp; Loan</span></div>
        <div className="sheet-body space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="col-span-2 rounded-md bg-gold-50 px-3 py-2 sm:col-span-1">
              <p className="snap-key">Total Market Value</p>
              <p className="text-lg font-bold text-slate-950">{inr(form.marketValue)}</p>
            </div>
            <div className="field-c">
              <label className="label-c">Bank Loan Value</label>
              <input type="number" className="input-c" value={form.bankRecommendedValue} disabled />
            </div>
            <div className="field-c">
              <label className="label-c">LTV (%)</label>
              <input type="number" inputMode="decimal" className="input-c" value={form.loanLtv} onChange={(e) => setField('loanLtv', e.target.value)} disabled={disabled} />
            </div>
            <div className="field-c">
              <label className="label-c">Loan as per LTV</label>
              <input type="number" className="input-c" value={form.ltvLoan} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="field-c">
              <label className="label-c">Loan Amount</label>
              <input type="number" inputMode="numeric" className="input-c" value={form.loanAmount} onChange={(e) => setField('loanAmount', e.target.value)} disabled={disabled} />
              {form.suggestedLoan > 0 && (
                <button type="button" className="mt-0.5 self-start text-[11px] text-gold-700 underline" onClick={() => setField('loanAmount', form.suggestedLoan)} disabled={disabled}>
                  Use ₹{form.suggestedLoan.toLocaleString('en-IN')} (LTV {form.loanLtv}%)
                </button>
              )}
            </div>
            <div className="field-c">
              <label className="label-c">Rate of Interest (%)</label>
              <input type="number" inputMode="decimal" className="input-c" value={form.rateOfInterest} onChange={(e) => setField('rateOfInterest', e.target.value)} disabled={disabled} />
            </div>
            <div className="field-c">
              <label className="label-c">Valuation Fee</label>
              <input type="number" inputMode="numeric" className="input-c" value={form.valuationFee} onChange={(e) => setField('valuationFee', e.target.value)} disabled={disabled} />
            </div>
          </div>
        </div>
      </div>

      {/* Jewellery photos */}
      <div className="sheet">
        <div className="sheet-strip">
          <span className="sheet-title">Jewellery Photos <span className="text-red-500">*</span></span>
          <label className={`btn-secondary py-1 text-xs ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
            <Camera size={14} /> Add
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(e) => openCropper(e.target.files?.[0], 'Crop Ornament Photo', addOrnamentPhoto)} />
          </label>
        </div>
        <div className="sheet-body">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <PhotoCapture field="jewelleryPhoto" label="Main Jewellery Photo" />
            {(form.ornamentPhotos || []).map((photo, index) => (
              <div key={index}>
                <p className="label-c mb-1">Extra {index + 1}</p>
                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <img src={photo} alt={`Ornament ${index + 1}`} className="h-28 w-full object-contain p-1" />
                  {!disabled && <button type="button" className="absolute right-1 top-1 rounded bg-white/90 p-1 shadow" onClick={() => setField('ornamentPhotos', form.ornamentPhotos.filter((_, i) => i !== index))}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>)}

      {/* Sticky action bar — always reachable so there is no scroll-to-save */}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-3 sm:shadow-sm">
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
            <Trash2 size={16} /> <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete Draft'}</span>
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
        }}><Copy size={16} /> <span className="hidden sm:inline">Duplicate</span></button>}
        {!disabled && (
          <>
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => save(true)} disabled={saving}>
              <Eye size={16} /> Preview
            </button>
            <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={() => save(false)} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
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
