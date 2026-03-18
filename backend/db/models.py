from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Float, Boolean, JSON, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ivar.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

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

def init_db():
    Base.metadata.create_all(bind=engine)

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
            stack=[s.strip() for s in os.getenv("ORG_STACK", "github,docker,postgresql").split(",")],
            domains=[d.strip() for d in os.getenv("ORG_DOMAINS", "").split(",") if d.strip()],
        )
        db.add(org)
        db.commit()
    return org


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
