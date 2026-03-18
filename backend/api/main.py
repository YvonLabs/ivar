import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel

from db.models import Signal, Sweep, ReviewLog, OrgConfig, init_db, get_db, get_org
from sweep import run_sweep
from ai.triage import get_org_context

app = FastAPI(title="IVAR", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_sweep_running = False


@app.on_event("startup")
async def startup():
    init_db()
    _start_scheduler()


def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from db.models import SessionLocal

    def scheduled_sweep():
        global _sweep_running
        if _sweep_running:
            return
        _sweep_running = True
        import asyncio
        try:
            db = SessionLocal()
            asyncio.run(run_sweep(db))
            db.close()
        finally:
            _sweep_running = False

    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_sweep, 'interval', hours=12, id='auto_sweep')
    scheduler.start()


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/config")
def get_config(db: Session = Depends(get_db)):
    org = get_org(db)
    return {
        "org": {
            "name": org.name,
            "sector": org.sector,
            "size": org.size,
            "stack": org.stack or [],
            "domains": org.domains or [],
            "logo_url": org.logo_url,
        },
        "ai": {
            "provider": org.ai_provider,
            "model": org.ai_model,
            "enabled": org.ai_provider != "none" and bool(org.ai_api_key),
        },
        "notifications": {
            "slack": {
                "enabled": org.slack_enabled,
                "webhook": org.slack_webhook or "",
                "flash": org.slack_flash,
                "priority": org.slack_priority,
                "routine": org.slack_routine,
            },
            "discord": {
                "enabled": org.discord_enabled,
                "webhook": org.discord_webhook or "",
                "flash": org.discord_flash,
                "priority": org.discord_priority,
                "routine": org.discord_routine,
            },
        },
        "feeds": [
            {"name": "CISA KEV",        "key_required": False, "status": "active"},
            {"name": "NVD / CVE",       "key_required": False, "status": "active"},
            {"name": "GitHub Advisory", "key_required": False, "status": "active"},
            {"name": "AlienVault OTX",  "key_required": True,  "status": "active" if org.otx_api_key else "needs_key"},
            {"name": "HIBP Domains",    "key_required": True,  "status": "active" if org.hibp_api_key else "needs_key"},
            {"name": "Shodan",          "key_required": True,  "status": "active" if org.shodan_api_key else "needs_key"},
        ]
    }


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None
    size: Optional[str] = None
    stack: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    logo_url: Optional[str] = None

@app.post("/api/config/org")
def update_org(body: OrgUpdate, db: Session = Depends(get_db)):
    org = get_org(db)
    if body.name is not None:     org.name = body.name
    if body.sector is not None:   org.sector = body.sector
    if body.size is not None:     org.size = body.size
    if body.stack is not None:    org.stack = body.stack
    if body.domains is not None:  org.domains = body.domains
    if body.logo_url is not None: org.logo_url = body.logo_url
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


