import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { inr, today } from '../../lib/format'

const paymentModeLabel = (mode) => mode === 'RECEIVABLE_FROM_BANK' ? 'Receivable from bank' : mode

export default function PaymentSection({ valuation }) {
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState({ paymentDate: today(), amount: '', mode: 'RECEIVABLE_FROM_BANK', referenceNumber: '', notes: '' })

  const load = () => valuation?.id && api.payments.list(valuation.id).then(setPayments)
  useEffect(() => { load() }, [valuation?.id])

  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [payments])
  const outstanding = (Number(valuation?.valuationFee) || 0) - totalPaid

  const submit = async (event) => {
    event.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter payment amount.')
    if (form.mode === 'UPI' && !form.referenceNumber) return toast.error('UPI reference number is required.')
    await api.payments.create({ ...form, valuationId: valuation.id, amount: Number(form.amount) })
    toast.success('Payment recorded.')
    setForm({ paymentDate: today(), amount: '', mode: 'RECEIVABLE_FROM_BANK', referenceNumber: '', notes: '' })
    load()
  }

  const remove = async (id) => {
    await api.payments.remove(id)
    toast.success('Payment deleted.')
    load()
  }

  if (!valuation?.id) return null

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">Payments</h2>
      </div>
      <form onSubmit={submit} className="grid gap-3 p-5 md:grid-cols-6">
        <input className="input md:col-span-2" value={valuation.valuationNumber} readOnly />
        <input type="date" className="input" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required />
        <input type="number" className="input" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          <option value="RECEIVABLE_FROM_BANK">Receivable from bank</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
        </select>
        <input className="input" placeholder="Reference" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
        <textarea className="input md:col-span-5" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="btn-primary">Add Payment</button>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Notes</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <tr key={payment.id}><td className="px-5 py-3">{payment.paymentDate}</td><td className="px-5 py-3">{paymentModeLabel(payment.mode)}</td><td className="px-5 py-3">{payment.referenceNumber || '-'}</td><td className="px-5 py-3 text-right">{inr(payment.amount)}</td><td className="px-5 py-3">{payment.notes || '-'}</td><td className="px-5 py-3 text-right"><button type="button" className="btn-ghost" onClick={() => remove(payment.id)}><Trash2 size={16} /></button></td></tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold"><tr><td colSpan="3" className="px-5 py-3">Fee Paid</td><td className="px-5 py-3 text-right">{inr(totalPaid)}</td><td className={outstanding > 0 ? 'px-5 py-3 text-red-700' : 'px-5 py-3 text-green-700'} colSpan="2">Fee Receivable: {inr(outstanding)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  )
}
