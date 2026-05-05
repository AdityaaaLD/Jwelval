import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Banknote, Camera, Check, Gem, Headphones, LockKeyhole, QrCode, ShieldCheck, Sparkles, Users } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    price: 'Rs. 999',
    period: '/mo',
    volume: 'Up to 300 reports/month',
    bestFor: 'Solo appraisers testing JewelVal with one branch.',
    cta: 'Start Starter',
    tone: 'border-slate-200 bg-white',
    icon: Gem,
    features: ['1 appraiser login', 'Customer and ornament photo capture', 'Gold valuation certificate print', 'Manual gold rate and weight entry'],
  },
  {
    name: 'Pro',
    price: 'Rs. 1,999',
    period: '/mo',
    volume: 'Up to 1,000 reports/month',
    bestFor: 'Best fit for 5K-7K valuation reports per year.',
    cta: 'Choose Pro',
    recommended: true,
    tone: 'border-blue-300 bg-white shadow-2xl shadow-blue-950/20',
    icon: ShieldCheck,
    features: ['Everything in Starter', 'QR verification for banks', 'WhatsApp-ready sharing', 'Fee tracking: bank receivable, cash, UPI', 'Aadhaar scan and autofill'],
  },
  {
    name: 'Business',
    price: 'Rs. 4,999',
    period: '/mo',
    volume: 'Branch/team scale',
    bestFor: 'For jewellers handling multiple branches or operators.',
    cta: 'Talk to Sales',
    tone: 'border-slate-200 bg-white',
    icon: Users,
    features: ['Multiple appraiser users', 'Priority support', 'Backup and restore assistance', 'Branch-wise reports', 'Custom certificate setup'],
  },
]

const highlights = [
  [Camera, 'Photo-first workflow', 'Capture borrower and jewellery photos while creating the report.'],
  [QrCode, 'Bank QR verify', 'Every certificate can be verified from jwelval.in.'],
  [Banknote, 'Fee clarity', 'Track receivable from bank, cash, and UPI payments cleanly.'],
  [LockKeyhole, 'Locked certificates', 'Printed reports stay locked for audit confidence.'],
]

export default function Subscribe() {
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
              <h1 className="font-display mt-5 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
                Pricing that fits real valuation volume.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                For an agent creating around 5K-7K certificates per year, Pro keeps the monthly cost simple while covering QR verification, WhatsApp sharing, Aadhaar scan, and payment tracking.
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
                      <h2 className="font-display text-3xl font-extrabold">Pro Plan</h2>
                    </div>
                    <div className="rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white">Rs. 1,999/mo</div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['583', 'avg/month at 7K/year'],
                      ['1,000', 'reports included'],
                      ['Rs. 3.43', 'software cost/report'],
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Subscription Plans</p>
              <h2 className="font-display mt-2 text-3xl font-extrabold text-slate-950">Choose the plan by certificate volume.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-slate-500">You can start with Pro for the first customer. Move to Business only when multiple users, branches, or premium support become important.</p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const Icon = plan.icon
              return (
                <article
                  key={plan.name}
                  className={`relative animate-rise-in rounded-lg border p-5 transition duration-200 hover:-translate-y-1 ${plan.tone}`}
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
                  <h3 className="font-display mt-5 text-2xl font-extrabold text-slate-950">{plan.name}</h3>
                  <p className="mt-2 text-sm text-slate-500">{plan.bestFor}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="font-display text-4xl font-extrabold text-slate-950">{plan.price}</span>
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
                  <Link
                    to="/login"
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 ${plan.recommended ? 'text-white shadow-lg shadow-blue-600/25 hover:opacity-90 focus:ring-blue-400' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400'}`}
                    style={plan.recommended ? { backgroundColor: '#2563eb' } : undefined}
                  >
                    {plan.cta}
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-10 md:grid-cols-4">
            {highlights.map(([Icon, title, copy], index) => (
              <div key={title} className="animate-rise-in rounded-lg border border-slate-200 p-5" style={{ animationDelay: `${index * 80}ms` }}>
                <Icon className="text-blue-700" size={24} />
                <h3 className="mt-3 font-display font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><Headphones size={16} /> Recommended launch choice</p>
            <h2 className="font-display mt-2 text-3xl font-extrabold text-slate-950">Start with Pro at Rs. 1,999/month.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">For 5K-7K annual valuation reports, this keeps cost per certificate low and gives the wow features customers will notice.</p>
          </div>
          <Link to="/login" className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ backgroundColor: '#2563eb' }}>Open Demo</Link>
        </section>
      </main>
    </div>
  )
}
