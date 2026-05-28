import { toast } from 'react-hot-toast'

const BASE = '/api'

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = localStorage.getItem('jewelval_token')
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let payload = null
    try { payload = await res.json() } catch {}
    if (res.status === 401 && (payload?.error === 'UNAUTHENTICATED' || payload?.error === 'SESSION_EXPIRED')) {
      localStorage.removeItem('jewelval_token')
      window.location.href = '/login'
      return
    }
    if (res.status === 403 && payload?.error === 'DOCUMENT_LOCKED') {
      toast.error('This document is locked and cannot be modified.')
    }
    const err = new Error(payload?.message || res.statusText)
    err.status = res.status
    err.code = payload?.error
    err.payload = payload
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== '' && v != null)
  return p.length ? `?${new URLSearchParams(p).toString()}` : ''
}

export const api = {
  health:    () => request('/health'),
  auth: {
    login: (data) => request('/auth/login', { method: 'POST', body: data }),
    signup: (data) => request('/auth/signup', { method: 'POST', body: data }),
    signupStatus: () => request('/auth/signup-status'),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    createUser: (data) => request('/auth/create-user', { method: 'POST', body: data }),
    listUsers: () => request('/auth/users'),
    deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),
  },
  dashboard: () => request('/dashboard'),
  rates: {
    get: (date) => request(`/rates${qs({ date })}`),
    save: (data) => request('/rates', { method: 'POST', body: data }),
  },
  profile: {
    get: () => request('/profile'),
    update: (data) => request('/profile', { method: 'PUT', body: data }),
  },
  presets: {
    banks: () => request('/presets/banks'),
    createBank: (data) => request('/presets/banks', { method: 'POST', body: data }),
    updateBank: (id, data) => request(`/presets/banks/${id}`, { method: 'PUT', body: data }),
    deleteBank: (id) => request(`/presets/banks/${id}`, { method: 'DELETE' }),
    nextAppId: (id) => request(`/presets/banks/${id}/next-app-id`, { method: 'POST' }),
    previewAppId: (id) => request(`/presets/banks/${id}/preview-app-id`),
  },
  ornaments: {
    list: () => request('/ornaments'),
    create: (data) => request('/ornaments', { method: 'POST', body: data }),
    update: (id, data) => request(`/ornaments/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/ornaments/${id}`, { method: 'DELETE' }),
  },
  sellBills: {
    list: () => request('/sell-bills'),
    get: (id) => request(`/sell-bills/${id}`),
    create: (data) => request('/sell-bills', { method: 'POST', body: data }),
    remove: (id) => request(`/sell-bills/${id}`, { method: 'DELETE' }),
    series: () => request('/sell-bills/series'),
    createSeries: (data) => request('/sell-bills/series', { method: 'POST', body: data }),
  },
  verify: (number) => request(`/verify/${encodeURIComponent(number)}`),

  customers: {
    list:   ()        => request('/customers'),
    get:    (id)      => request(`/customers/${id}`),
    create: (data)    => request('/customers', { method: 'POST', body: data }),
    update: (id, d)   => request(`/customers/${id}`, { method: 'PUT', body: d }),
    remove: (id)      => request(`/customers/${id}`, { method: 'DELETE' }),
  },

  series: {
    list:   ()        => request('/series'),
    create: (d)       => request('/series', { method: 'POST', body: d }),
    update: (id, d)   => request(`/series/${id}`, { method: 'PUT', body: d }),
    next:   (id)      => request(`/series/${id}/next`),
  },

  valuations: {
    list:        (params) => request(`/valuations${qs(params)}`),
    get:         (id)     => request(`/valuations/${id}`),
    create:      (d)      => request('/valuations', { method: 'POST', body: d }),
    update:      (id, d)  => request(`/valuations/${id}`, { method: 'PUT', body: d }),
    markPrinted: (id)     => request(`/valuations/${id}/mark-printed`, { method: 'POST' }),
    duplicate:   (id, d)  => request(`/valuations/${id}/duplicate`, { method: 'POST', body: d || {} }),
    remove:      (id)     => request(`/valuations/${id}`, { method: 'DELETE' }),
  },

  payments: {
    list:   (valuationId) => request(`/payments${qs({ valuation_id: valuationId })}`),
    create: (d)           => request('/payments', { method: 'POST', body: d }),
    remove: (id)          => request(`/payments/${id}`, { method: 'DELETE' }),
  },

  reports: {
    itemWise:     (p) => request(`/reports/item-wise${qs(p)}`),
    customerWise: (p) => request(`/reports/customer-wise${qs(p)}`),
  },

  demo: {
    load:  () => request('/demo/load',  { method: 'POST' }),
    reset: () => request('/demo/reset', { method: 'POST' }),
  },
}
