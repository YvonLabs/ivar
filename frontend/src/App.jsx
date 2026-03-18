import './index.css'
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

function Dashboard({
  stats, signals, sweeps, loading, sweeping, error,
  filter, setFilter, severity, setSeverity,
  stackOnly, setStackOnly, triggerSweep, reviewSignal,
}) {
  const isFirstRun = !loading && (stats?.total_signals ?? 0) === 0

  return (
    <main className="page">
      <div className="dashboard-grid">

        {error && <div className="error-bar">⚠ Cannot reach IVAR backend — {error}</div>}

        {/* Row 1: Pulse card — spans all 4 columns */}
        <ThreatPulse stats={stats} sweeping={sweeping} />

        {/* Row 2: 4 stat cards — one per column */}
        <StatsBar stats={stats} />

        {/* Row 3: Signal feed (3 cols) + Sidebar (1 col) */}
        <div className="span-3">
          {isFirstRun ? (
            <div className="card">
              <EmptyState sweeping={sweeping} onSweep={triggerSweep} />
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
              onReview={reviewSignal}
              loading={loading}
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
    stats, signals, audit, sweeps,
    loading, sweeping, error,
    filter, setFilter,
    severity, setSeverity,
    stackOnly, setStackOnly,
    triggerSweep, reviewSignal,
  } = useIvar()

  return (
    <div className="app">
      <Header stats={stats} sweeping={sweeping} onSweep={triggerSweep} />
      <Routes>
        <Route path="/" element={
          <Dashboard
            stats={stats} signals={signals} sweeps={sweeps}
            loading={loading} sweeping={sweeping} error={error}
            filter={filter} setFilter={setFilter}
            severity={severity} setSeverity={setSeverity}
            stackOnly={stackOnly} setStackOnly={setStackOnly}
            triggerSweep={triggerSweep} reviewSignal={reviewSignal}
          />
        } />
        <Route path="/activity" element={<Activity audit={audit} sweeps={sweeps} />} />
        <Route path="/settings" element={<Settings />} />
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
