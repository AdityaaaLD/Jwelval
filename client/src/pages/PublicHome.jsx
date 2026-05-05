import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Camera, FileLock2, Gem, QrCode, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'

const features = [
  [Camera, 'Camera-first valuation', 'Capture borrower, Aadhaar, and ornament photos directly while creating a report.'],
  [FileLock2, 'Print and lock', 'Once printed, the gold valuation certificate becomes permanently locked.'],
  [QrCode, 'Bank verification QR', 'Each certificate gets a QR code so bank staff can verify authenticity instantly.'],
  [WalletCards, 'Fee tracking', 'Track valuation fees by receivable from bank, cash, or UPI.'],
]

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-gold-500 text-ink-900"><Gem size={20} /></div>
            <span className="font-display text-lg font-bold tracking-wide text-slate-950">JewelVal</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/subscribe" className="btn-secondary">Subscribe</Link>
            <Link to="/login" className="btn-primary">Login</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="overflow-hidden bg-ink-800 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.02fr_.98fr] md:items-center lg:py-20">
            <div className="animate-rise-in">
              <p className="inline-flex items-center gap-2 rounded-md bg-gold-500/15 px-3 py-1 text-sm text-gold-300"><BadgeCheck size={16} /> Built for gold appraisers and bank valuation agents</p>
              <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight md:text-6xl">Gold valuation certificates, ready for bank submission.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Create compact certificate layouts, capture photos, calculate gold value, collect valuation fees, print locked reports, and let banks verify each certificate with QR.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" className="btn-primary group">Open App <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={16} /></Link>
                <Link to="/subscribe" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">View Plans</Link>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center">
                {[
                  ['QR', 'verification'],
                  ['2 min', 'certificate flow'],
                  ['3 modes', 'fee tracking'],
                ].map(([value, label], index) => (
                  <div key={label} className="animate-rise-in rounded-md border border-white/10 bg-white/5 p-3" style={{ animationDelay: `${160 + index * 90}ms` }}>
                    <p className="font-display text-xl font-bold text-gold-300">{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative animate-float-soft">
              <div className="absolute -right-4 top-10 z-10 animate-badge-pop rounded-md border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-700 shadow-xl">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> QR verified</span>
              </div>
              <div className="relative rounded-lg border border-white/10 bg-white p-4 text-slate-900 shadow-2xl">
                <div className="pointer-events-none absolute inset-x-4 top-4 h-1 animate-scan-line bg-gold-500/80" />
                <div className="border border-slate-900 p-3 text-xs">
                  <div className="bg-slate-900 py-2 text-center text-lg font-bold uppercase tracking-wide text-white">Gold Valuation Certificate</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="grid h-20 place-items-center border border-slate-400 bg-slate-100 text-[10px] text-slate-500">Borrower Photo</div>
                    <div className="col-span-2 grid grid-cols-2 gap-1 text-[10px]">
                      {['Borrower Name', 'Loan Amount', 'Gold Rate', 'Branch', 'A/C No', 'Date'].map((x) => <div key={x} className="border border-slate-300 p-1">{x}</div>)}
                    </div>
                  </div>
                  <div className="mt-3 border border-slate-900 bg-slate-900 py-2 text-center font-bold text-white">Detailed list of Ornaments</div>
                  <div className="grid grid-cols-5 text-[10px]">
                    {['Item', 'Purity', 'Gross', 'Net 22K', 'Value'].map((x) => <div key={x} className="border border-slate-300 p-1 font-semibold">{x}</div>)}
                    {['Chain', '86%', '24.96', '23.417', 'Rs. 1,68,602'].map((x) => <div key={x} className="border border-slate-300 p-1">{x}</div>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between border border-slate-900 bg-slate-900 px-3 py-2 text-white">
                    <span>Market Value: Rs. 5,44,613.76</span>
                    <span>Recommended Loan: Rs. 3,10,429.84</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="grid h-16 w-16 place-items-center border border-slate-900 text-[10px]">QR</div>
                    <div className="text-[11px]"><b>Scan to verify</b><br />DNYAN-2025-0003</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 md:grid-cols-4">
          {features.map(([Icon, title, copy]) => (
            <div key={title} className="card animate-rise-in p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-md">
              <Icon className="text-gold-600" size={24} />
              <h2 className="mt-3 font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm text-slate-500">{copy}</p>
            </div>
          ))}
        </section>
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 py-10 md:grid-cols-3">
            {[
              ['1', 'Scan customer', 'Aadhaar OCR and borrower photo capture.'],
              ['2', 'Enter ornaments', 'Manual gold rate, weight, purity, and fee tracking.'],
              ['3', 'Print certificate', 'Locked PDF with QR verification for banks.'],
            ].map(([step, title, copy]) => (
              <div key={step} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink-800 font-display font-bold text-gold-400">{step}</div>
                <div>
                  <h3 className="font-display font-bold text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gold-700"><Sparkles size={16} /> Ready for the first branch demo</p>
            <h2 className="font-display mt-2 text-3xl font-extrabold text-slate-950">Start issuing cleaner valuation reports today.</h2>
          </div>
          <Link to="/login" className="btn-primary">Login to JewelVal</Link>
        </section>
      </main>
    </div>
  )
}
