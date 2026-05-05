import { FileCheck2, Gem, ShieldCheck } from 'lucide-react'

export default function SplashScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-800 px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-lg bg-gold-500 text-ink-900 shadow-2xl shadow-gold-900/20">
          <Gem size={40} />
        </div>
        <h1 className="font-display mt-6 text-4xl font-extrabold tracking-wide">JewelVal</h1>
        <p className="mt-2 text-sm text-slate-300">Preparing your gold valuation workspace</p>
        <div className="mt-7 grid gap-2 text-left text-sm text-slate-200">
          <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
            <ShieldCheck className="text-gold-400" size={18} /> Securing certificate session
          </div>
          <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
            <FileCheck2 className="text-gold-400" size={18} /> Loading valuation templates
          </div>
        </div>
        <div className="mx-auto mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gold-500" />
        </div>
      </div>
    </div>
  )
}
