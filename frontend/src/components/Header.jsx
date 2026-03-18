import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

function RadarLogo({ sweeping }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--green)' }}>
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.45"/>
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.28"/>
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.18"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.28"/>
      <line x1="16" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.28"/>
      <g style={{
        transformOrigin: '16px 16px',
        animation: sweeping ? 'radar-sweep 1.4s linear infinite' : 'none',
      }}>
        <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 16 L16 2 A14 14 0 0 1 27.8 22.5" fill="currentColor" fillOpacity="0.08"/>
      </g>
      <circle cx="21" cy="7" r="1.4" fill="currentColor" fillOpacity="0.85"/>
      <circle cx="9" cy="22" r="0.9" fill="currentColor" fillOpacity="0.5"/>
    </svg>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('ivar-theme')
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
      setDark(false)
    }
  }, [])

  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('ivar-theme', next)
    setDark(!dark)
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={toggle}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{ fontSize: 15, color: 'var(--text-1)', padding: '4px 8px' }}
    >
      {dark ? '☀' : '☾'}
    </button>
  )
}

function timeSince(isoStr) {
  const diff = Date.now() - new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z').getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function Header({ stats, sweeping, onSweep }) {
  const location  = useLocation()
  const lastSweep = stats?.last_sweep ? timeSince(stats.last_sweep) : 'never'

  const navItems = [
    { to: '/',         label: 'Dashboard' },
    { to: '/activity', label: 'Activity' },
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <header className="header">
      <div className="header-brand">
        <RadarLogo sweeping={sweeping} />
        <div className="header-wordmark">
          <span className="header-title">IVAR</span>
          <span className="header-subtitle">Intelligence Visualization &amp; Analysis Radar</span>
        </div>
      </div>

      <div className="header-divider" />

      <nav className="header-nav">
        {navItems.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-link${location.pathname === to ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="header-actions">
        <ThemeToggle />
        <div className="sweep-status">
          <span className="sweep-dot" style={{ opacity: sweeping ? 1 : 0.7 }} />
          {sweeping ? 'sweeping...' : `swept ${lastSweep}`}
        </div>
        <button
          className="btn btn-sm"
          onClick={onSweep}
          disabled={sweeping}
        >
          <span style={{ display: 'inline-block', animation: sweeping ? 'spin 1s linear infinite' : 'none' }}>
            ⟳
          </span>
          Sweep
        </button>
      </div>
    </header>
  )
}
