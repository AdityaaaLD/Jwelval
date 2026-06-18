import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, Camera, FileLock2, Gem, QrCode, ShieldCheck } from 'lucide-react'
import SplashScreen from '../components/SplashScreen'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading, login, signup, setSession } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot' | 'verify'
  const [step, setStep] = useState('credentials') // 'credentials' | 'otp' | 'reset'
  const [signupOpen, setSignupOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '', newPassword: '' })
  const [otpPurpose, setOtpPurpose] = useState('LOGIN')
  const [resetToken, setResetToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpRequestInFlight, setOtpRequestInFlight] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [splash, setSplash] = useState(false)
  const from = location.state?.from || '/dashboard'

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((v) => Math.max(0, v - 1)), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  useEffect(() => {
    api.auth.signupStatus().then((res) => {
      setSignupOpen(res.signupOpen)
      if (res.firstUserMode) setMode('signup')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  const resetToLogin = () => {
    setMode('login')
    setStep('credentials')
    setOtpPurpose('LOGIN')
    setResetToken('')
    setForm((prev) => ({ ...prev, otp: '', newPassword: '' }))
  }

  const startOtpFlow = async (purpose) => {
    if (otpRequestInFlight) return
    setOtpRequestInFlight(true)
    try {
      await api.auth.requestOtp({ email: form.email, purpose })
      setOtpPurpose(purpose)
      setStep('otp')
      setResendCooldown(60)
      setForm((prev) => ({ ...prev, otp: '' }))
      toast.success('OTP sent to your email.')
    } finally {
      setOtpRequestInFlight(false)
    }
  }

  const resendOtp = async () => {
    if (resendCooldown > 0 || otpRequestInFlight) return
    setLoading(true)
    setOtpRequestInFlight(true)
    try {
      if (otpPurpose === 'LOGIN') {
        if (!form.password) {
          toast.error('Enter your password to resend login OTP.')
          setLoading(false)
          setOtpRequestInFlight(false)
          return
        }
        const result = await login(form.email, form.password)
        if (!result?.otpRequired) {
          toast.error('Could not resend login OTP. Please try signing in again.')
          setLoading(false)
          setOtpRequestInFlight(false)
          return
        }
        setResendCooldown(60)
        toast.success('Login OTP resent to your email.')
        setLoading(false)
        setOtpRequestInFlight(false)
        return
      }

      await startOtpFlow(otpPurpose)
      setLoading(false)
      setOtpRequestInFlight(false)
    } catch (error) {
      const retryAfter = Number(error?.payload?.retryAfterSeconds || 0)
      if (retryAfter > 0) setResendCooldown(retryAfter)
      toast.error(error.message || 'Failed to resend OTP.')
      setLoading(false)
      setOtpRequestInFlight(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (otpRequestInFlight) {
        setLoading(false)
        return
      }
      if (mode === 'signup') {
        if (!form.name.trim()) { toast.error('Name is required.'); setLoading(false); return }
        if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); setLoading(false); return }
        const result = await signup(form.name.trim(), form.email, form.password)
        if (result?.pendingApproval) {
          toast.success(result.message || 'Signup request submitted. Awaiting admin approval.')
          setMode('login')
          setStep('credentials')
          setForm({ name: '', email: form.email, password: '', otp: '', newPassword: '' })
          setLoading(false)
          return
        }
        setSplash(true)
        setTimeout(() => navigate(from, { replace: true }), 1800)
        return
      }

      if (mode === 'login') {
        if (step === 'credentials') {
          const result = await login(form.email, form.password)
          if (result?.otpRequired) {
            setOtpPurpose('LOGIN')
            setStep('otp')
            setResendCooldown(60)
            setForm((prev) => ({ ...prev, otp: '' }))
            toast.success('OTP sent to your email.')
            setLoading(false)
            return
          }
        } else {
          const authPayload = await api.auth.verifyOtp({ email: form.email, purpose: 'LOGIN', otp: form.otp })
          setSession(authPayload)
          setSplash(true)
          setTimeout(() => navigate(from, { replace: true }), 1800)
          return
        }
      }

      if (mode === 'verify') {
        if (step === 'credentials') {
          await startOtpFlow('VERIFY_EMAIL')
          setLoading(false)
          return
        }
        await api.auth.verifyOtp({ email: form.email, purpose: 'VERIFY_EMAIL', otp: form.otp })
        toast.success('Email verified. You can login now.')
        resetToLogin()
        setLoading(false)
        return
      }

      if (mode === 'forgot') {
        if (step === 'credentials') {
          await startOtpFlow('RESET_PASSWORD')
          setLoading(false)
          return
        }
        if (step === 'otp') {
          const result = await api.auth.verifyOtp({ email: form.email, purpose: 'RESET_PASSWORD', otp: form.otp })
          setResetToken(result.resetToken)
          setStep('reset')
          setForm((prev) => ({ ...prev, newPassword: '' }))
          toast.success('OTP verified. Set your new password.')
          setLoading(false)
          return
        }
        if (form.newPassword.length < 6) {
          toast.error('Password must be at least 6 characters.')
          setLoading(false)
          return
        }
        await api.auth.resetPassword({ email: form.email, resetToken, newPassword: form.newPassword })
        toast.success('Password reset successful. Please login.')
        setForm({ name: '', email: form.email, password: '', otp: '', newPassword: '' })
        resetToLogin()
        setLoading(false)
        return
      }

      setSplash(true)
      setTimeout(() => navigate(from, { replace: true }), 1800)
    } catch (error) {
      if (error?.code === 'EMAIL_NOT_VERIFIED') {
        toast.error(error.message || 'Please verify your email first.')
        setMode('verify')
        setStep('credentials')
        setOtpPurpose('VERIFY_EMAIL')
      } else {
        toast.error(error.message || (mode === 'signup' ? 'Unable to create account.' : 'Unable to login.'))
      }
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
              <h2 className="font-display text-2xl font-bold">
                {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : mode === 'verify' ? 'Verify Email' : 'Welcome back'}
              </h2>
              <p className="text-sm text-slate-500">
                {mode === 'signup'
                  ? 'Create your account. Admin approval is required for new users.'
                  : mode === 'forgot'
                    ? 'Recover your account using email OTP.'
                    : mode === 'verify'
                      ? 'Verify your email with OTP to activate login.'
                      : 'Sign in with password and OTP.'}
              </p>
            </div>
          </div>

          {mode === 'signup' && (
            <>
              <label className="label mt-6">Full Name</label>
              <input className="input" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </>
          )}

          <label className="label mt-4">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          {(mode === 'login' && step === 'credentials') || mode === 'signup' ? (
            <>
              <label className="label mt-4">Password</label>
              <input className="input" placeholder={mode === 'signup' ? 'Min 6 characters' : ''} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" />
            </>
          ) : null}

          {step === 'otp' && (
            <>
              <label className="label mt-4">Enter OTP</label>
              <input className="input" placeholder="6-digit OTP" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                onClick={resendOtp}
                disabled={loading || otpRequestInFlight || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </>
          )}

          {mode === 'forgot' && step === 'reset' && (
            <>
              <label className="label mt-4">New Password</label>
              <input className="input" type="password" placeholder="Min 6 characters" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
            </>
          )}

          <button className="btn-primary mt-6 w-full py-3" disabled={loading || otpRequestInFlight}>
            {loading
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create Account'
                : mode === 'login' && step === 'credentials'
                  ? 'Send OTP'
                  : mode === 'login' && step === 'otp'
                    ? 'Verify OTP & Login'
                    : mode === 'verify' && step === 'credentials'
                      ? 'Send Verification OTP'
                      : mode === 'verify' && step === 'otp'
                        ? 'Verify Email'
                        : mode === 'forgot' && step === 'credentials'
                          ? 'Send Reset OTP'
                          : mode === 'forgot' && step === 'otp'
                            ? 'Verify OTP'
                            : 'Reset Password'}
          </button>

          {mode === 'login' && step === 'credentials' && (
            <p className="mt-4 text-center text-sm text-slate-500">
              <button type="button" className="font-medium text-gold-700 hover:underline" onClick={() => { setMode('forgot'); setStep('credentials'); }}>
                Forgot password?
              </button>
              {' • '}
              <button type="button" className="font-medium text-gold-700 hover:underline" onClick={() => { setMode('verify'); setStep('credentials'); }}>
                Verify email
              </button>
            </p>
          )}

          {signupOpen && (
            <p className="mt-5 text-center text-sm text-slate-500">
              {mode === 'signup' ? (
                <>Already have an account? <button type="button" className="font-medium text-gold-700 hover:underline" onClick={resetToLogin}>Sign in</button></>
              ) : (
                <>First time? <button type="button" className="font-medium text-gold-700 hover:underline" onClick={() => { setMode('signup'); setStep('credentials') }}>Create account</button></>
              )}
            </p>
          )}

          {(mode === 'forgot' || mode === 'verify') && (
            <p className="mt-5 text-center text-sm text-slate-500">
              Back to <button type="button" className="font-medium text-gold-700 hover:underline" onClick={resetToLogin}>Sign in</button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
