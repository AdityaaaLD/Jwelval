import toast from 'react-hot-toast'
import { Database, RotateCcw } from 'lucide-react'
import { api } from '../../lib/api'

export default function DemoData() {
  const load = async () => {
    const summary = await api.demo.load()
    toast.success(`Loaded ${summary.customers} customers and ${summary.valuations} valuations.`)
  }
  const reset = async () => {
    await api.demo.reset()
    toast.success('Demo data reset.')
  }
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">Demo Data</h1><p className="text-sm text-slate-500">Reset or load realistic sample records for demos.</p></div>
      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <button className="btn-primary h-24 text-base" onClick={load}><Database size={20} /> Load Demo Data</button>
        <button className="btn-secondary h-24 text-base" onClick={reset}><RotateCcw size={20} /> Clear Transaction Data</button>
      </div>
    </div>
  )
}
