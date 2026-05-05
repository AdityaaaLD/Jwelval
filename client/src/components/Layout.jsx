import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, IndianRupee, BarChart3,
  Settings, Gem, Menu, X, ChevronDown, LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function NavGroup({ icon: Icon, label, items }) {
  const loc = useLocation()
  const open = items.some((i) => loc.pathname.startsWith(i.to))
  const [expanded, setExpanded] = useState(open)
  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-300 hover:bg-ink-700 rounded-md"
      >
        <span className="flex items-center gap-2"><Icon size={18} />{label}</span>
        <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-ink-600 pl-2">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to}
              className={({ isActive }) =>
                `block px-3 py-1.5 text-sm rounded-md ${
                  isActive ? 'bg-gold-500/15 text-gold-400' : 'text-slate-400 hover:bg-ink-700 hover:text-slate-100'
                }`}>
              {it.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-gold-500/15 text-gold-400 border-l-2 border-gold-500' : 'text-slate-300 hover:bg-ink-700'
  }`

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  return (
    <div className="min-h-full flex">
      {/* Sidebar */}
      <aside
        className={`sidebar fixed lg:static z-30 inset-y-0 left-0 w-64 bg-ink-800 text-slate-100 flex-col
                    ${sidebarOpen ? 'flex' : 'hidden'} lg:flex`}
      >
        <div className="px-5 py-5 border-b border-ink-700 flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-gold-500 text-ink-900 grid place-items-center">
            <Gem size={20} />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-wide">JewelVal</p>
            <p className="text-xs text-slate-400">Valuation Management</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <NavLink to="/dashboard" className={linkClass}><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/customers" className={linkClass}><Users size={18} />Customers</NavLink>
          <NavLink to="/valuations" className={linkClass}><FileText size={18} />Valuations</NavLink>
          <NavLink to="/payments" className={linkClass}><IndianRupee size={18} />Payments</NavLink>
          <NavGroup icon={BarChart3} label="Reports" items={[
            { to: '/reports/item-wise', label: 'Item-wise' },
            { to: '/reports/customer-wise', label: 'Customer-wise' },
          ]} />
          <NavGroup icon={Settings} label="Settings" items={[
            { to: '/settings/series', label: 'Number Series' },
            { to: '/settings/rates', label: 'Daily Gold Rate' },
            { to: '/settings/banks', label: 'Bank Presets' },
            { to: '/settings/profile', label: 'Appraiser Profile' },
            { to: '/settings/demo', label: 'Demo Data' },
          ]} />
        </nav>
        <div className="border-t border-ink-700 px-4 py-3">
          <p className="text-xs text-slate-400">{user?.name || 'Appraiser'}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-2 text-xs text-slate-400 hover:text-gold-400">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="topbar lg:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu />
          </button>
          <span className="font-bold tracking-wide">JewelVal</span>
          <span className="w-6" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <button
          className="fixed top-4 right-4 z-40 lg:hidden text-slate-100"
          onClick={() => setSidebarOpen(false)}
        >
          <X />
        </button>
      )}
    </div>
  )
}
