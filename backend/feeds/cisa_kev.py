import httpx
from datetime import datetime
from .base import FeedConnector, RawSignal

CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

class CisaKevConnector(FeedConnector):
    name = "cisa_kev"
    display_name = "CISA KEV"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(CISA_KEV_URL)
            resp.raise_for_status()
            data = resp.json()

        signals = []
        for vuln in data.get("vulnerabilities", []):
            try:
                pub_date = datetime.strptime(vuln["dateAdded"], "%Y-%m-%d")
            except Exception:
                pub_date = datetime.utcnow()

            signals.append(RawSignal(
                source_id=vuln["cveID"],
                title=f"{vuln['cveID']}: {vuln.get('vulnerabilityName', '')}",
                description=vuln.get("shortDescription", ""),
                published_at=pub_date,
                cve_id=vuln["cveID"],
                affected_vendors=[vuln.get("vendorProject", "").lower().strip()],
                severity_hint="FLASH",
                url=f"https://nvd.nist.gov/vuln/detail/{vuln['cveID']}",
                raw=vuln,
            ))
        return signals
