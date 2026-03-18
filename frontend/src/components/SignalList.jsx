import { useState } from 'react'

const stripHtml = t => t ? t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    .toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function SevIndicator({ severity }) {
  const s = (severity || 'ROUTINE').toUpperCase()
  return (
    <div className="sev">
      <span className={`sev-dot sev-dot-${s.toLowerCase()}`} />
      <span className={`sev-label sev-label-${s.toLowerCase()}`}>{s}</span>
    </div>
  )
}

const ACTIONS = [
  { action: 'reviewed',  label: '✓ Reviewed',  cls: 'btn btn-sm btn-primary' },
  { action: 'escalated', label: '⚑ Escalate',  cls: 'btn btn-sm btn-danger' },
  { action: 'dismissed', label: '✕ Dismiss',   cls: 'btn btn-sm btn-ghost' },
  { action: 'pending',   label: '↩ Reopen',    cls: 'btn btn-sm btn-ghost' },
]

function SignalCard({ signal, onReview }) {
  const [open, setOpen]         = useState(false)
  const [actioning, setActioning] = useState(null)
  const [toast, setToast]       = useState(null)

  const handle = async (action) => {
    if (actioning) return
    setActioning(action)
    try {
      await onReview(signal.id, action)
      setToast(action)
      setTimeout(() => setToast(null), 2000)
    } finally {
      setActioning(null)
    }
  }

  const isDone = signal.status !== 'pending'

  return (
    <div className={`signal-row${isDone ? ' done' : ''}`}>
      {toast && <div className="signal-toast">✓ {toast}</div>}

      <div className="signal-top" onClick={() => setOpen(o => !o)}>
        <SevIndicator severity={signal.severity} />
        <span className="signal-title">{stripHtml(signal.title)}</span>
        <span className="signal-expand-icon">{open ? '−' : '+'}</span>
      </div>

      <div className="signal-meta" onClick={() => setOpen(o => !o)}>
        <span className="tag">{signal.source}</span>
        {signal.cve_id && <span className="tag mono-sm">{signal.cve_id}</span>}
        <span className="mono-sm">{fmtDate(signal.published_at)}</span>
        {signal.stack_match && <span className="tag tag-green">stack match</span>}
        {signal.triage_method?.includes('claude') && <span className="tag tag-green">◈ claude</span>}
        {signal.triage_method?.includes('openai') && <span className="tag tag-green">◈ openai</span>}
        <span className={`status-pill status-${signal.status}`} style={{ marginLeft: 'auto' }}>
          {signal.status}
        </span>
      </div>

      {open && (
        <div className="signal-detail">
          {signal.triage_summary && (
            <div className="triage-box">
              <div className="triage-label">
                Triage · {(signal.triage_method || '').replace(/_/g, ' ')}
                {signal.triage_confidence
                  ? ` · ${Math.round(signal.triage_confidence * 100)}% confidence`
                  : ''}
              </div>
              <div className="triage-text">{stripHtml(signal.triage_summary)}</div>
            </div>
          )}

          {signal.description && (
            <p className="signal-description">
              {stripHtml(signal.description).slice(0, 420)}
              {stripHtml(signal.description).length > 420 ? '...' : ''}
            </p>
          )}

          <div className="signal-actions">
            {ACTIONS.filter(a => a.action !== signal.status).map(a => (
              <button
                key={a.action}
                className={a.cls}
                onClick={() => handle(a.action)}
                disabled={!!actioning}
              >
                {actioning === a.action ? '...' : a.label}
              </button>
            ))}
            {signal.url && (
              <a
                href={signal.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 'auto' }}
              >
                source ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SignalList({
  signals, filter, severity, stackOnly, stats,
  onFilterChange, onSeverityChange, onStackOnlyChange,
  onReview, loading,
}) {
  const severities = [
    { v: '',         l: 'All' },
    { v: 'FLASH',    l: 'Flash' },
    { v: 'PRIORITY', l: 'Priority' },
    { v: 'ROUTINE',  l: 'Routine' },
  ]

  const filters = [
    { v: 'pending',   l: 'Pending',   count: stats?.pending_review   || 0 },
    { v: 'reviewed',  l: 'Reviewed',  count: stats?.reviewed_count   || 0 },
    { v: 'escalated', l: 'Escalated', count: stats?.escalated_count  || 0 },
    { v: 'dismissed', l: 'Dismissed', count: stats?.dismissed_count  || 0 },
  ]

  return (
    <div className="card">
      <div className="signals-header">
        <span className="label">Signals</span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
          {severities.map(s => (
            <button
              key={s.v}
              className={`btn btn-sm btn-ghost${severity === s.v ? ' btn-active' : ''}`}
              onClick={() => onSeverityChange(s.v)}
            >
              {s.l}
            </button>
          ))}
        </div>

        <button
          className={`btn btn-sm btn-ghost${stackOnly ? ' btn-active' : ''}`}
          onClick={() => onStackOnlyChange(!stackOnly)}
        >
          ◈ Stack only
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {filters.map(f => (
            <button
              key={f.v}
              className={`btn btn-sm btn-ghost${filter === f.v ? ' btn-active' : ''}`}
              onClick={() => onFilterChange(f.v)}
            >
              {f.l}
              {f.count > 0 && (
                <span style={{
                  marginLeft: 4,
                  fontSize: 9,
                  fontFamily: 'IBM Plex Mono, monospace',
                  background: f.v === 'dismissed' ? 'var(--surface-2)' : f.v === 'escalated' ? 'var(--flash-dim)' : 'var(--green-dim)',
                  color: f.v === 'dismissed' ? 'var(--text-2)' : f.v === 'escalated' ? 'var(--flash-text)' : 'var(--green)',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="signals-body">
        {loading ? (
          <div className="empty">
            <p className="mono-sm">loading...</p>
          </div>
        ) : signals.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 32, opacity: 0.15, marginBottom: 12 }}>◎</div>
            <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>
              {filter === 'pending'
                ? 'No pending signals. Run a sweep to pull live data.'
                : `No ${filter} signals.`}
            </p>
            {stackOnly && (
              <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', marginTop: 6 }}>
                Stack filter is active.
              </p>
            )}
          </div>
        ) : (
          signals.map(s => (
            <SignalCard key={s.id} signal={s} onReview={onReview} />
          ))
        )}
      </div>
    </div>
  )
}
