import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, Camera, FileLock2, Gem, QrCode, ShieldCheck } from 'lucide-react'
import SplashScreen from '../components/SplashScreen'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: 'demo@jwelval.in', password: 'admin123' })
  const [loading, setLoading] = useState(false)
  const [splash, setSplash] = useState(false)
  const from = location.state?.from || '/dashboard'

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      setSplash(true)
      setTimeout(() => navigate(from, { replace: true }), 1800)
    } catch (error) {
      toast.error(error.message || 'Unable to login.')
      setLoading(false)
    }
  }

  if (splash) return <SplashScreen />

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-6 py-8 lg:grid-cols-[1.05fr_460px]">
        <div className="relative">
          <div className="flex flex-col items-start gap-4 xl:flex-row xl:items-center xl:gap-5">
          <Link to="/" className="inline-flex shrink-0 items-center gap-2 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-gold-500 text-ink-900 shadow-lg shadow-gold-900/20"><Gem size={24} /></span>
            <span className="font-display text-2xl font-bold tracking-wide">JewelVal</span>
          </Link>
          <p className="inline-flex max-w-full items-center gap-2 rounded-md border border-gold-400/20 bg-gold-400/10 px-3 py-1 text-sm leading-5 text-gold-200">
            <BadgeCheck size={16} /> Trusted workflow for bank gold-loan valuation agents
          </p>
          </div>
          <h1 className="font-display mt-8 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl xl:text-6xl">
            Sign in to issue bank-ready gold valuation certificates.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Capture borrower and ornament photos, scan Aadhaar, calculate gold value, collect valuation fees, print locked certificates, and let banks verify every report by QR.
          </p>

          <div className="mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
            {[
              [FileLock2, 'Print & lock'],
              [Camera, 'Camera capture'],
              [QrCode, 'QR verify'],
            ].map(([Icon, label]) => (
              <div key={label} className="rounded-md border border-white/10 bg-white/5 p-4">
                <Icon className="text-gold-400" size={22} />
                <p className="mt-3 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 hidden max-w-2xl rounded-lg border border-white/10 bg-white p-4 text-slate-900 shadow-2xl lg:block">
            <div className="border border-slate-900 p-3 text-xs">
              <div className="bg-slate-900 py-2 text-center text-lg font-bold uppercase tracking-wide text-white">Gold Valuation Certificate</div>
              <div className="mt-3 grid grid-cols-[90px_1fr_90px] gap-2">
                <div className="grid h-24 place-items-center border border-slate-400 bg-slate-100 text-[10px]">Borrower Photo</div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {['Loan Amount', 'Borrower Name', 'Rate Of Interest', 'Customer ID', '22K Rate', 'Date'].map((x) => <div key={x} className="border border-slate-300 p-1">{x}</div>)}
                </div>
                <div className="grid h-24 place-items-center border border-slate-400 bg-slate-100 text-[10px]">Ornaments Photo</div>
              </div>
              <div className="mt-3 border border-slate-900 bg-yellow-50 py-2 text-center font-bold">Detailed list of Ornaments</div>
              <div className="grid grid-cols-6 border-x border-slate-900 text-[10px]">
                {['Sr', 'Description', 'Purity', 'Gross Wt', 'Net 22K', 'Value'].map((x) => <div key={x} className="border-b border-r border-slate-900 p-1">{x}</div>)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-ink-800 text-gold-400">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">Welcome back</h2>
              <p className="text-sm text-slate-500">Demo credentials are prefilled.</p>
            </div>
          </div>
          <label className="label mt-6">Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="label mt-4">Password</label>
          <input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" />
          <button className="btn-primary mt-6 w-full py-3" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
          <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
            Demo: demo@jwelval.in / admin123
          </div>
          <Link to="/subscribe" className="mt-5 block text-center text-sm font-medium text-gold-700">Need a plan? View subscriptions</Link>
        </form>
      </div>
    </div>
  )
}
