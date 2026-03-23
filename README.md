# IVAR — Intelligence Visualization & Analysis Radar

Open source threat intelligence dashboard for security teams. IVAR pulls from public feeds across the US, EU, and global threat landscape, filters signals against your declared tech stack, and surfaces what actually requires your attention. Add your own RSS or JSON feeds for any source. No commercial platform required.

**Live demo:** [demo.getivar.com](https://demo.getivar.com)

---

## Why IVAR

Most public threat intel feeds are firehoses. Without filtering, you get hundreds of CVEs a week, most of which have nothing to do with what you run. IVAR solves this by matching incoming signals against the tech stack you declare in your organisation profile. What does not match gets auto-dismissed. What does match surfaces as a pending signal for your review.

The result is a small, actionable queue rather than a backlog.

---

## Who this is for

Security engineers, CISOs, and consultants at small to mid-size organisations who need structured threat intelligence without a commercial platform. If you manage your own stack and want to know when something you run is being actively exploited, this is built for you.

It is also a practical fit for teams working toward compliance with:

- **ISO 27001** (Control 5.7, Threat intelligence): IVAR provides a documented, repeatable process with a full audit log of every signal and review action.
- **NIS2** (Article 21, Cybersecurity risk management): Ongoing threat monitoring is a required measure under NIS2 for covered entities.
- **DORA** (Article 13, ICT threat intelligence): Financial entities and their ICT providers in the EU are required to gather and act on threat intelligence. IVAR covers the monitoring and documentation side of that obligation.
- **SOC 2**: Continuous monitoring of vulnerabilities and threats supports the Availability and Security criteria.
- **CRA** (Cyber Resilience Act): Software vendors required to monitor for vulnerabilities in products they ship can use IVAR to track relevant CVEs.

For all of these, the export function gives you a CSV of every signal reviewed, dismissed, or escalated, which serves as evidence during audits.

---

## How it works

When a sweep runs, IVAR fetches from all enabled feeds, normalises the signals, and evaluates each one against your stack. Signals are assigned one of three severity levels:

- **Flash:** confirmed active exploitation in the wild, added to a threat feed within the last 365 days. Always surfaces for review regardless of stack match. Older confirmed exploits are downgraded to Priority to keep the queue focused on what is actively relevant.
- **Priority:** relevant to your declared stack or high confidence from AI triage. Surfaces for review.
- **Routine:** lower severity, no stack match. Auto-dismissed to keep your queue clean.

Everything dismissed is logged. You can review dismissed signals at any time and the full audit trail is exportable as CSV.

---

## Authentication and user management

IVAR includes a full authentication system with role-based access control.

### Roles

| Role | Access |
|------|--------|
| **Admin** | Full access: settings, feeds, user management, sweep, review |
| **Member** | Can review signals and run sweeps |
| **Viewer** | Read-only access to signals and activity |

### First login

On first startup, IVAR creates a default admin account. Username: `admin`, password: `Valhalla@12!`. On first login you will be prompted to set a new password, minimum 12 characters. You can update your username anytime from the Profile page. No `.env` file is required to get started.

### Adding users

Admins can add users from the Settings page. New users are prompted to change their password on first login.

### Password requirements

Minimum 12 characters. No other restrictions.

### Two-factor authentication

Optional. Users can enable TOTP-based 2FA from their Profile page. Any authenticator app works: Google Authenticator, Aegis, or similar. When enabled, eight single-use recovery codes are generated and shown once. Store them somewhere safe. If a user loses their authenticator and recovery codes, an admin can disable 2FA from the Settings page.

### Forgot password

IVAR does not send password reset emails. If a user forgets their password, an admin can reset it from the Settings page. If the admin account itself is locked, password and 2FA can be reset directly on the server via the database.

### Rate limiting

The `/api/auth/login` endpoint is rate limited to 10 requests per minute per IP using `slowapi`.

---

## Tech stack configuration

This is the most important setting. In the Organisation section of Settings, declare the products and vendors your environment uses. IVAR matches these against CVE vendor strings to determine relevance.

IVAR seeds your stack with `github`, `docker`, and `python` as defaults on first install. Update these in Settings to match your actual environment.

Use lowercase short names as they appear in CVE data:

| Use this | Not this |
|----------|----------|
| `github` | `GitHub Actions` |
| `docker` | `Docker Desktop` |
| `postgresql` | `PostgreSQL 16` |
| `python` | `Python 3.11` |

Check [nvd.nist.gov](https://nvd.nist.gov) if you are unsure what vendor string a product uses in CVE records. The more accurate your stack declaration, the more precise the filtering.

---

## AI triage

AI triage is optional. Without it, IVAR uses rule-based filtering on severity and stack matching, which works well on its own. With it, signal quality improves significantly.

When configured, each signal is sent to your chosen model with its title, description, CVE data, and your stack context. The model assesses relevance, writes a plain-English summary, and produces a confidence score. This catches things rule-based filtering misses, particularly Flash signals that reference your stack indirectly or use vendor naming that does not match exactly.

Supported providers:

- **Anthropic Claude:** recommended. Strong at security context and concise summaries.
- **OpenAI:** GPT-4o and GPT-4o-mini both work well.
- **Ollama:** fully local inference. No data leaves your server. Good option if you have privacy or sovereignty requirements around sending signal data to external APIs.

If you run IVAR on EU infrastructure with Ollama, all processing stays within your environment.

---

## Privacy and data sovereignty

IVAR does not collect telemetry, phone home, or send data anywhere you have not explicitly configured. Feed fetching goes to public sources. AI triage goes to whichever provider you configure, or nowhere if you use Ollama. Your organisation profile and signal data stay in your local SQLite database.

If you run IVAR on EU infrastructure (Hetzner, OVHcloud, Infomaniak, and similar) with Ollama for triage, the entire pipeline is EU-resident with no external data transfers.

---

## Feeds

| Feed | Region | Key required |
|------|--------|-------------|
| NVD + EPSS | Global | No |
| GitHub Advisory | Global | No |
| CERT-EU Advisories | EU | No |
| CERT-FR / ANSSI | EU | No |
| NCSC-UK | EU/UK | No |
| Exploit-DB | Global | No |
| SANS ISC | Global | No |
| Securelist (Kaspersky) | Global | No |
| CISA KEV | US | No (blocked on cloud-hosted IPs) |
| AlienVault OTX | Global | Free account |
| HIBP Domains | Global | Paid |
| Shodan | Global | Free account |

CISA KEV works on self-hosted or on-premise deployments. On cloud providers it returns a 403. NVD + EPSS covers significant overlap using exploitation probability scores from FIRST.org.

---

## Stack

- **Backend:** Python, FastAPI, SQLite, APScheduler
- **Frontend:** React, Vite, Tailwind CSS
- **Fonts:** IBM Plex Sans, IBM Plex Mono
- **Hosted on:** Hetzner CX22, Ubuntu 24.04 (recommended for production)

---

## Requirements

- Python 3.11+
- Node 18+
- Linux server or local machine (macOS works for local development)

---

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/YvonLabs/ivar.git
cd ivar
docker compose up --build
```

Open `http://localhost` and log in with `admin` / `Valhalla@12!`. You will be prompted to change your password on first login. Then click **Sweep**.

### Manual install

#### 1. Clone

```bash
git clone https://github.com/YvonLabs/ivar.git
cd ivar
```

#### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --host 127.0.0.1 --port 7331
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

#### 4. First sweep

Open the dashboard and click **Sweep**. It pulls from all enabled feeds, triages everything, auto-dismisses irrelevant signals, and surfaces what needs your attention. Takes 15 to 30 seconds.

After the first sweep, go to Settings and update your tech stack to match what you actually run. Then use the **Stack only** filter. That is where the signal-to-noise ratio becomes genuinely useful. Optionally add an AI provider key for richer signal summaries.

---

## Production deployment

IVAR runs as a systemd service behind Caddy. The backend serves on port 7331 (localhost only). Caddy handles TLS and proxies `/api/*` to the backend and everything else to the built frontend.

```
yourdomain.com {
    header {
        Strict-Transport-Security        "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options           "nosniff"
        X-Frame-Options                  "DENY"
        Referrer-Policy                  "strict-origin-when-cross-origin"
        Permissions-Policy               "geolocation=(), microphone=(), camera=()"
        Content-Security-Policy          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"
        Cross-Origin-Opener-Policy       "same-origin"
        Cross-Origin-Resource-Policy     "same-origin"
        Cross-Origin-Embedder-Policy     "require-corp"
        -Server
        -X-Powered-By
    }

    handle /api/* {
        reverse_proxy localhost:7331
    }

    handle /health {
        reverse_proxy localhost:7331
    }

    handle {
        root * /var/www/ivar/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```

The sweep scheduler starts with the backend. No separate worker or cron job required.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IVAR_ADMIN_USER` | `admin` | Initial admin username. Optional, defaults to `admin` |
| `IVAR_ADMIN_PASSWORD` | `Valhalla@12!` | Initial admin password. Optional, you will be forced to change it on first login |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed origins. Set to your domain in production |
| `DATABASE_URL` | `sqlite:///./ivar.db` | Database connection string |
| `AI_PROVIDER` | none | AI triage provider: `claude`, `openai`, or `ollama` |
| `AI_API_KEY` | none | API key for the chosen AI provider |

---

## License

AGPL-3.0. Built by [YvonLabs](https://yvonlabs.github.io/).
