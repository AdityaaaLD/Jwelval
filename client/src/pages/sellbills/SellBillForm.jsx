import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Printer, Save, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { inr } from '../../lib/format'
import SellBillPrint from '../../components/print/SellBillPrint'

const blankItem = () => ({ particular: '', amount: '' })

export default function SellBillForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isView = Boolean(id)
  const [customers, setCustomers] = useState([])
  const [billSeries, setBillSeries] = useState([])
  const [bill, setBill] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    billSeriesId: '',
    customerId: '',
    valuationId: '',
    billDate: new Date().toISOString().slice(0, 10),
    withGst: true,
    advance: 0,
    paymentMode: 'Cash',
    items: [blankItem()],
  })

  useEffect(() => {
    Promise.all([api.customers.list(), api.sellBills.series()]).then(([c, s]) => {
      setCustomers(c)
      setBillSeries(s)
      if (s.length && !form.billSeriesId) setForm((f) => ({ ...f, billSeriesId: String(s[0].id) }))
      const qCustomer = searchParams.get('customer')
      const qValuation = searchParams.get('valuation')
      if (qCustomer || qValuation) {
        setForm((f) => ({ ...f, customerId: qCustomer || f.customerId, valuationId: qValuation || f.valuationId }))
      }
      // Auto-populate items from valuation — use valuation fee as the sell bill amount
      if (qValuation) {
        api.valuations.get(qValuation).then((val) => {
          if (val) {
            const fee = Number(val.valuationFee) || 0
            const items = fee > 0
              ? [{ particular: 'Valuation Fee', amount: fee }]
              : [blankItem()]
            setForm((f) => ({ ...f, items }))
          }
        }).catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    if (!isView) return
    api.sellBills.get(id).then((b) => {
      setBill(b)
      setForm({
        billSeriesId: String(b.billSeriesId || ''),
        customerId: String(b.customerId || ''),
        valuationId: String(b.valuationId || ''),
        billDate: b.billDate || '',
        withGst: (b.gstPercent || 0) > 0,
        advance: b.advance || 0,
        paymentMode: b.paymentMode || 'Cash',
        items: b.items?.length ? b.items.map((it) => ({
          particular: it.particular || '',
          amount: it.amount || '',
        })) : [blankItem()],
      })
    })
  }, [id, isView])

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const setItem = (index, field, value) => {
    const items = form.items.map((it, i) => i === index ? { ...it, [field]: value } : it)
    setForm((f) => ({ ...f, items }))
  }
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }))
  const removeItem = (index) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))

  const subtotal = form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const gstPercent = form.withGst ? 3 : 0
  const gstAmount = +(subtotal * gstPercent / 100).toFixed(2)
  const total = +(subtotal + gstAmount).toFixed(2)
  const balance = +(total - (Number(form.advance) || 0)).toFixed(2)

  const save = async () => {
    if (!form.customerId) return toast.error('Select customer.')
    if (!form.billSeriesId) return toast.error('Select bill series.')
    if (!form.items.some((it) => it.particular && Number(it.amount) > 0)) return toast.error('Add at least one item with amount.')
    setSaving(true)
    try {
      const payload = {
        billSeriesId: Number(form.billSeriesId),
        customerId: Number(form.customerId),
        valuationId: Number(form.valuationId) || null,
        billDate: form.billDate,
        gstPercent,
        advance: Number(form.advance) || 0,
        items: form.items.filter((it) => it.particular).map((it) => ({ particular: it.particular, amount: Number(it.amount) || 0 })),
        paymentMode: form.paymentMode,
      }
      const saved = await api.sellBills.create(payload)
      toast.success('Sell bill created.')
      navigate(`/sell-bills/${saved.id}`)
    } catch (e) {
      toast.error(e.message || 'Error saving bill.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/sell-bills" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{bill?.billNumber || 'New Sell Bill'}</h1>
          <p className="text-sm text-slate-500">Simple jewellery sell bill.</p>
        </div>
        {bill && <button className="btn-primary ml-auto" onClick={() => setPrintOpen(true)}><Printer size={16} /> Print</button>}
      </div>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="label">Bill Series</label>
            <select className="input" value={form.billSeriesId} onChange={(e) => setField('billSeriesId', e.target.value)} disabled={isView}>
              <option value="">Select series</option>
              {billSeries.map((s) => <option key={s.id} value={s.id}>{s.seriesName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customerId} onChange={(e) => setField('customerId', e.target.value)} disabled={isView}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bill Date</label>
            <input type="date" className="input" value={form.billDate} onChange={(e) => setField('billDate', e.target.value)} disabled={isView} />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Items</h2>
          {!isView && <button type="button" className="btn-secondary" onClick={addItem}><Plus size={16} /> Add Row</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[500px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 w-10">No.</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3 w-32 text-right">Amount (₹)</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {form.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2"><input className="input" placeholder="Item description" value={item.particular} onChange={(e) => setItem(i, 'particular', e.target.value)} disabled={isView} /></td>
                  <td className="px-3 py-2"><input type="number" className="input text-right" value={item.amount} onChange={(e) => setItem(i, 'amount', e.target.value)} disabled={isView} /></td>
                  <td className="px-3 py-2">
                    {!isView && form.items.length > 1 && <button className="btn-ghost" onClick={() => removeItem(i)}><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <div>
            <p className="label">Subtotal</p>
            <p className="text-lg font-semibold">{inr(subtotal)}</p>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.withGst} onChange={(e) => setField('withGst', e.target.checked)} disabled={isView} className="h-4 w-4 rounded border-slate-300" />
              With GST (3%)
            </label>
            {form.withGst && <p className="mt-1 text-xs text-slate-500">GST: {inr(gstAmount)}</p>}
          </div>
          <div>
            <p className="label">Total</p>
            <p className="text-xl font-bold text-slate-950">{inr(total)}</p>
          </div>
          <div>
            <label className="label">Advance</label>
            <input type="number" className="input" value={form.advance} onChange={(e) => setField('advance', e.target.value)} disabled={isView} />
            <p className="mt-1 text-xs text-slate-500">Balance: {inr(balance)}</p>
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={form.paymentMode} onChange={(e) => setField('paymentMode', e.target.value)} disabled={isView}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </section>

      {!isView && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Create Sell Bill'}
          </button>
        </div>
      )}

      {printOpen && bill && <SellBillPrint bill={bill} onClose={() => setPrintOpen(false)} />}
    </div>
  )
}
