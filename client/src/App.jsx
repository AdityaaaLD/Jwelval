import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import PublicHome from './pages/PublicHome'
import Dashboard from './pages/Dashboard'
import CustomerList from './pages/customers/CustomerList'
import CustomerForm from './pages/customers/CustomerForm'
import CustomerDetail from './pages/customers/CustomerDetail'
import ValuationList from './pages/valuations/ValuationList'
import ValuationForm from './pages/valuations/ValuationForm'
import PaymentList from './pages/payments/PaymentList'
import ItemWiseReport from './pages/reports/ItemWiseReport'
import CustomerWiseReport from './pages/reports/CustomerWiseReport'
import NumberSeries from './pages/settings/NumberSeries'
import DemoData from './pages/settings/DemoData'
import DailyRates from './pages/settings/DailyRates'
import AppraiserProfile from './pages/settings/AppraiserProfile'
import BankPresets from './pages/settings/BankPresets'
import VerifyCertificate from './pages/VerifyCertificate'
import Login from './pages/Login'
import Subscribe from './pages/Subscribe'

function AppShell({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/verify/:number" element={<VerifyCertificate />} />

          <Route path="/dashboard" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="/customers" element={<AppShell><CustomerList /></AppShell>} />
          <Route path="/customers/new" element={<AppShell><CustomerForm /></AppShell>} />
          <Route path="/customers/:id" element={<AppShell><CustomerDetail /></AppShell>} />
          <Route path="/customers/:id/edit" element={<AppShell><CustomerForm /></AppShell>} />
          <Route path="/valuations" element={<AppShell><ValuationList /></AppShell>} />
          <Route path="/valuations/new" element={<AppShell><ValuationForm /></AppShell>} />
          <Route path="/valuations/:id" element={<AppShell><ValuationForm /></AppShell>} />
          <Route path="/payments" element={<AppShell><PaymentList /></AppShell>} />
          <Route path="/reports/item-wise" element={<AppShell><ItemWiseReport /></AppShell>} />
          <Route path="/reports/customer-wise" element={<AppShell><CustomerWiseReport /></AppShell>} />
          <Route path="/settings/series" element={<AppShell><NumberSeries /></AppShell>} />
          <Route path="/settings/demo" element={<AppShell><DemoData /></AppShell>} />
          <Route path="/settings/rates" element={<AppShell><DailyRates /></AppShell>} />
          <Route path="/settings/profile" element={<AppShell><AppraiserProfile /></AppShell>} />
          <Route path="/settings/banks" element={<AppShell><BankPresets /></AppShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
