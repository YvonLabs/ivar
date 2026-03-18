# Security Policy

YvonLabs welcomes responsible disclosure of security or privacy vulnerabilities across all its projects.

For reporting or disclosure, see:
👉 https://yvonlabs.github.io/docs/security

Contact: 237143566+yvon-l@users.noreply.github.com

---

### IVAR-specific context

IVAR is a self-hosted threat intelligence dashboard. Security issues relevant to this project include:

- Injection or mishandling of untrusted feed content
- Authentication or access control issues in the API
- Exposure of sensitive configuration (API keys, org profile data)
- Vulnerabilities in dependencies (Python backend or Node frontend)

IVAR does not collect telemetry, send data to third parties, or operate any shared cloud infrastructure. The demo at demo.getivar.com is a reference deployment only.

---

### Supported versions

| Version | Supported |
|---------|-----------|
| main | Active |
| Older builds | Not maintained |

---

### Disclosure process

Please do not open a public issue for potential security concerns. Email the contact above. Reports receive acknowledgment within 3 business days. Validated issues are patched and documented in release notes.
