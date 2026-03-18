import { useState, useEffect } from 'react'

const REGION_LABEL = { us: '🇺🇸 US', eu: '🇪🇺 EU', global: '🌐 Global' }

const AI_PROVIDERS = [
  { value: 'none',   label: 'None, rule-based triage' },
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (local)' },
]

const AI_MODELS = {
  claude: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  ollama: ['llama3', 'mistral', 'mixtral'],
}

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span className="toggle-row-label">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function SaveBtn({ onClick, saving, saved }) {
  return (
    <button className="btn btn-primary btn-sm" onClick={onClick} disabled={saving} style={{ marginTop: 12 }}>
      {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save changes'}
    </button>
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

function FeedLibraryRow({ feed, onToggle, onDelete, onSetKey }) {
  const [showKey, setShowKey] = useState(false)
  const [keyVal, setKeyVal]   = useState('')
  const [saving, setSaving]   = useState(false)

  const saveKey = async () => {
    setSaving(true)
    await onSetKey(feed.id, keyVal)
    setKeyVal('')
    setShowKey(false)
    setSaving(false)
  }

  return (
    <div className="feed-lib-row">
      <div style={{ paddingTop: 2 }}>
        <Toggle checked={feed.enabled} onChange={() => onToggle(feed.id)} />
      </div>

      <div>
        <div className="feed-lib-name">
          {feed.display_name}
          <span className="tag">{REGION_LABEL[feed.region] || feed.region}</span>
          {feed.requires_key && (
            <span className={`tag ${feed.has_key ? 'tag-routine' : 'tag-priority'}`}>
              {feed.has_key ? '✓ key set' : 'needs key'}
            </span>
          )}
          {!feed.built_in && <span className="tag tag-green">custom</span>}
        </div>
        {feed.description && <div className="feed-lib-desc">{feed.description}</div>}
        {feed.last_error && (
          <div className="feed-lib-error">
            ⚠ {feed.last_error.includes('403')
              ? 'Blocked by source (403) — server IP not allowed'
              : feed.last_error.slice(0, 100)}
          </div>
        )}
        {showKey && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="input"
              type="password"
              value={keyVal}
              onChange={e => setKeyVal(e.target.value)}
              placeholder="Paste API key"
              style={{ maxWidth: 280 }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveKey} disabled={saving || !keyVal}>
              {saving ? '...' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(false)}>Cancel</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
        {feed.requires_key && !showKey && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(true)}>
            {feed.has_key ? 'Update key' : 'Set key'}
          </button>
        )}
        {!feed.built_in && (
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(feed.id)}>Remove</button>
        )}
      </div>
    </div>
  )
}

function AddCustomFeed({ onAdd }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ display_name: '', url: '', format: 'rss', description: '', region: 'global' })

  const submit = async () => {
    if (!form.display_name || !form.url) return
    setSaving(true)
    await onAdd(form)
    setForm({ display_name: '', url: '', format: 'rss', description: '', region: 'global' })
    setOpen(false)
    setSaving(false)
  }

  if (!open) return (
    <button
      className="btn btn-ghost"
      onClick={() => setOpen(true)}
      style={{ marginTop: 12, borderStyle: 'dashed', width: '100%', justifyContent: 'center' }}
    >
      + Add custom feed
    </button>
  )

  return (
    <div style={{ marginTop: 12, padding: 16, background: 'var(--bg)', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)' }}>
      <div className="label" style={{ marginBottom: 12 }}>Add custom feed</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Field label="Name">
          <input className="input" value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="My Intel Feed" />
        </Field>
        <Field label="Format">
          <select className="input select" value={form.format}
            onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
            <option value="rss">RSS / Atom</option>
            <option value="json">JSON</option>
          </select>
        </Field>
      </div>
      <Field label="URL">
        <input className="input" value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          placeholder="https://example.com/feed.xml" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="Region">
          <select className="input select" value={form.region}
            onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
            <option value="global">Global</option>
            <option value="us">US</option>
            <option value="eu">EU</option>
          </select>
        </Field>
        <Field label="Description">
          <input className="input" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this feed cover?" />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving || !form.display_name || !form.url}>
          {saving ? 'Adding...' : 'Add feed'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [feeds, setFeeds]   = useState([])
  const [config, setConfig] = useState(null)
  const [org, setOrg]       = useState({ name: '', sector: 'software', size: 'medium', stack: '', domains: '' })
  const [ai, setAi]         = useState({ provider: 'none', api_key: '', model: '' })
  const [notif, setNotif]   = useState({
    slack_webhook: '', slack_enabled: false, slack_flash: true, slack_priority: false, slack_routine: false,
    discord_webhook: '', discord_enabled: false, discord_flash: true, discord_priority: false, discord_routine: false,
  })
  const [saving, setSaving] = useState({})
  const [saved, setSaved]   = useState({})

  const loadFeeds = () =>
    fetch('/api/feeds').then(r => r.json()).then(d => setFeeds(d.feeds || [])).catch(() => {})

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => {
      setConfig(c)
      setOrg({
        name:    c.org.name    || '',
        sector:  c.org.sector  || 'software',
        size:    c.org.size    || 'medium',
        stack:   (c.org.stack   || []).join(', '),
        domains: (c.org.domains || []).join(', '),
      })
      setAi({ provider: c.ai.provider || 'none', api_key: '', model: c.ai.model || '' })
      setNotif({
        slack_webhook:    c.notifications.slack.webhook    || '',
        slack_enabled:    c.notifications.slack.enabled    || false,
        slack_flash:      c.notifications.slack.flash      ?? true,
        slack_priority:   c.notifications.slack.priority   || false,
        slack_routine:    c.notifications.slack.routine    || false,
        discord_webhook:  c.notifications.discord.webhook  || '',
        discord_enabled:  c.notifications.discord.enabled  || false,
        discord_flash:    c.notifications.discord.flash    ?? true,
        discord_priority: c.notifications.discord.priority || false,
        discord_routine:  c.notifications.discord.routine  || false,
      })
    }).catch(() => {})
    loadFeeds()
  }, [])

  const save = async (key, payload, endpoint) => {
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setSaved(s => ({ ...s, [key]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000)
    } finally {
      setSaving(s => ({ ...s, [key]: false }))
    }
  }

  const saveOrg = () => save('org', {
    name: org.name, sector: org.sector, size: org.size,
    stack:   org.stack.split(',').map(s => s.trim()).filter(Boolean),
    domains: org.domains.split(',').map(s => s.trim()).filter(Boolean),
  }, '/api/config/org')

  const saveAi = () => save('ai', {
    provider: ai.provider,
    api_key:  ai.api_key  || undefined,
    model:    ai.model    || undefined,
  }, '/api/config/ai')

  const saveNotif = () => save('notif', notif, '/api/config/notifications')

  const toggleFeed   = async id => { await fetch(`/api/feeds/${id}/toggle`, { method: 'POST' }); loadFeeds() }
  const deleteFeed   = async id => { await fetch(`/api/feeds/${id}`, { method: 'DELETE' }); loadFeeds() }
  const setFeedKey   = async (id, key) => { await fetch(`/api/feeds/${id}/key?key=${encodeURIComponent(key)}`, { method: 'POST' }); loadFeeds() }
  const addCustomFeed = async form => {
    await fetch('/api/feeds/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    loadFeeds()
  }

  const regions      = ['us', 'global', 'eu']
  const feedGroups   = regions.map(r => ({ region: r, feeds: feeds.filter(f => f.region === r && f.built_in) })).filter(g => g.feeds.length > 0)
  const customFeeds  = feeds.filter(f => !f.built_in)

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 'var(--sz-xl)', fontWeight: 700, color: 'var(--text-0)' }}>Settings</div>
        <p style={{ fontSize: 'var(--sz-sm)', color: 'var(--text-2)', marginTop: 4 }}>Configure IVAR for your organisation</p>
      </div>

      <Section title="Organisation">
        <Field label="Organisation name">
          <input className="input" value={org.name} onChange={e => setOrg(o => ({ ...o, name: e.target.value }))} placeholder="Your Organisation" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Sector">
            <select className="input select" value={org.sector} onChange={e => setOrg(o => ({ ...o, sector: e.target.value }))}>
              {['software','finance','healthcare','manufacturing','retail','education','government','other']
                .map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Size">
            <select className="input select" value={org.size} onChange={e => setOrg(o => ({ ...o, size: e.target.value }))}>
              <option value="small">Small (under 50)</option>
              <option value="medium">Medium (50 to 500)</option>
              <option value="large">Large (500+)</option>
            </select>
          </Field>
        </div>
        <Field label="Tech stack" hint="Comma-separated vendor names as they appear in CVE data. Use lowercase short names, e.g. 'github' not 'GitHub Actions', 'docker' not 'Docker Desktop'. Check nvd.nist.gov for exact vendor names.">
          <input className="input" value={org.stack} onChange={e => setOrg(o => ({ ...o, stack: e.target.value }))} placeholder="github, docker, postgresql, python..." />
        </Field>
        <Field label="Domains" hint="Used for credential and exposure monitoring.">
          <input className="input" value={org.domains} onChange={e => setOrg(o => ({ ...o, domains: e.target.value }))} placeholder="yourcompany.com, yourcompany.io" />
        </Field>
        <SaveBtn onClick={saveOrg} saving={saving.org} saved={saved.org} />
      </Section>

      <Section title="Feed Library" subtitle="Changes take effect on next sweep">
        {feedGroups.map(group => (
          <div key={group.region} className="region-group">
            <div className="region-label">{REGION_LABEL[group.region]}</div>
            {group.feeds.map(f => (
              <FeedLibraryRow key={f.id} feed={f} onToggle={toggleFeed} onDelete={deleteFeed} onSetKey={setFeedKey} />
            ))}
          </div>
        ))}
        {customFeeds.length > 0 && (
          <div className="region-group">
            <div className="region-label">Custom feeds</div>
            {customFeeds.map(f => (
              <FeedLibraryRow key={f.id} feed={f} onToggle={toggleFeed} onDelete={deleteFeed} onSetKey={setFeedKey} />
            ))}
          </div>
        )}
        <AddCustomFeed onAdd={addCustomFeed} />
      </Section>

      <Section title="AI Triage" subtitle="Optional, rule-based triage is used without a key">
        <Field label="Provider">
          <select className="input select" value={ai.provider} onChange={e => setAi(a => ({ ...a, provider: e.target.value }))}>
            {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        {ai.provider !== 'none' && (
          <>
            <Field label="API key">
              <input className="input" type="password" value={ai.api_key}
                onChange={e => setAi(a => ({ ...a, api_key: e.target.value }))}
                placeholder={config?.ai?.enabled ? '......... (set, enter new value to update)' : 'Enter API key'} />
            </Field>
            <Field label="Model">
              <select className="input select" value={ai.model} onChange={e => setAi(a => ({ ...a, model: e.target.value }))}>
                <option value="">Default</option>
                {(AI_MODELS[ai.provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </>
        )}
        <SaveBtn onClick={saveAi} saving={saving.ai} saved={saved.ai} />
      </Section>

      <Section title="Notifications">
        <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-0)' }}>
          <div className="label" style={{ marginBottom: 12 }}>Slack</div>
          <Field label="Webhook URL">
            <input className="input" value={notif.slack_webhook} onChange={e => setNotif(n => ({ ...n, slack_webhook: e.target.value }))} placeholder="https://hooks.slack.com/services/..." />
          </Field>
          <ToggleRow label="Enable Slack"              checked={notif.slack_enabled}  onChange={v => setNotif(n => ({ ...n, slack_enabled: v }))} />
          <ToggleRow label="Notify on Flash signals"   checked={notif.slack_flash}    onChange={v => setNotif(n => ({ ...n, slack_flash: v }))} />
          <ToggleRow label="Notify on Priority signals" checked={notif.slack_priority} onChange={v => setNotif(n => ({ ...n, slack_priority: v }))} />
          <ToggleRow label="Notify on Routine signals" checked={notif.slack_routine}  onChange={v => setNotif(n => ({ ...n, slack_routine: v }))} />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 12 }}>Discord</div>
          <Field label="Webhook URL">
            <input className="input" value={notif.discord_webhook} onChange={e => setNotif(n => ({ ...n, discord_webhook: e.target.value }))} placeholder="https://discord.com/api/webhooks/..." />
          </Field>
          <ToggleRow label="Enable Discord"             checked={notif.discord_enabled}  onChange={v => setNotif(n => ({ ...n, discord_enabled: v }))} />
          <ToggleRow label="Notify on Flash signals"    checked={notif.discord_flash}    onChange={v => setNotif(n => ({ ...n, discord_flash: v }))} />
          <ToggleRow label="Notify on Priority signals" checked={notif.discord_priority} onChange={v => setNotif(n => ({ ...n, discord_priority: v }))} />
          <ToggleRow label="Notify on Routine signals"  checked={notif.discord_routine}  onChange={v => setNotif(n => ({ ...n, discord_routine: v }))} />
        </div>
        <SaveBtn onClick={saveNotif} saving={saving.notif} saved={saved.notif} />
      </Section>
    </div>
  )
}
