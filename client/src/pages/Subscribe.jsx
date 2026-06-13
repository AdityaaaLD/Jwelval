import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { ArrowRight, BadgeCheck, Banknote, Camera, Check, Gem, Headphones, LockKeyhole, QrCode, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../lib/api'

const plans = [
  {
    code: 'YEAR_1_ANNUAL',
    name: 'Year 1 Subscription',
    price: 'Rs. 10,000',
    period: '/user/year',
    volume: 'First-year onboarding pricing',
    bestFor: 'New customers starting JewelVal with full onboarding and support.',
    cta: 'Request Year 1 Access',
    recommended: true,
    tone: 'border-blue-300 bg-white shadow-2xl shadow-blue-950/20',
    icon: Gem,
    features: ['All core valuation workflows included', 'Certificate generation + verification', 'Setup and onboarding support', 'Annual per-user billing model'],
  },
  {
    code: 'YEAR_2_MONTHLY',
    name: 'Year 2 Onward Renewal',
    price: 'Rs. 299',
    period: '/user/month',
    volume: 'From second year onward',
    bestFor: 'Customers continuing after Year 1 on flexible monthly per-user billing.',
    cta: 'Request Renewal Access',
    tone: 'border-slate-200 bg-white',
    icon: ShieldCheck,
    features: ['No re-onboarding required', 'Per-user monthly billing', 'Same platform and support continuity', 'Best for active teams post launch year'],
  },
]

const highlights = [
  [Camera, 'Photo-first workflow', 'Capture borrower and jewellery photos while creating the report.'],
  [QrCode, 'Bank QR verify', 'Every certificate can be verified from jwelval.in.'],
  [Banknote, 'Fee clarity', 'Track receivable from bank, cash, and UPI payments cleanly.'],
  [LockKeyhole, 'Locked certificates', 'Printed reports stay locked for audit confidence.'],
]

export default function Subscribe() {
  const [selectedPlanCode, setSelectedPlanCode] = useState('YEAR_1_ANNUAL')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    companyName: '',
    teamSize: '',
    city: '',
    notes: '',
  })

  const selectedPlan = plans.find((plan) => plan.code === selectedPlanCode) || plans[0]

  const onFieldChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const selectPlan = (planCode) => {
    setSelectedPlanCode(planCode)
    const formEl = document.getElementById('access-request-form')
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const submitRequest = async (event) => {
    event.preventDefault()

    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error('Please enter your name and phone number.')
      return
    }

    setSubmitting(true)
    try {
      await api.subscriptions.requestAccess({
        planCode: selectedPlan.code,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        companyName: form.companyName,
        teamSize: form.teamSize ? Number(form.teamSize) : undefined,
        city: form.city,
        notes: form.notes,
      })

      toast.success('Access request sent successfully. Our team will contact you soon.')
      setForm({
        fullName: '',
        phone: '',
        email: '',
        companyName: '',
        teamSize: '',
        city: '',
        notes: '',
      })
    } catch (error) {
      toast.error(error.message || 'Failed to send access request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white shadow-lg shadow-blue-600/30"><Gem size={20} /></span>
            <span className="font-display text-lg font-bold tracking-wide">JewelVal</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300">Home</Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ backgroundColor: '#2563eb' }}>Login</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative text-white" style={{ background: 'linear-gradient(135deg, #061225 0%, #0f172a 52%, #111827 100%)' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(37,99,235,.38),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.05fr_.95fr] md:items-center lg:py-16">
            <div className="animate-rise-in">
              <p className="inline-flex items-center gap-2 rounded-md border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-100">
                <Sparkles size={16} /> Built for bank gold-loan valuation agents
              </p>
              <h1 className="font-display mt-5 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl md:text-6xl">
                Transparent pricing for real valuation teams.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Year 1 is billed at Rs. 10,000 per user annually. From Year 2 onward, billing shifts to Rs. 299 per user monthly.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#plans" className="group inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ backgroundColor: '#2563eb' }}>
                  Compare Plans <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={16} />
                </a>
                <Link to="/login" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">Try Demo Login</Link>
              </div>
            </div>

            <div className="relative animate-float-soft">
              <div className="rounded-lg border border-white/10 bg-white p-4 text-slate-900 shadow-2xl">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-blue-700">Recommended</p>
                      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Year 1 Subscription</h2>
                    </div>
                    <div className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white sm:px-3 sm:py-2 sm:text-sm">Rs. 10,000/user/year</div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Year 1', 'annual billing model'],
                      ['Year 2+', 'moves to monthly plan'],
                      ['Rs. 299', 'per user per month'],
                    ].map(([value, label], index) => (
                      <div key={label} className="rounded-md border border-slate-200 bg-white p-3" style={{ animationDelay: `${140 + index * 90}ms` }}>
                        <p className="font-display text-xl font-extrabold text-slate-950">{value}</p>
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2 text-sm">
                    {['QR certificate verify', 'Aadhaar scan autofill', 'WhatsApp sharing', 'Fee receivable tracking'].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
                        <Check className="text-blue-600" size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 right-4 animate-badge-pop rounded-md border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-700 shadow-xl">
                <span className="inline-flex items-center gap-2"><BadgeCheck size={16} /> Bank-ready workflow</span>
              </div>
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Subscription Plans</p>
              <h2 className="font-display mt-2 text-2xl font-extrabold text-slate-950 md:text-3xl">Select your subscription phase.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-slate-500">Choose Year 1 for new onboarding, or Year 2 onward if you are continuing after the first year. Both use per-user pricing.</p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              const isSelected = selectedPlanCode === plan.code
              return (
                <article
                  key={plan.name}
                  className={`relative animate-rise-in rounded-lg border p-5 transition duration-200 hover:-translate-y-1 ${plan.tone} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  {plan.recommended && (
                    <div className="absolute right-4 top-4 rounded-md bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      Best fit
                    </div>
                  )}
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-blue-700">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display mt-5 text-xl font-extrabold text-slate-950 md:text-2xl">{plan.name}</h3>
                  <p className="mt-2 text-sm text-slate-500">{plan.bestFor}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="font-display text-3xl font-extrabold text-slate-950 md:text-4xl">{plan.price}</span>
                    <span className="pb-1 text-sm font-semibold text-slate-500">{plan.period}</span>
                  </div>
                  <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{plan.volume}</p>
                  <ul className="mt-5 space-y-3 text-sm text-slate-600">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 shrink-0 text-blue-600" size={16} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => selectPlan(plan.code)}
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 ${plan.recommended ? 'text-white shadow-lg shadow-blue-600/25 hover:opacity-90 focus:ring-blue-400' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400'}`}
                    style={plan.recommended ? { backgroundColor: '#2563eb' } : undefined}
                  >
                    {isSelected ? 'Selected Plan' : plan.cta}
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section id="access-request-form" className="mx-auto max-w-6xl px-5 pb-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Account Access Request</p>
                <h2 className="font-display mt-1 text-xl font-extrabold text-slate-950 md:text-2xl">Send request to activate your subscription</h2>
                <p className="mt-2 text-sm text-slate-500">Selected: <span className="font-semibold text-slate-800">{selectedPlan.name}</span> ({selectedPlan.price}{selectedPlan.period})</p>
              </div>
              <div className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 lg:text-center">Request emails are sent to support@logic-motive.com</div>
            </div>

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submitRequest}>
              <label className="text-sm font-medium text-slate-700">
                Full Name *
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={onFieldChange}
                  maxLength={80}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Phone Number *
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={onFieldChange}
                  maxLength={20}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onFieldChange}
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Company / Firm Name
                <input
                  type="text"
                  name="companyName"
                  value={form.companyName}
                  onChange={onFieldChange}
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Number of Users
                <input
                  type="number"
                  name="teamSize"
                  value={form.teamSize}
                  onChange={onFieldChange}
                  min="1"
                  max="5000"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                City
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={onFieldChange}
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Additional Details
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={onFieldChange}
                  maxLength={1000}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {submitting ? 'Sending Request...' : 'Send Account Access Request'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map(([Icon, title, copy], index) => (
              <div key={title} className="animate-rise-in rounded-lg border border-slate-200 p-5" style={{ animationDelay: `${index * 80}ms` }}>
                <Icon className="text-blue-700" size={24} />
                <h3 className="mt-3 font-display font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Headphones size={16} /> Recommended launch choice</p>
            <h2 className="font-display mt-2 text-2xl font-extrabold text-slate-950 md:text-3xl">Start Year 1 at Rs. 10,000 per user/year.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">From Year 2 onward, continue at Rs. 299 per user/month. Use the form above to send your account access request.</p>
          </div>
          <a href="#access-request-form" className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400 lg:shrink-0" style={{ backgroundColor: '#2563eb' }}>Request Access</a>
        </section>
      </main>
    </div>
  )
}
