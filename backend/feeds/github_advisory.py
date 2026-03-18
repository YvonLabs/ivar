import httpx
from datetime import datetime
from .base import FeedConnector, RawSignal

GITHUB_ADVISORY_REST = "https://api.github.com/advisories"

class GithubAdvisoryConnector(FeedConnector):
    name = "github_advisory"
    display_name = "GitHub Advisory"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        params = {
            "severity": "high,critical",
            "per_page": 30,
            "direction": "desc",
            "sort": "published",
            "type": "reviewed",
        }
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(GITHUB_ADVISORY_REST, params=params, headers=headers)
            if resp.status_code != 200:
                return []
            advisories = resp.json()

        signals = []
        for adv in advisories:
            ghsa_id = adv.get("ghsa_id", "")
            severity = adv.get("severity", "high").upper()
            severity_hint = "FLASH" if severity == "CRITICAL" else "PRIORITY"

            cves = adv.get("cve_id") or ""
            vendors = []
            for vuln in adv.get("vulnerabilities", []):
                pkg = vuln.get("package", {})
                if pkg.get("name"):
                    vendors.append(pkg["name"].lower())

            try:
                pub = datetime.strptime(adv.get("published_at", "")[:10], "%Y-%m-%d")
            except Exception:
                pub = datetime.utcnow()

            signals.append(RawSignal(
                source_id=ghsa_id,
                title=f"{ghsa_id}: {adv.get('summary', '')}",
                description=adv.get("description", ""),
                published_at=pub,
                cve_id=cves or None,
                affected_vendors=vendors,
                severity_hint=severity_hint,
                url=adv.get("html_url", f"https://github.com/advisories/{ghsa_id}"),
                raw={"severity": severity},
            ))
        return signals
