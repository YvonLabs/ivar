export function EmptyState({ sweeping, onSweep }) {
  return (
    <div className="empty">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.3 }}>
        <circle cx="24" cy="24" r="22" stroke="#4CC87A" strokeWidth="0.75"/>
        <circle cx="24" cy="24" r="14" stroke="#4CC87A" strokeWidth="0.5" strokeOpacity="0.6"/>
        <circle cx="24" cy="24" r="7"  stroke="#4CC87A" strokeWidth="0.5" strokeOpacity="0.4"/>
        <circle cx="24" cy="24" r="2"  fill="#4CC87A"/>
        <line x1="24" y1="24" x2="24" y2="2"  stroke="#4CC87A" strokeWidth="0.75" strokeOpacity="0.3"/>
        <line x1="24" y1="24" x2="46" y2="24" stroke="#4CC87A" strokeWidth="0.75" strokeOpacity="0.3"/>
      </svg>
      <div className="empty-title">No signals yet</div>
      <p className="empty-body">
        Run your first sweep to pull intelligence from your enabled feeds. Takes 15 to 30 seconds.
      </p>
      <button
        className="btn btn-primary"
        onClick={onSweep}
        disabled={sweeping}
        style={{ padding: '8px 24px' }}
      >
        {sweeping ? '⟳ Sweeping...' : '⟳ Run first sweep'}
      </button>
    </div>
  )
}
