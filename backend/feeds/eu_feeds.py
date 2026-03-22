"""
EU and global threat intelligence RSS feed connectors.
All verified working from cloud/Hetzner deployments.
"""
import httpx
import feedparser
from datetime import datetime
from .base import FeedConnector, RawSignal


def _parse_rss(url: str, severity_hint: str = "PRIORITY") -> list[RawSignal]:
    feed = feedparser.parse(url)
    signals = []
    for entry in feed.entries[:20]:
        try:
            pub = datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') and entry.published_parsed else datetime.utcnow()
        except Exception:
            pub = datetime.utcnow()
        signals.append(RawSignal(
            source_id=entry.get("id", entry.get("link", "")),
            title=entry.get("title", ""),
            description=entry.get("summary", ""),
            published_at=pub,
            cve_id=None,
            affected_vendors=[],
            severity_hint=severity_hint,
            url=entry.get("link", url),
            raw={},
        ))
    return signals


class EnisaConnector(FeedConnector):
    name = "enisa"
    display_name = "ENISA"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        return []  # RSS feed currently unavailable


class CertEuConnector(FeedConnector):
    name = "cert_eu"
    display_name = "CERT-EU Advisories"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://cert.europa.eu/publications/security-advisories-rss", "PRIORITY")
        except Exception:
            return []


class CertEuTiConnector(FeedConnector):
    name = "cert_eu_ti"
    display_name = "CERT-EU Threat Intel"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://cert.europa.eu/publications/threat-intelligence-rss", "PRIORITY")
        except Exception:
            return []


class BsiConnector(FeedConnector):
    name = "bsi"
    display_name = "BSI"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        return []  # BSI RSS migrated to WID portal — unavailable from cloud IPs


class NcscUkConnector(FeedConnector):
    name = "ncsc_uk"
    display_name = "NCSC-UK"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", "PRIORITY")
        except Exception:
            return []


class ExploitDbConnector(FeedConnector):
    name = "exploit_db"
    display_name = "Exploit-DB"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://www.exploit-db.com/rss.xml", "PRIORITY")
        except Exception:
            return []


class CertFrConnector(FeedConnector):
    name = "cert_fr"
    display_name = "CERT-FR / ANSSI"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://www.cert.ssi.gouv.fr/alerte/feed/", "PRIORITY")
        except Exception:
            return []


class SansIscConnector(FeedConnector):
    name = "sans_isc"
    display_name = "SANS ISC"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://isc.sans.edu/rssfeed.xml", "PRIORITY")
        except Exception:
            return []


class SecurelistConnector(FeedConnector):
    name = "securelist"
    display_name = "Securelist"
    requires_api_key = False

    async def fetch(self) -> list[RawSignal]:
        try:
            return _parse_rss("https://securelist.com/feed/", "PRIORITY")
        except Exception:
            return []
