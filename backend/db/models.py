from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, Boolean, JSON, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ivar.db")

# Ensure the data directory exists for SQLite
if DATABASE_URL.startswith("sqlite"):
    import pathlib
    db_path = DATABASE_URL.replace("sqlite:///", "").replace("sqlite:////", "/")
    pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── User model ────────────────────────────────────────────────────────────────
# Roles:
#   admin  -- full access: settings, feeds, sweep, review, user management
#   member -- can review signals and run sweeps, cannot change settings
#   viewer -- read-only: browse signals and activity, no actions

class User(Base):
    __tablename__ = "users"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    username             = Column(String, nullable=False, unique=True)
    title                = Column(String, nullable=True)
    password_hash        = Column(String, nullable=False)
    role                 = Column(String, nullable=False, default="viewer")
    is_active            = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    created_at           = Column(DateTime, default=datetime.utcnow)
    last_login           = Column(DateTime, nullable=True)
    avatar               = Column(String, nullable=True)
    totp_secret          = Column(String, nullable=True)
    totp_enabled         = Column(Boolean, default=False)
    recovery_codes       = Column(JSON, nullable=True)


class OrgConfig(Base):
    __tablename__ = "org_config"
    id = Column(Integer, primary_key=True, default=1)
    name = Column(String, default="My Org")
    sector = Column(String, default="software")
    size = Column(String, default="medium")
    stack = Column(JSON, default=list)
    domains = Column(JSON, default=list)
    logo_url = Column(String, nullable=True)
    ai_provider = Column(String, default="none")
    ai_api_key = Column(String, nullable=True)
    ai_model = Column(String, nullable=True)
    slack_webhook = Column(String, nullable=True)
    slack_enabled = Column(Boolean, default=False)
    slack_flash = Column(Boolean, default=True)
    slack_priority = Column(Boolean, default=False)
    slack_routine = Column(Boolean, default=False)
    discord_webhook = Column(String, nullable=True)
    discord_enabled = Column(Boolean, default=False)
    discord_flash = Column(Boolean, default=True)
    discord_priority = Column(Boolean, default=False)
    discord_routine = Column(Boolean, default=False)
    otx_api_key = Column(String, nullable=True)
    hibp_api_key = Column(String, nullable=True)
    shodan_api_key = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Signal(Base):
    __tablename__ = "signals"
    id = Column(String, primary_key=True)
    source = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="ROUTINE")
    title = Column(String, nullable=False)
    description = Column(Text)
    cve_id = Column(String, nullable=True)
    affected_vendors = Column(JSON, default=list)
    url = Column(String, nullable=True)
    published_at = Column(DateTime, nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    raw = Column(JSON)
    triage_method = Column(String, default="rule_based")
    triage_confidence = Column(Float, nullable=True)
    triage_summary = Column(Text, nullable=True)
    stack_match = Column(Boolean, default=False)
    status = Column(String, default="pending")
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)


class Sweep(Base):
    __tablename__ = "sweeps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    signals_found = Column(Integer, default=0)
    signals_new = Column(Integer, default=0)
    sources_queried = Column(JSON, default=list)
    errors = Column(JSON, default=list)


class ReviewLog(Base):
    __tablename__ = "review_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    signal_id = Column(String, nullable=False)
    signal_title = Column(String, nullable=True)
    action = Column(String, nullable=False)
    reviewer = Column(String, default="admin")
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class MonthlyBrief(Base):
    __tablename__ = "monthly_briefs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    period = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    content_md = Column(Text)
    signal_count = Column(Integer, default=0)
    flash_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)


class FeedConfig(Base):
    __tablename__ = "feed_configs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    region = Column(String, default="global")
    enabled = Column(Boolean, default=False)
    built_in = Column(Boolean, default=True)
    requires_key = Column(Boolean, default=False)
    api_key = Column(String, nullable=True)
    url = Column(String, nullable=True)
    format = Column(String, default="rss")
    field_map = Column(JSON, nullable=True)
    last_fetched = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    signal_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


