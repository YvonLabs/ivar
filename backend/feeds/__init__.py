from .base import FeedConnector, RawSignal
from .cisa_kev import CisaKevConnector
from .nvd_epss import NvdEpssConnector
from .github_advisory import GithubAdvisoryConnector
from .eu_feeds import (
    EnisaConnector, CertEuConnector, CertEuTiConnector,
    BsiConnector, NcscUkConnector, ExploitDbConnector,
    CertFrConnector, SansIscConnector, SecurelistConnector,
)

BUILT_IN_CONNECTORS = {
    "cisa_kev":       CisaKevConnector(),
    "nvd_epss":       NvdEpssConnector(),
    "github_advisory": GithubAdvisoryConnector(),
    "enisa":          EnisaConnector(),
    "cert_eu":        CertEuConnector(),
    "cert_eu_ti":     CertEuTiConnector(),
    "bsi":            BsiConnector(),
    "ncsc_uk":        NcscUkConnector(),
    "exploit_db":     ExploitDbConnector(),
    "cert_fr":        CertFrConnector(),
    "sans_isc":       SansIscConnector(),
    "securelist":     SecurelistConnector(),
}

DEFAULT_CONNECTORS = [
    BUILT_IN_CONNECTORS["nvd_epss"],
    BUILT_IN_CONNECTORS["github_advisory"],
    BUILT_IN_CONNECTORS["cert_eu"],
    BUILT_IN_CONNECTORS["ncsc_uk"],
]

def get_active_connectors(db=None) -> list[FeedConnector]:
    if db is None:
        return DEFAULT_CONNECTORS
    try:
        from db.models import FeedConfig
        configs = db.query(FeedConfig).filter(
            FeedConfig.enabled == True,
            FeedConfig.built_in == True,
        ).all()
        connectors = []
        for c in configs:
            if c.name in BUILT_IN_CONNECTORS:
                connectors.append(BUILT_IN_CONNECTORS[c.name])
        return connectors if connectors else DEFAULT_CONNECTORS
    except Exception:
        return DEFAULT_CONNECTORS

ALL_CONNECTORS = DEFAULT_CONNECTORS
