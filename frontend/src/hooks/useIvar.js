import { useState, useEffect, useCallback, useRef } from 'react'
import { api, auth } from '../lib/api'

export function useIvar() {
  const [user, setUser]               = useState(null)
  const [authed, setAuthed]           = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

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

  // ── Auth check on mount ───────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      try {
        const me = await api.me()
        setUser(me)
        setAuthed(true)
      } catch (e) {
        setAuthed(false)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (username, password, totp_code) => {
    const res = await api.login(username, password, totp_code)
    if (res.requires_2fa) return res
    auth.setToken(res.token)
    const me = await api.me()
    setUser(me)
    setAuthed(true)
    return me
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.logout() } catch (e) {}
    auth.clearToken()
    sessionStorage.removeItem('ivar-demo-token')
    setUser(null)
    setAuthed(false)
    setStats(null)
    setSignals([])
    setAudit([])
    setSweeps([])
  }

  // ── Update own profile ────────────────────────────────────────────────────
  const updateProfile = async (body) => {
    const res = await api.updateProfile(body)
    // Refresh user state from server
    const me = await api.me()
    setUser(me)
    return res
  }

  // ── Load all data ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const params = {}
      if (filter)    params.status      = filter
      if (severity)  params.severity    = severity
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
      if (e.message.startsWith('401')) {
        setAuthed(false)
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, severity, stackOnly])

  useEffect(() => {
    if (authed && !user?.must_change_password) loadAll()
  }, [authed, loadAll, user?.must_change_password])

  // ── Sweep polling ─────────────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const triggerSweep = async () => {
    setSweeping(true)
    await api.sweep()
  }

  const reviewSignal = async (id, action, notes = '') => {
    setSignals(prev => prev.map(s =>
      s.id === id ? { ...s, status: action } : s
    ))
    try {
      await api.review(id, { action, notes })
    } catch (e) {
      setSignals(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'pending' } : s
      ))
      throw e
    }
    await loadAll()
  }

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isAdmin  = user?.role === 'admin'
  const isMember = user?.role === 'member' || isAdmin
  const isViewer = !!user
  const isDemo   = user?.demo === true

  return {
    // Auth
    user, authed, authLoading, login, logout, updateProfile,
    isAdmin, isMember, isViewer, isDemo,

    // Data
    stats, config, signals, audit, sweeps,
    loading, sweeping, error,

    // Filters
    filter, setFilter,
    severity, setSeverity,
    stackOnly, setStackOnly,

    // Actions
    triggerSweep, reviewSignal, reload: loadAll,
  }
}
