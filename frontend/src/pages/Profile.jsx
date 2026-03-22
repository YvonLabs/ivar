import { useState, useEffect } from 'react'
import { api } from '../lib/api'

// ── Nordic avatars ────────────────────────────────────────────────────────────
// 6 custom SVG avatars in IVAR's Nordic Precision aesthetic

const AVATARS = [
  {
    id: 'rune',
    label: 'Tiwaz',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <line x1="20" y1="6" x2="20" y2="34" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="20" y1="14" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="20" y1="14" x2="28" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'vegvisir',
    label: 'Vegvísir',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <circle cx="20" cy="20" r="2.5" fill={color}/>
        {[0,45,90,135,180,225,270,315].map((deg, i) => {
          const r = deg * Math.PI / 180
          const x1 = 20 + 4 * Math.cos(r)
          const y1 = 20 + 4 * Math.sin(r)
          const x2 = 20 + 13 * Math.cos(r)
          const y2 = 20 + 13 * Math.sin(r)
          const fork = i % 2 === 0
          return (
            <g key={deg}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
              {fork && (
                <>
                  <line x1={x2} y1={y2} x2={20 + 16 * Math.cos(r - 0.4)} y2={20 + 16 * Math.sin(r - 0.4)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1={x2} y1={y2} x2={20 + 16 * Math.cos(r + 0.4)} y2={20 + 16 * Math.sin(r + 0.4)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                </>
              )}
            </g>
          )
        })}
      </svg>
    ),
  },
  {
    id: 'wolf',
    label: 'Fenrir',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <path d="M13 28 L20 12 L27 28" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M15.5 23 L24.5 23" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M13 28 L10 24 L13 20" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M27 28 L30 24 L27 20" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="17" cy="18" r="1.2" fill={color}/>
        <circle cx="23" cy="18" r="1.2" fill={color}/>
      </svg>
    ),
  },
  {
    id: 'raven',
    label: 'Huginn',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <path d="M22 12 C26 12 30 15 29 19 C28 22 25 22 23 24 L20 30 L17 24 C14 22 12 20 13 17 C14 14 18 12 22 12Z" stroke={color} strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
        <path d="M22 12 L25 9 L24 13" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="15" r="1.2" fill={color}/>
        <line x1="20" y1="24" x2="16" y2="28" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="24" x2="20" y2="29" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="24" x2="24" y2="28" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'serpent',
    label: 'Jörmungandr',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <path d="M20 10 C28 10 30 14 30 20 C30 27 25 30 20 30 C15 30 10 27 10 20 C10 14 12 10 20 10" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M20 10 C18 8 16 9 17 11" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <circle cx="19" cy="9" r="1" fill={color}/>
        <circle cx="22" cy="9" r="1" fill={color}/>
        <path d="M20 10 L18 12 M20 10 L22 12" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'yggdrasil',
    label: 'Yggdrasil',
    svg: (color) => (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke={color} strokeWidth="1" strokeOpacity="0.3"/>
        <line x1="20" y1="30" x2="20" y2="12" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="20" y1="22" x2="12" y2="16" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="22" x2="28" y2="16" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="17" x2="14" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="17" x2="26" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="20" y1="26" x2="14" y2="30" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
        <line x1="20" y1="26" x2="26" y2="30" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
        <circle cx="20" cy="12" r="1.5" fill={color}/>
      </svg>
    ),
  },
]

function AvatarPicker({ selected, onChange }) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 8 }}>Avatar</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {AVATARS.map(a => {
          const active = selected === a.id
          return (
            <button
              key={a.id}
              onClick={() => onChange(a.id)}
              title={a.label}
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--r-lg)',
                border: `1.5px solid ${active ? 'var(--green)' : 'var(--border-2)'}`,
                background: active ? 'var(--green-dim)' : 'var(--surface-1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                transition: 'all 0.12s',
              }}
            >
              {a.svg(active ? 'var(--green)' : 'var(--text-2)')}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="mono-sm" style={{ marginTop: 6 }}>
          {AVATARS.find(a => a.id === selected)?.label}
        </div>
      )}
    </div>
  )
}

