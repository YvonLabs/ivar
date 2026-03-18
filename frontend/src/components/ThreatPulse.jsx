import { useState, useEffect } from 'react'

const stripHtml = t => t ? t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''

function WeekBars({ days }) {
  if (!days?.length) return null
  const last7 = days.slice(-7)
  const max   = Math.max(...last7.map(d => d.total), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
      {last7.map((d, i) => {
        const isToday = i === last7.length - 1
        const pctF = d.flash    / max
        const pctP = d.priority / max
        const pctR = d.routine  / max
        const H    = 40
        const label = isToday ? 'today' : (d.date?.slice(5) || '')

        return (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
            <div style={{ height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
              {d.total > 0 ? (
                <div style={{ width: '100%' }}>
                  {d.flash > 0 && (
                    <div style={{ width: '100%', height: Math.max(pctF * H, 2), background: 'var(--flash)', opacity: 0.85 }} />
                  )}
                  {d.priority > 0 && (
                    <div style={{ width: '100%', height: Math.max(pctP * H, 2), background: 'var(--priority)', opacity: 0.6 }} />
                  )}
                  {d.routine > 0 && (
                    <div style={{ width: '100%', height: Math.max(pctR * H, 2), background: 'var(--green)', opacity: 0.3 }} />
                  )}
                </div>
              ) : (
                <div style={{ width: '100%', height: 1, background: 'var(--border-2)' }} />
              )}
            </div>
            <span className="mono-sm" style={{ color: isToday ? 'var(--green)' : 'var(--text-2)', fontWeight: isToday ? 700 : 400, fontSize: 9, whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Heartbeat({ flashCount }) {
  const active = flashCount > 0
  return (
    <svg width="80" height="24" viewBox="0 0 80 24">
      <polyline
        points="0,12 8,12 13,4 18,20 23,12 31,12 36,2 41,22 46,12 54,12 59,7 64,17 69,12 80,12"
        fill="none"
        stroke={active ? 'var(--flash)' : 'var(--green)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={active ? 1 : 0.4}
        style={{ animation: active ? 'heartbeat 1.2s ease-in-out infinite' : 'none' }}
      />
    </svg>
  )
}

export function ThreatPulse({ stats, sweeping }) {
  const [pulse, setPulse] = useState(null)

  const load = () => {
    const tz = new Date().getTimezoneOffset()
    fetch(`/api/pulse?tz_offset=${tz}`)
      .then(r => r.json())
      .then(setPulse)
      .catch(() => {})
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (!sweeping) load() }, [sweeping])

  const days         = pulse?.days || []
  const totalSignals = days.reduce((s, d) => s + d.total, 0)
  const flashDays    = days.filter(d => d.flash > 0).length

  return (
    <div className="pulse-card span-4">
      <div>
        <div className="label" style={{ marginBottom: 10 }}>7-day activity</div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div>
            <div className="pulse-value">{totalSignals}</div>
            <div className="pulse-sub">30-day total</div>
          </div>
          {flashDays > 0 && (
            <div>
              <div className="pulse-value" style={{ color: 'var(--flash-text)' }}>{flashDays}</div>
              <div className="pulse-sub">flash days</div>
            </div>
          )}
        </div>
      </div>

      <WeekBars days={days} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div className="label">Flash activity</div>
        <Heartbeat flashCount={stats?.flash_count || 0} />
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { color: 'var(--flash)',    opacity: 0.85, label: 'Flash' },
            { color: 'var(--priority)', opacity: 0.60, label: 'Priority' },
            { color: 'var(--green)',    opacity: 0.30, label: 'Routine' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, background: l.color, opacity: l.opacity, display: 'inline-block', flexShrink: 0 }} />
              <span className="mono-sm">{l.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
