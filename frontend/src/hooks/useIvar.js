import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

export function useIvar() {
  const [stats, setStats]         = useState(null)
  const [config, setConfig]       = useState(null)
  const [signals, setSignals]     = useState([])
  const [audit, setAudit]         = useState([])
  const [sweeps, setSweeps]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [sweeping, setSweeping]   = useState(false)
  const [error, setError]         = useState(null)
  const [filter, setFilter]       = useState('pending')
  const [severity, setSeverity]   = useState('')
  const [stackOnly, setStackOnly] = useState(false)
  const pollRef = useRef(null)

  const loadAll = useCallback(async () => {
    try {
      const params = {}
      if (filter) params.status = filter
      if (severity) params.severity = severity
      if (stackOnly) params.stack_match = 'true'
      const [s, c, sig, a, sw] = await Promise.all([
        api.stats(),
        api.config(),
        api.signals(params),
        api.audit(),
        api.sweeps(),
      ])
      setStats(s)
      setConfig(c)
      setSignals(sig.signals)
      setAudit(a.log)
      setSweeps(sw.sweeps)
      setSweeping(s.sweep_running)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter, severity, stackOnly])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (sweeping) {
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.stats()
          setStats(s)
          if (!s.sweep_running) {
            setSweeping(false)
            clearInterval(pollRef.current)
            loadAll()
          }
        } catch (e) {}
      }, 3000)
    }
    return () => clearInterval(pollRef.current)
  }, [sweeping, loadAll])

  const triggerSweep = async () => {
    setSweeping(true)
    await api.sweep()
  }

  const reviewSignal = async (id, action, notes = '') => {
    await api.review(id, { action, notes, reviewer: 'admin' })
    setSignals(prev => prev.map(s =>
      s.id === id ? { ...s, status: action } : s
    ))
    const s = await api.stats()
    setStats(s)
    const a = await api.audit()
    setAudit(a.log)
  }

  return {
    stats, config, signals, audit, sweeps,
    loading, sweeping, error,
    filter, setFilter,
    severity, setSeverity,
    stackOnly, setStackOnly,
    triggerSweep, reviewSignal, reload: loadAll,
  }
}