// Public avatar display for use in Header etc.
export function UserAvatar({ avatarId, size = 28, color = 'var(--green)' }) {
  const avatar = AVATARS.find(a => a.id === avatarId)
  if (!avatar) return null
  return (
    <span style={{
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {avatar.svg(color)}
    </span>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <div className="field-hint">{hint}</div>}
      {children}
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="settings-section">
      <div className="settings-header">
        <span className="settings-title">{title}</span>
        {subtitle && <span className="settings-sub">{subtitle}</span>}
      </div>
      <div className="settings-body">{children}</div>
    </div>
  )
}

const ROLE_DESC = {
  admin:  'Full access including settings, feeds, and user management',
  member: 'Can review signals and run sweeps',
  viewer: 'Read-only access to signals and activity',
}

export default function Profile({ user, updateProfile }) {
  const [username, setUsername] = useState(user?.username || '')
  const [title, setTitle]       = useState(user?.title    || '')
  const [avatar, setAvatar]     = useState(user?.avatar   || '')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState(null)

  const [pw, setPw]             = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved]   = useState(false)
  const [pwError, setPwError]   = useState(null)

  const [totpEnabled, setTotpEnabled] = useState(user?.totp_enabled || false)
  const [totpQr, setTotpQr]           = useState(null)
  const [totpSecret, setTotpSecret]   = useState(null)
  const [totpCode, setTotpCode]       = useState('')
  const [totpError, setTotpError]     = useState(null)
  const [totpSaved, setTotpSaved]     = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableError, setDisableError]       = useState(null)
  const [recoveryCodes, setRecoveryCodes]     = useState(null)

  useEffect(() => {
    setUsername(user?.username || '')
    setTitle(user?.title || '')
    setAvatar(user?.avatar || '')
    setTotpEnabled(user?.totp_enabled || false)
  }, [user?.username, user?.title, user?.avatar, user?.totp_enabled])

  const saveProfile = async () => {
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ username, title, avatar })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      if (e.message === 'demo') {
        setSaved('demo')
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(e.message?.includes('400') ? 'Username already taken' : 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async () => {
    setPwError(null)
    if (!pw.current)           { setPwError('Current password is required'); return }
    if (pw.next.length < 12)    { setPwError('New password must be at least 12 characters'); return }
    if (pw.next !== pw.confirm)  { setPwError('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await updateProfile({ current_password: pw.current, new_password: pw.next })
      setPw({ current: '', next: '', confirm: '' })
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2000)
    } catch (e) {
      if (e.message === 'demo') {
        setPwSaved('demo')
        setTimeout(() => setPwSaved(false), 2000)
      } else {
        setPwError(e.message?.includes('401') || e.message?.includes('incorrect')
          ? 'Current password is incorrect'
          : e.message || 'Failed to update password')
      }
    } finally {
      setPwSaving(false)
    }
  }

  const setup2fa = async () => {
    setTotpError(null)
    try {
      const data = await api.setup2fa()
      setTotpQr(data.qr)
      setTotpSecret(data.secret)
    } catch (e) {
      setTotpError('Failed to start 2FA setup')
    }
  }

  const verify2fa = async () => {
    setTotpError(null)
    try {
      const data = await api.verify2fa(totpCode)
      setTotpEnabled(true)
      setTotpQr(null)
      setTotpSecret(null)
      setTotpCode('')
      setRecoveryCodes(data.recovery_codes || null)
      setTotpSaved(true)
      setTimeout(() => setTotpSaved(false), 2000)
    } catch (e) {
      setTotpError('Invalid code — check your authenticator app')
    }
  }

  const disable2fa = async () => {
    setDisableError(null)
    try {
      await api.disable2fa(disablePassword)
      setTotpEnabled(false)
      setDisablePassword('')
    } catch (e) {
      setDisableError('Invalid password')
    }
  }
  return (
    <div className="page">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        {avatar && (
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--r-xl)',
            border: '1.5px solid var(--green-border)',
            background: 'var(--green-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <UserAvatar avatarId={avatar} size={36} color="var(--green)" />
          </div>
        )}
        <div>
          <div style={{ fontSize: 'var(--sz-xl)', fontWeight: 700, color: 'var(--text-0)' }}>
            {username || 'Profile'}
          </div>
          <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', marginTop: 2 }}>
            {ROLE_DESC[user?.role] || ''}
          </p>
        </div>
      </div>

      <Section title="Account">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <Field label="Username">
            <input className="input" value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username" />
          </Field>
          <Field label="Title">
            <input className="input" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Security Engineer" />
          </Field>
        </div>
        <AvatarPicker selected={avatar} onChange={setAvatar} />
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? 'Saving...' : saved === 'demo' ? '⚠ Read-only — changes disabled' : saved ? '✓ Saved' : 'Save changes'}
        </button>
      </Section>

      <Section title="Change password">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Current password">
            <input className="input" type="password" value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              placeholder="Current password" />
          </Field>
          <Field label="New password">
            <input className="input" type="password" value={pw.next}
              onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              placeholder="Min 12 characters" />
          </Field>
          <Field label="Confirm">
            <input className="input" type="password" value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Confirm password" />
          </Field>
        </div>
        {pwError && <div className="login-error" style={{ marginTop: 8 }}>{pwError}</div>}
        <button className="btn btn-primary btn-sm" onClick={savePassword} disabled={pwSaving} style={{ marginTop: 12 }}>
          {pwSaving ? 'Saving...' : pwSaved === 'demo' ? '⚠ Read-only — changes disabled' : pwSaved ? '✓ Password changed' : 'Change password'}
        </button>
      </Section>

      <Section title="Two-factor authentication" subtitle="Optional — uses any TOTP authenticator app">
        {totpEnabled ? (
          <div>
            <div style={{ fontSize: 'var(--sz-sm)', color: 'var(--green)', marginBottom: 16 }}>
              ✓ Two-factor authentication is enabled
            </div>
            {recoveryCodes && (
              <div style={{ marginBottom: 20 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>Recovery codes</div>
                <div className="field-hint" style={{ marginBottom: 10 }}>
                  Save these somewhere safe. Each code can only be used once. They will not be shown again.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 320 }}>
                  {recoveryCodes.map(code => (
                    <div key={code} className="mono-sm" style={{
                      padding: '6px 10px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-1)',
                      borderRadius: 'var(--r-md)',
                      letterSpacing: '0.05em',
                    }}>{code}</div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
                  onClick={() => setRecoveryCodes(null)}>
                  I have saved these codes
                </button>
              </div>
            )}
            <Field label="Confirm password to disable">
              <input className="input" type="password" value={disablePassword}
                onChange={e => setDisablePassword(e.target.value)}
                placeholder="Your current password"
                style={{ maxWidth: 260 }} />
            </Field>
            {disableError && <div className="login-error" style={{ marginTop: 8 }}>{disableError}</div>}
            <button className="btn btn-danger btn-sm" onClick={disable2fa} style={{ marginTop: 12 }}>
              Disable 2FA
            </button>
          </div>
        ) : totpQr ? (
          <div>
            <div style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-1)', marginBottom: 12 }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </div>
            <img src={totpQr} alt="2FA QR code" style={{ width: 180, height: 180, marginBottom: 16, display: 'block' }} />
            {totpSecret && (
              <div className="mono-sm" style={{ marginBottom: 16, color: 'var(--text-2)' }}>
                Manual key: {totpSecret}
              </div>
            )}
            <Field label="Verification code">
              <input className="input" value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                style={{ maxWidth: 160 }} />
            </Field>
            {totpError && <div className="login-error" style={{ marginTop: 8 }}>{totpError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={verify2fa}>
                {totpSaved ? '✓ Enabled' : 'Verify and enable'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setTotpQr(null); setTotpSecret(null); setTotpCode('') }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', marginBottom: 16 }}>
              Add a second layer of security to your account. Works with Google Authenticator, Aegis, and any TOTP app.
            </div>
            <button className="btn btn-sm" onClick={setup2fa}>
              Set up 2FA
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}
