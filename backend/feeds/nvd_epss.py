"""
NVD + EPSS connector.
Fetches recent HIGH/CRITICAL CVEs then filters by EPSS score > 0.5
Only CVEs with >50% exploitation probability in next 30 days are kept.
This dramatically reduces noise vs raw NVD.
"""
import httpx
from datetime import datetime, timedelta
from .base import FeedConnector, RawSignal

NVD_URL  = "https://services.nvd.nist.gov/rest/json/cves/2.0"
EPSS_URL = "https://api.first.org/data/v1/epss"
EPSS_THRESHOLD = 0.1   # 10% exploitation probability — pragmatic for SMBs


class NvdEpssConnector(FeedConnector):
    name = "nvd_epss"
    display_name = "NVD + EPSS"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        end   = datetime.utcnow()
        start = end - timedelta(days=7)

        async with httpx.AsyncClient(timeout=30) as client:
            # 1. Fetch recent CVEs from NVD
            resp = await client.get(NVD_URL, params={
                "pubStartDate":   start.strftime("%Y-%m-%dT00:00:00.000"),
                "pubEndDate":     end.strftime("%Y-%m-%dT23:59:59.999"),
                "cvssV3Severity": "HIGH",
                "resultsPerPage": 100,
            })
            if resp.status_code == 403:
                return []
            resp.raise_for_status()
            nvd_data = resp.json()

            # 2. Get EPSS scores for those CVEs
            cve_ids = [
                v.get("cve", {}).get("id", "")
                for v in nvd_data.get("vulnerabilities", [])
            ]
            if not cve_ids:
                return []

            epss_resp = await client.get(EPSS_URL, params={
                "cve": ",".join(cve_ids[:100]),
            })
            epss_map = {}
            if epss_resp.status_code == 200:
                for item in epss_resp.json().get("data", []):
                    epss_map[item["cve"]] = float(item.get("epss", 0))

        signals = []
        for item in nvd_data.get("vulnerabilities", []):
            cve      = item.get("cve", {})
            cve_id   = cve.get("id", "")
            epss     = epss_map.get(cve_id, 0)

            # Filter — only keep if EPSS above threshold or CVSS >= 9
            metrics  = cve.get("metrics", {})
            cvss_data = (
                metrics.get("cvssMetricV31", [{}])[0].get("cvssData", {})
                or metrics.get("cvssMetricV30", [{}])[0].get("cvssData", {})
                or {}
            )
            score = cvss_data.get("baseScore", 0)

            if epss < EPSS_THRESHOLD and score < 9.0:
                continue   # Skip — low exploitation probability

            descriptions = cve.get("descriptions", [])
            desc = next((d["value"] for d in descriptions if d["lang"] == "en"), "")

            vendors = []
            for config in cve.get("configurations", []):
                for node in config.get("nodes", []):
                    for match in node.get("cpeMatch", []):
                        parts = match.get("criteria", "").split(":")
                        if len(parts) > 3:
                            vendors.append(parts[3].lower())

            try:
                pub = datetime.strptime(cve.get("published", "")[:10], "%Y-%m-%d")
            except Exception:
                pub = datetime.utcnow()

            epss_pct = f"{epss*100:.1f}%"
            severity_hint = "FLASH" if score >= 9.0 or epss >= 0.5 else "PRIORITY"

            signals.append(RawSignal(
                source_id=cve_id,
                title=f"{cve_id} (CVSS {score}, EPSS {epss_pct}): {desc[:120]}",
                description=f"EPSS: {epss_pct} exploitation probability. {desc}",
                published_at=pub,
                cve_id=cve_id,
                affected_vendors=list(set(vendors[:10])),
                severity_hint=severity_hint,
                url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
                raw={"score": score, "epss": epss},
            ))

        return signals
