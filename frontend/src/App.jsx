import './index.css'
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useIvar } from './hooks/useIvar'
import { Header }     from './components/Header'
import { Footer }     from './components/Footer'
import { StatsBar }   from './components/StatsBar'
import { SignalList }  from './components/SignalList'
import { Sidebar }    from './components/Sidebar'
import { EmptyState } from './components/EmptyState'
import { ThreatPulse } from './components/ThreatPulse'
import Settings from './pages/Settings'
import Activity from './pages/Activity'
import Profile  from './pages/Profile'

function LoginPage({ onLogin }) {
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [totpCode, setTotpCode]   = useState('')
  const [needs2fa, setNeeds2fa]   = useState(false)
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await onLogin(username, password, needs2fa ? totpCode : undefined)
      if (res?.requires_2fa) {
        setNeeds2fa(true)
      }
    } catch (err) {
      if (needs2fa) {
        setError('Invalid 2FA code')
      } else {
        setError('Invalid username or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--green)' }}>
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.45"/>
            <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.28"/>
            <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.18"/>
            <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
            <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.28"/>
            <line x1="16" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.28"/>
            <g style={{ transformOrigin: '16px 16px' }}>
              <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 16 L16 2 A14 14 0 0 1 27.8 22.5" fill="currentColor" fillOpacity="0.08"/>
            </g>
            <circle cx="21" cy="7" r="1.4" fill="currentColor" fillOpacity="0.85"/>
            <circle cx="9" cy="22" r="0.9" fill="currentColor" fillOpacity="0.5"/>
          </svg>
          <div>
            <div className="login-title">IVAR</div>
            <div className="login-subtitle">Intelligence Visualization &amp; Analysis Radar</div>
          </div>
        </div>
        <form className="login-form" onSubmit={handle}>
          {!needs2fa ? (
            <>
              <div className="field">
                <label className="field-label">Username</label>
                <input className="input" type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus autoComplete="username" required />
              </div>
              <div className="field">
                <label className="field-label">Password</label>
                <input className="input" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required />
              </div>
            </>
          ) : (
            <div className="field">
              <label className="field-label">Authenticator code</label>
              <div className="field-hint">Enter the 6-digit code from your authenticator app</div>
              <input className="input" type="text" value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                autoFocus maxLength={6} placeholder="000000" required />
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Signing in...' : needs2fa ? 'Verify' : 'Sign in'}
          </button>
          {needs2fa && (
            <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setNeeds2fa(false); setTotpCode(''); setError(null) }}>
              Back
            </button>
          )}
          {!needs2fa && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--sz-sm)', color: 'var(--text-2)' }}>
              Forgot your password? Contact your IVAR administrator.
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function ChangePasswordPage({ user, onSave, onLogout }) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(null)
    if (next.length < 12)  { setError('Password must be at least 12 characters'); return }
    if (next !== confirm)  { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await onSave({ current_password: current, new_password: next })
    } catch (err) {
      setError(err.message?.includes('401') || err.message?.includes('400')
        ? 'Current password is incorrect'
        : `Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" style={{ color: 'var(--green)' }}>
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.45"/>
            <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.28"/>
            <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.18"/>
            <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
            <g style={{ transformOrigin: '16px 16px' }}>
              <line x1="16" y1="16" x2="16" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 16 L16 2 A14 14 0 0 1 27.8 22.5" fill="currentColor" fillOpacity="0.08"/>
            </g>
            <circle cx="21" cy="7" r="1.4" fill="currentColor" fillOpacity="0.85"/>
          </svg>
          <div>
            <div className="login-title">Set your password</div>
            <div className="login-subtitle">You must set a new password before continuing</div>
          </div>
        </div>
        <form className="login-form" onSubmit={handle}>
          <div className="field">
            <label className="field-label">Current password</label>
            <input className="input" type="password" value={current}
              onChange={e => setCurrent(e.target.value)}
              autoFocus autoComplete="current-password" required />
          </div>
          <div className="field">
            <label className="field-label">New password</label>
            <input className="input" type="password" value={next}
              onChange={e => setNext(e.target.value)}
              placeholder="Minimum 12 characters"
              autoComplete="new-password" required />
          </div>
          <div className="field">
            <label className="field-label">Confirm new password</label>
            <input className="input" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Saving...' : 'Set password and continue'}
          </button>
          <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

function DemoBanner() {
  return (
    <div className="demo-banner">
      <span>Live demo — changes are disabled.</span>
      <a href="https://github.com/YvonLabs/ivar" target="_blank" rel="noreferrer">
        Self-host your own instance →
      </a>
    </div>
  )
}

function Dashboard({
  stats, signals, sweeps, loading, sweeping, error,
  filter, setFilter, severity, setSeverity,
  stackOnly, setStackOnly, triggerSweep, reviewSignal,
  isMember,
}) {
  const isFirstRun = !loading && (stats?.total_signals ?? 0) === 0

  return (
    <main className="page">
      <div className="dashboard-grid">
        {error && <div className="error-bar">⚠ Cannot reach IVAR backend — {error}</div>}
        <ThreatPulse stats={stats} sweeping={sweeping} />
        <StatsBar stats={stats} />
        <div className="span-3">
          {isFirstRun ? (
            <div className="card">
              <EmptyState sweeping={sweeping} onSweep={isMember ? triggerSweep : null} />
            </div>
          ) : (
            <SignalList
              signals={signals}
              filter={filter}
              severity={severity}
              stackOnly={stackOnly}
              stats={stats}
              onFilterChange={setFilter}
              onSeverityChange={setSeverity}
              onStackOnlyChange={setStackOnly}
              onReview={isMember ? reviewSignal : null}
              loading={loading}
              readOnly={!isMember}
            />
          )}
        </div>
        <Sidebar stats={stats} sweeps={sweeps} />
      </div>
    </main>
  )
}

function AppInner() {
  const {
    user, authed, authLoading, login, logout, updateProfile,
    isAdmin, isMember, isDemo,
    stats, signals, audit, sweeps,
    loading, sweeping, error,
    filter, setFilter,
    severity, setSeverity,
    stackOnly, setStackOnly,
    triggerSweep, reviewSignal,
  } = useIvar()

  if (authLoading) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p className="mono-sm">loading...</p>
      </div>
    )
  }

  if (!authed) return <LoginPage onLogin={login} />

  if (user?.must_change_password) {
    return <ChangePasswordPage user={user} onSave={updateProfile} onLogout={logout} />
  }

  return (
    <div className="app">
      {isDemo && <DemoBanner />}
      <Header
        stats={stats}
        sweeping={sweeping}
        onSweep={isMember ? triggerSweep : null}
        isDemo={isDemo}
        user={user}
        onLogout={logout}
      />
      <Routes>
        <Route path="/" element={
          <Dashboard
            stats={stats} signals={signals} sweeps={sweeps}
            loading={loading} sweeping={sweeping} error={error}
            filter={filter} setFilter={setFilter}
            severity={severity} setSeverity={setSeverity}
            stackOnly={stackOnly} setStackOnly={setStackOnly}
            triggerSweep={triggerSweep} reviewSignal={reviewSignal}
            isMember={isMember}
          />
        } />
        <Route path="/activity" element={<Activity audit={audit} sweeps={sweeps} />} />
        <Route path="/settings" element={<Settings isAdmin={isAdmin} />} />
        <Route path="/profile"  element={<Profile user={user} updateProfile={updateProfile} />} />
      </Routes>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
