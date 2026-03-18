const BASE = ''

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  stats:       ()            => req('/api/stats'),
  config:      ()            => req('/api/config'),
  signals:     (params = {}) => req('/api/signals?' + new URLSearchParams(params)),
  signal:      (id)          => req(`/api/signals/${encodeURIComponent(id)}`),
  review:      (id, body)    => req(`/api/signals/${encodeURIComponent(id)}/review`, {
                                 method: 'POST',
                                 body: JSON.stringify(body),
                               }),
  sweep:       ()            => req('/api/sweep', { method: 'POST' }),
  sweepStatus: ()            => req('/api/sweep/status'),
  sweeps:      ()            => req('/api/sweeps'),
  audit:       ()            => req('/api/activity'),
  pulse:       ()            => req('/api/pulse'),
}
