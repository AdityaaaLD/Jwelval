import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export default function ManageUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)

  const loadUsers = () => {
    api.auth.listUsers()
      .then(setUsers)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error('All fields are required.')
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters.')
    }
    setCreating(true)
    try {
      await api.auth.createUser(form)
      toast.success(`User "${form.name}" created successfully.`)
      setForm({ name: '', email: '', password: '' })
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to create user.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete "${userName}"? This will remove their account and all sessions.`)) return
    try {
      await api.auth.deleteUser(userId)
      toast.success(`User "${userName}" deleted.`)
      loadUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to delete user.')
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-slate-500">You don't have permission to access this page.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage user accounts. Only you (admin) can add new users.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Create New User</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                placeholder="User's name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading users...</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.name}
                    {u.id === currentUser.id && <span className="ml-2 text-xs text-gold-600">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.role === 'admin' ? 'bg-gold-100 text-gold-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === 'admin' && <ShieldCheck size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.plan}</td>
                  <td className="px-4 py-3 text-slate-500">{u.createdAt?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-center py-8 text-slate-400">No users found.</p>
          )}
        </div>
      )}
    </div>
  )
}
