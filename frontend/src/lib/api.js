const BASE = ''

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY      = 'ivar-token'
const DEMO_TOKEN_KEY = 'ivar-demo-token'

export const auth = {
  getToken:    () => localStorage.getItem(TOKEN_KEY),
  setToken:    (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken:  () => localStorage.removeItem(TOKEN_KEY),
  getDemoToken: () => sessionStorage.getItem(DEMO_TOKEN_KEY),
  setDemoToken: (t) => sessionStorage.setItem(DEMO_TOKEN_KEY, t),
}

// Check URL for demo admin token on load
;(function initDemoToken() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('admin')
  if (token) {
    auth.setDemoToken(token)
    params.delete('admin')
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '')
    window.history.replaceState({}, '', newUrl)
  }
})()

// ── Request helper ────────────────────────────────────────────────────────────

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' }

  const token = auth.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const demoToken = auth.getDemoToken()
  if (demoToken) headers['X-Admin-Token'] = demoToken

  const res = await fetch(BASE + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })

  if (res.status === 401) {
    auth.clearToken()
    throw new Error('401 Unauthorized')
  }

  if (res.status === 403) {
    throw new Error('demo')
  }

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login:         (username, password, totp_code) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, ...(totp_code ? { totp_code } : {}) }) }),
  logout:        () => req('/api/auth/logout', { method: 'POST' }),
  me:            () => req('/api/auth/me'),
  updateProfile: (body) => req('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  // Users (admin only)
  users:       () => req('/api/users'),
  createUser:  (body) => req('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser:  (id, body) => req(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser:  (id) => req(`/api/users/${id}`, { method: 'DELETE' }),

  // Dashboard
  stats:       () => req('/api/stats'),
  config:      () => req('/api/config'),
  signals:     (params = {}) => req('/api/signals?' + new URLSearchParams(params)),
  signal:      (id) => req(`/api/signals/${encodeURIComponent(id)}`),
  review:      (id, body) => req(`/api/signals/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(body) }),
  sweep:       () => req('/api/sweep', { method: 'POST' }),
  sweepStatus: () => req('/api/sweep/status'),
  sweeps:      () => req('/api/sweeps'),
  audit:       () => req('/api/activity'),
  pulse:       () => req('/api/pulse'),

  // 2FA
  setup2fa:   () => req('/api/auth/2fa/setup',   { method: 'POST' }),
  verify2fa:  (code) => req('/api/auth/2fa/verify',  { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: (password) => req('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }),
  
  // Config (admin only)
  updateOrg:           (body) => req('/api/config/org',           { method: 'POST', body: JSON.stringify(body) }),
  updateAI:            (body) => req('/api/config/ai',            { method: 'POST', body: JSON.stringify(body) }),
  updateNotifications: (body) => req('/api/config/notifications', { method: 'POST', body: JSON.stringify(body) }),
  updateFeedKeys:      (body) => req('/api/config/feeds',         { method: 'POST', body: JSON.stringify(body) }),

  // Feeds
  feeds:         () => req('/api/feeds'),
  toggleFeed:    (id) => req(`/api/feeds/${id}/toggle`, { method: 'POST' }),
  addCustomFeed: (body) => req('/api/feeds/custom', { method: 'POST', body: JSON.stringify(body) }),
  deleteFeed:    (id) => req(`/api/feeds/${id}`, { method: 'DELETE' }),
}
