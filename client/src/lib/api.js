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
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
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
