import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { api } from '../../lib/api'

export default function OrnamentMaster() {
  const [rows, setRows] = useState([])
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const load = () => api.ornaments.list().then(setRows)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!newName.trim()) return toast.error('Enter ornament name.')
    await api.ornaments.create({ name: newName.trim() })
    setNewName('')
    toast.success('Ornament added.')
    load()
  }

  const save = async (id) => {
    if (!editName.trim()) return
    await api.ornaments.update(id, { name: editName.trim() })
    setEditId(null)
    toast.success('Updated.')
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this ornament?')) return
    await api.ornaments.remove(id)
    toast.success('Deleted.')
    load()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Ornament Master</h1>
        <p className="text-sm text-slate-500">Manage the list of ornament names shown in the valuation form dropdown.</p>
      </div>
      <div className="card flex gap-3 p-4">
        <input className="input flex-1" placeholder="New ornament name..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary" onClick={add}><Plus size={16} /> Add</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Sr</th>
              <th className="px-5 py-3">Ornament Name</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="px-5 py-3">{i + 1}</td>
                <td className="px-5 py-3">
                  {editId === r.id ? (
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save(r.id)} autoFocus />
                  ) : r.name}
                </td>
                <td className="px-5 py-3 text-right">
                  {editId === r.id ? (
                    <span className="inline-flex gap-1">
                      <button className="btn-ghost" onClick={() => save(r.id)}><Check size={16} /></button>
                      <button className="btn-ghost" onClick={() => setEditId(null)}><X size={16} /></button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button className="btn-ghost" onClick={() => { setEditId(r.id); setEditName(r.name) }}><Pencil size={16} /></button>
                      <button className="btn-ghost text-red-500" onClick={() => remove(r.id)}><Trash2 size={16} /></button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
