import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('jewelval_token')
    if (!token) {
      setLoading(false)
      return
    }
    api.auth.me()
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem('jewelval_token'))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login: async (email, password) => {
      const res = await api.auth.login({ email, password })
      if (res?.token && res?.user) {
        localStorage.setItem('jewelval_token', res.token)
        setUser(res.user)
      }
      return res
    },
    signup: async (name, email, password) => {
      const res = await api.auth.signup({ name, email, password })
      if (res?.token && res?.user) {
        localStorage.setItem('jewelval_token', res.token)
        setUser(res.user)
      }
      return res
    },
    setSession: (authPayload) => {
      if (!authPayload?.token || !authPayload?.user) return
      localStorage.setItem('jewelval_token', authPayload.token)
      setUser(authPayload.user)
    },
    logout: async () => {
      try { await api.auth.logout() } catch {}
      localStorage.removeItem('jewelval_token')
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