class AIUpdate(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = None

@app.post("/api/config/ai")
def update_ai(body: AIUpdate, db: Session = Depends(get_db)):
    org = get_org(db)
    org.ai_provider = body.provider
    if body.api_key is not None: org.ai_api_key = body.api_key
    if body.model is not None:   org.ai_model = body.model
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


class NotificationUpdate(BaseModel):
    slack_webhook: Optional[str] = None
    slack_enabled: Optional[bool] = None
    slack_flash: Optional[bool] = None
    slack_priority: Optional[bool] = None
    slack_routine: Optional[bool] = None
    discord_webhook: Optional[str] = None
    discord_enabled: Optional[bool] = None
    discord_flash: Optional[bool] = None
    discord_priority: Optional[bool] = None
    discord_routine: Optional[bool] = None

@app.post("/api/config/notifications")
def update_notifications(body: NotificationUpdate, db: Session = Depends(get_db)):
    org = get_org(db)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(org, field, val)
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


class FeedKeysUpdate(BaseModel):
    otx_api_key: Optional[str] = None
    hibp_api_key: Optional[str] = None
    shodan_api_key: Optional[str] = None

@app.post("/api/config/feeds")
def update_feed_keys(body: FeedKeysUpdate, db: Session = Depends(get_db)):
    org = get_org(db)
    if body.otx_api_key is not None:    org.otx_api_key = body.otx_api_key
    if body.hibp_api_key is not None:   org.hibp_api_key = body.hibp_api_key
    if body.shodan_api_key is not None: org.shodan_api_key = body.shodan_api_key
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@app.get("/api/signals")
def get_signals(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    stack_match: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(Signal).order_by(
        desc(Signal.severity == "FLASH"),
        desc(Signal.severity == "PRIORITY"),
        desc(Signal.published_at),
    )
    if status:
        q = q.filter(Signal.status == status)
    if severity:
        q = q.filter(Signal.severity == severity)
    # Handle stack_match as string "true"/"false" from query params
    if stack_match is not None:
        q = q.filter(Signal.stack_match == (stack_match.lower() == "true"))
    signals = q.limit(limit).all()
    return {"signals": [_signal_dict(s) for s in signals], "total": q.count()}


@app.get("/api/signals/{signal_id:path}")
def get_signal(signal_id: str, db: Session = Depends(get_db)):
    s = db.query(Signal).filter(Signal.id == signal_id).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    return _signal_dict(s)


class ReviewBody(BaseModel):
    action: str  # pending | reviewed | dismissed | escalated
    notes: Optional[str] = None
    reviewer: Optional[str] = "admin"

@app.post("/api/signals/{signal_id:path}/review")
def review_signal(signal_id: str, body: ReviewBody, db: Session = Depends(get_db)):
    s = db.query(Signal).filter(Signal.id == signal_id).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    prev_status    = s.status
    s.status       = body.action
    s.reviewed_by  = body.reviewer
    s.reviewed_at  = datetime.utcnow()
    s.review_notes = body.notes
    log = ReviewLog(
        signal_id=signal_id,
        signal_title=s.title,
        action=f"{prev_status}→{body.action}",
        reviewer=body.reviewer,
        notes=body.notes,
    )
    db.add(log)
    db.commit()
    return {"ok": True, "status": body.action}


@app.post("/api/sweep")
async def trigger_sweep(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    global _sweep_running
    if _sweep_running:
        return {"ok": False, "message": "Sweep already in progress"}
    _sweep_running = True

    async def _run():
        global _sweep_running
        try:
            from db.models import SessionLocal
            s = SessionLocal()
            await run_sweep(s)
            s.close()
        finally:
            _sweep_running = False

    background_tasks.add_task(_run)
    return {"ok": True, "message": "Sweep started"}


@app.get("/api/sweep/status")
def sweep_status():
    return {"running": _sweep_running}


@app.get("/api/sweeps")
def get_sweeps(limit: int = 20, db: Session = Depends(get_db)):
    sweeps = db.query(Sweep).order_by(desc(Sweep.started_at)).limit(limit).all()
    return {"sweeps": [
        {
            "id":           s.id,
            "started_at":   s.started_at.isoformat()   if s.started_at   else None,
            "completed_at": s.completed_at.isoformat()  if s.completed_at else None,
            "signals_found": s.signals_found,
            "signals_new":   s.signals_new,
            "sources":       s.sources_queried,
            "errors":        s.errors,
        }
        for s in sweeps
    ]}


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total     = db.query(func.count(Signal.id)).scalar()
    pending   = db.query(func.count(Signal.id)).filter(Signal.status == "pending").scalar()
    flash     = db.query(func.count(Signal.id)).filter(
        Signal.severity == "FLASH", Signal.status == "pending"
    ).scalar()
    stack     = db.query(func.count(Signal.id)).filter(
        Signal.stack_match == True, Signal.status == "pending"
    ).scalar()
    dismissed = db.query(func.count(Signal.id)).filter(Signal.status == "dismissed").scalar()
    reviewed  = db.query(func.count(Signal.id)).filter(Signal.status == "reviewed").scalar()
    escalated = db.query(func.count(Signal.id)).filter(Signal.status == "escalated").scalar()
    last_sweep = db.query(Sweep).order_by(desc(Sweep.completed_at)).first()
    return {
        "total_signals":  total,
        "pending_review": pending,
        "flash_count":    flash,
        "stack_matches":  stack,
        "last_sweep":     last_sweep.completed_at.isoformat() if last_sweep and last_sweep.completed_at else None,
        "sweep_running":  _sweep_running,
        "dismissed_count": dismissed,
        "reviewed_count":  reviewed,
        "escalated_count": escalated,
    }


@app.get("/api/activity")
def get_activity(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(ReviewLog).order_by(desc(ReviewLog.timestamp)).limit(limit).all()
    return {"log": [
        {
            "id":           l.id,
            "signal_id":    l.signal_id,
            "signal_title": l.signal_title,
            "action":       l.action,
            "reviewer":     l.reviewer,
            "notes":        l.notes,
            "timestamp":    l.timestamp.isoformat(),
        }
        for l in logs
    ]}


@app.get("/api/activity/export")
def export_activity(db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    import csv, io
    logs = db.query(ReviewLog).order_by(desc(ReviewLog.timestamp)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "action", "reviewer", "signal_id", "signal_title", "notes"])
    for l in logs:
        writer.writerow([l.timestamp, l.action, l.reviewer, l.signal_id, l.signal_title or "", l.notes or ""])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ivar-activity.csv"}
    )


def _signal_dict(s: Signal) -> dict:
    return {
        "id":                s.id,
        "source":            s.source,
        "severity":          s.severity,
        "title":             s.title,
        "description":       s.description,
        "cve_id":            s.cve_id,
        "affected_vendors":  s.affected_vendors or [],
        "url":               s.url,
        "published_at":      s.published_at.isoformat() if s.published_at else None,
        "fetched_at":        s.fetched_at.isoformat()   if s.fetched_at   else None,
        "triage_method":     s.triage_method,
        "triage_confidence": s.triage_confidence,
        "triage_summary":    s.triage_summary,
        "stack_match":       s.stack_match,
        "status":            s.status,
        "reviewed_by":       s.reviewed_by,
        "reviewed_at":       s.reviewed_at.isoformat() if s.reviewed_at else None,
        "review_notes":      s.review_notes,
    }

@app.get("/api/pulse")
def get_pulse(db: Session = Depends(get_db), tz_offset: int = 0):
    from datetime import date, timedelta, timezone, datetime as dt
    user_tz = timezone(timedelta(minutes=-tz_offset))
    today = dt.now(user_tz).date()
    days = [(today - timedelta(days=i)) for i in range(29, -1, -1)]
    by_day = {str(d): {"FLASH": 0, "PRIORITY": 0, "ROUTINE": 0} for d in days}
    signals = db.query(Signal).filter(
        Signal.fetched_at >= dt.now(user_tz) - timedelta(days=29)
    ).all()
    for s in signals:
        if s.fetched_at:
            local_dt = s.fetched_at.replace(tzinfo=timezone.utc).astimezone(user_tz)
            day_str = local_dt.strftime("%Y-%m-%d")
        else:
            day_str = None
        if day_str and day_str in by_day:
            by_day[day_str][s.severity] = by_day[day_str].get(s.severity, 0) + 1
    return {
        "days": [
            {
                "date": str(d),
                "flash":    by_day[str(d)]["FLASH"],
                "priority": by_day[str(d)]["PRIORITY"],
                "routine":  by_day[str(d)]["ROUTINE"],
                "total":    sum(by_day[str(d)].values()),
            }
            for d in days
        ]
    }


# ── Feed management ───────────────────────────────────────────────────────────

from db.models import FeedConfig


@app.get("/api/feeds")
def get_feeds(db: Session = Depends(get_db)):
    feeds = db.query(FeedConfig).order_by(
        desc(FeedConfig.enabled),
        FeedConfig.region,
        FeedConfig.display_name,
    ).all()
    return {"feeds": [_feed_dict(f) for f in feeds]}


@app.post("/api/feeds/{feed_id}/toggle")
def toggle_feed(feed_id: int, db: Session = Depends(get_db)):
    f = db.query(FeedConfig).filter(FeedConfig.id == feed_id).first()
    if not f:
        raise HTTPException(404, "Feed not found")
    f.enabled = not f.enabled
    db.commit()
    return {"ok": True, "enabled": f.enabled}


class CustomFeedBody(BaseModel):
    display_name: str
    url: str
    format: str = "rss"
    description: Optional[str] = None
    region: Optional[str] = "global"
    field_map: Optional[dict] = None


@app.post("/api/feeds/custom")
def add_custom_feed(body: CustomFeedBody, db: Session = Depends(get_db)):
    import re
    name = re.sub(r'[^a-z0-9_]', '_', body.display_name.lower())[:40]
    existing = db.query(FeedConfig).filter(FeedConfig.name == name).first()
    if existing:
        name = f"{name}_{int(datetime.utcnow().timestamp())}"
    feed = FeedConfig(
        name=name,
        display_name=body.display_name,
        description=body.description,
        region=body.region,
        url=body.url,
        format=body.format,
        field_map=body.field_map,
        built_in=False,
        enabled=True,
        requires_key=False,
    )
    db.add(feed)
    db.commit()
    return {"ok": True, "id": feed.id}


@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: int, db: Session = Depends(get_db)):
    f = db.query(FeedConfig).filter(
        FeedConfig.id == feed_id,
        FeedConfig.built_in == False,
    ).first()
    if not f:
        raise HTTPException(404, "Feed not found or cannot delete built-in feed")
    db.delete(f)
    db.commit()
    return {"ok": True}


@app.post("/api/feeds/{feed_id}/key")
def set_feed_key(feed_id: int, key: str, db: Session = Depends(get_db)):
    f = db.query(FeedConfig).filter(FeedConfig.id == feed_id).first()
    if not f:
        raise HTTPException(404, "Feed not found")
    f.api_key = key
    db.commit()
    return {"ok": True}


def _feed_dict(f: FeedConfig) -> dict:
    return {
        "id":           f.id,
        "name":         f.name,
        "display_name": f.display_name,
        "description":  f.description,
        "region":       f.region,
        "enabled":      f.enabled,
        "built_in":     f.built_in,
        "requires_key": f.requires_key,
        "has_key":      bool(f.api_key),
        "url":          f.url,
        "format":       f.format,
        "last_fetched": f.last_fetched.isoformat() if f.last_fetched else None,
        "last_error":   f.last_error,
        "signal_count": f.signal_count,
    }
