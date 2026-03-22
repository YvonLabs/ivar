import { auth } from '../lib/api'

function fmtTs(iso) {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

const ACTION_TAG = {
  reviewed:  'tag tag-routine',
  dismissed: 'tag',
  escalated: 'tag tag-flash',
  pending:   'tag tag-pending',
}

async function downloadCsv() {
  const token = auth.getToken()
  const res = await fetch('/api/activity/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'ivar-activity.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Activity({ audit, sweeps }) {
  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 'var(--sz-xl)', fontWeight: 700, color: 'var(--text-0)' }}>Activity</div>
          <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', marginTop: 3 }}>Signal review history and sweep log</p>
        </div>
        <button className="btn btn-sm" onClick={downloadCsv}>
          Export CSV
        </button>
      </div>

      <div className="activity-grid">
        <div className="card">
          <div className="card-header">
            <span className="label">Review history</span>
            <span className="mono-sm" style={{ marginLeft: 'auto' }}>{audit.length} entries</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            {audit.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>No reviews yet. Action signals from the dashboard.</p>
              </div>
            ) : audit.map(entry => (
              <div key={entry.id} className="activity-row">
                <span className="mono-sm" style={{ paddingTop: 2 }}>{fmtTs(entry.timestamp)}</span>
                <div>
                  <div style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-0)', marginBottom: 2 }}>
                    {entry.signal_title || entry.signal_id}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', fontStyle: 'italic' }}>{entry.notes}</div>
                  )}
                  <div className="mono-sm" style={{ marginTop: 2 }}>by {entry.reviewer}</div>
                </div>
                <span className={ACTION_TAG[entry.action?.split('→')[1]?.trim()] || ACTION_TAG[entry.action] || 'tag'}>
                  {entry.action}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="label">Sweep log</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            {sweeps.length === 0 ? (
              <div className="card-body">
                <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>No sweeps run yet.</p>
              </div>
            ) : sweeps.map(s => (
              <div key={s.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-0)' }}>
                <div className="mono-sm" style={{ marginBottom: 8 }}>{fmtTs(s.started_at)}</div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 'var(--sz-lg)', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--green)', lineHeight: 1 }}>
                      {s.signals_new ?? 0}
                    </div>
                    <div className="stat-sub">new</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--sz-lg)', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-0)', lineHeight: 1 }}>
                      {s.signals_found ?? 0}
                    </div>
                    <div className="stat-sub">found</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(s.sources || []).map(src => (
                    <span key={src} className="tag">{src.replace(/_/g, ' ')}</span>
                  ))}
                </div>
                {s.errors?.length > 0 && s.errors.map((e, i) => (
                  <div key={i} style={{ marginTop: 6, fontSize: 'var(--sz-xs)', color: 'var(--priority-text)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    ⚠ {e.source}: {String(e.error).slice(0, 60)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
