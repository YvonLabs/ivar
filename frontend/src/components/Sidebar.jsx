import { useState, useEffect } from 'react'

function fmtTs(iso) {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function Sidebar({ stats, sweeps }) {
  const [feeds, setFeeds] = useState([])

  useEffect(() => {
    fetch('/api/feeds')
      .then(r => r.json())
      .then(d => setFeeds(d.feeds || []))
      .catch(() => {})
  }, [])

  const enabledFeeds = feeds.filter(f => f.enabled)
  const disabledCount = feeds.filter(f => !f.enabled).length
  const lastSweep = sweeps?.[0]

  return (
    <div className="sidebar span-1">

      <div className="card">
        <div className="card-header">
          <span className="label">Feed status</span>
        </div>
        <div style={{ padding: '4px 0' }}>
          {enabledFeeds.length === 0 ? (
            <div className="card-body">
              <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>No feeds enabled.</p>
            </div>
          ) : enabledFeeds.map(f => (
            <div key={f.id} className="sidebar-feed-row" style={{ padding: '8px var(--sp-4)' }}>
              <span className={`feed-dot feed-dot-${f.last_error ? 'err' : 'ok'}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="feed-name">{f.display_name}</div>
                {f.last_fetched && (
                  <div className="feed-time">{fmtTs(f.last_fetched)}</div>
                )}
                {f.last_error && (
                  <div className="feed-error">
                    {f.last_error.includes('403')
                      ? 'Blocked by source (403) — server IP not allowed'
                      : f.last_error.slice(0, 70)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {disabledCount > 0 && (
            <div style={{ padding: '6px var(--sp-4)' }}>
              <span className="mono-sm">{disabledCount} feed{disabledCount !== 1 ? 's' : ''} disabled</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="label">Last sweep</span>
        </div>
        <div className="card-body">
          {lastSweep ? (
            <>
              <div className="mono-sm" style={{ marginBottom: 10 }}>
                {fmtTs(lastSweep.started_at)}
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 'var(--sz-xl)', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--green)', lineHeight: 1 }}>
                    {lastSweep.signals_new ?? 0}
                  </div>
                  <div className="stat-sub">new</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--sz-xl)', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-0)', lineHeight: 1 }}>
                    {lastSweep.signals_found ?? 0}
                  </div>
                  <div className="stat-sub">found</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(lastSweep.sources || []).map(s => (
                  <span key={s} className="tag">{s.replace(/_/g, ' ')}</span>
                ))}
              </div>
              {lastSweep.errors?.length > 0 && lastSweep.errors.map((e, i) => (
                <div key={i} className="feed-error" style={{ marginTop: 8 }}>
                  ⚠ {e.source}: {String(e.error).slice(0, 60)}
                </div>
              ))}
            </>
          ) : (
            <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>No sweeps yet.</p>
          )}
        </div>
      </div>

        </div>

  )
}
