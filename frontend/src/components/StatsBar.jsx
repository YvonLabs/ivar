export function StatsBar({ stats }) {
  const cards = [
    {
      label:  'Flash',
      dot:    'sev-dot-flash',
      value:  stats?.flash_count   ?? 0,
      sub:    'Active exploitation',
      color:  stats?.flash_count > 0 ? 'var(--flash-text)' : null,
    },
    {
      label:  'Pending',
      dot:    'sev-dot-priority',
      value:  stats?.pending_review ?? 0,
      sub:    'Awaiting review',
      color:  stats?.pending_review > 3 ? 'var(--priority-text)' : null,
    },
    {
      label:  'Total signals',
      dot:    null,
      value:  stats?.total_signals  ?? 0,
      sub:    'In database',
      color:  null,
    },
    {
      label:  'Stack matches',
      dot:    null,
      value:  stats?.stack_matches  ?? 0,
      sub:    'Directly relevant',
      color:  'var(--green)',
    },
  ]

  return (
    <>
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-label">
            {c.dot && <span className={`sev-dot ${c.dot}`} />}
            {c.label}
          </div>
          <div className="stat-value" style={c.color ? { color: c.color } : {}}>
            {c.value}
          </div>
          <div className="stat-sub">{c.sub}</div>
        </div>
      ))}
    </>
  )
}