DEFAULT_FEEDS = [
    {"name": "nvd_epss",       "display_name": "NVD + EPSS",                  "description": "National Vulnerability Database enriched with EPSS exploitation probability scores.", "region": "global", "enabled": True,  "requires_key": False},
    {"name": "github_advisory","display_name": "GitHub Advisory",              "description": "GitHub Security Advisory Database covering ecosystem vulnerabilities.",                "region": "global", "enabled": True,  "requires_key": False},
    {"name": "cert_eu",        "display_name": "CERT-EU Advisories",           "description": "Security advisories from the Computer Emergency Response Team for EU institutions.",   "region": "eu",     "enabled": True,  "requires_key": False},
    {"name": "cert_eu_ti",     "display_name": "CERT-EU Threat Intel",         "description": "Threat intelligence publications from CERT-EU.",                                       "region": "eu",     "enabled": False, "requires_key": False},
    {"name": "ncsc_uk",        "display_name": "NCSC-UK",                      "description": "Advisories from the UK National Cyber Security Centre.",                              "region": "eu",     "enabled": False, "requires_key": False},
    {"name": "exploit_db",     "display_name": "Exploit-DB",                   "description": "Public exploit database maintained by Offensive Security.",                            "region": "global", "enabled": False, "requires_key": False},
    {"name": "cert_fr",        "display_name": "CERT-FR / ANSSI",              "description": "Security advisories from the French national cybersecurity agency.",                  "region": "eu",     "enabled": False, "requires_key": False},
    {"name": "sans_isc",       "display_name": "SANS Internet Storm Center",   "description": "Threat intelligence diary from the SANS Internet Storm Center.",                      "region": "global", "enabled": False, "requires_key": False},
    {"name": "securelist",     "display_name": "Securelist (Kaspersky)",        "description": "Threat research and intelligence publications from Kaspersky.",                        "region": "global", "enabled": False, "requires_key": False},
    {"name": "cisa_kev",       "display_name": "CISA KEV",                     "description": "CISA Known Exploited Vulnerabilities catalog. Note: blocked on some cloud-hosted IPs.", "region": "us",   "enabled": False, "requires_key": False},
    {"name": "bsi",            "display_name": "BSI",                          "description": "BSI (German Federal Office). RSS feeds migrated to the WID portal and are currently unavailable from cloud deployments.", "region": "eu", "enabled": False, "requires_key": False},
]


def hash_password(password: str) -> str:
    import hashlib, secrets
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000).hex()
    return f"{salt}:{hashed}"


def verify_password(password: str, password_hash: str) -> bool:
    import hashlib
    try:
        salt, hashed = password_hash.split(":")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000).hex()
        return check == hashed
    except Exception:
        return False


def init_db():
    Base.metadata.create_all(bind=engine)


def seed_feeds(db) -> None:
    existing = db.query(FeedConfig).count()
    if existing > 0:
        return
    for feed in DEFAULT_FEEDS:
        db.add(FeedConfig(**feed))
    db.commit()


def seed_admin(db) -> None:
    """Create default admin on first startup. Flags must_change_password=True
    so the user is forced to set a real password on first login."""
    existing = db.query(User).count()
    if existing > 0:
        return
    username = os.getenv("IVAR_ADMIN_USER", "admin")
    password = os.getenv("IVAR_ADMIN_PASSWORD", "Valhalla@12!")
    admin = User(
        username=username,
        title=None,
        password_hash=hash_password(password),
        role="admin",
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_org(db) -> OrgConfig:
    org = db.query(OrgConfig).filter(OrgConfig.id == 1).first()
    if not org:
        org = OrgConfig(
            id=1,
            name=os.getenv("ORG_NAME", "My Org"),
            sector=os.getenv("ORG_SECTOR", "software"),
            size=os.getenv("ORG_SIZE", "medium"),
            stack=[s.strip() for s in os.getenv("ORG_STACK", "github,docker,python").split(",")],
            domains=[d.strip() for d in os.getenv("ORG_DOMAINS", "").split(",") if d.strip()],
        )
        db.add(org)
        db.commit()
    return org
