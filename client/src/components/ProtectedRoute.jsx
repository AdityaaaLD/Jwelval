import { Navigate, useLocation } from 'react-router-dom'
import SplashScreen from './SplashScreen'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
