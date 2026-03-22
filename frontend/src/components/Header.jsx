import { useState, useEffect, useRef } from 'react'
import { UserAvatar } from '../pages/Profile'
import { Link, useLocation, useNavigate } from 'react-router-dom'

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

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5 2H2.5C2.22 2 2 2.22 2 2.5v9c0 .28.22.5.5.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M9.5 4.5L12 7l-2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="7" x2="5.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

// Role dot: green = admin, amber = member, gray = viewer
function RoleDot({ role }) {
  const color = role === 'admin'
    ? 'var(--green)'
    : role === 'member'
    ? 'var(--priority)'
    : 'var(--text-3)'
  return (
    <span
      title={role}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
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

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="user-menu" ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}
      >
        {user.avatar
          ? <UserAvatar avatarId={user.avatar} size={20} color="var(--green)" />
          : <RoleDot role={user.role} />
        }
        <span className="mono-sm" style={{ color: 'var(--text-1)' }}>{user.username}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface-0)',
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--r-lg)',
          padding: '4px',
          minWidth: 140,
          zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 10px' }}
            onClick={() => { setOpen(false); navigate('/profile') }}
          >
            Profile
          </button>
          <div style={{ height: 1, background: 'var(--border-0)', margin: '4px 0' }} />
          {!user?.demo && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 10px', color: 'var(--flash-text)' }}
              onClick={() => { setOpen(false); onLogout() }}
            >
              <SignOutIcon /> Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Header({ stats, sweeping, onSweep, isDemo, user, onLogout }) {
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

        {(onSweep || isDemo) && (
          <>
            <div className="sweep-status">
              <span className="sweep-dot" style={{ opacity: sweeping ? 1 : 0.7 }} />
              {sweeping ? 'sweeping...' : `swept ${lastSweep}`}
            </div>
            <button
             className="btn btn-sm"
             onClick={onSweep || undefined}
             disabled={sweeping || !onSweep}
             title={isDemo && !onSweep ? 'Sweep disabled in demo mode' : undefined}
            >
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ flexShrink: 0 }}
              >
                <path d="M13 7A6 6 0 1 1 7 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <polyline points="7,1 10,1 10,4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="sweep-btn-label">Sweep</span>
            </button>
          </>
        )}

        {user && <UserMenu user={user} onLogout={onLogout} />}
      </div>
    </header>
  )
}
