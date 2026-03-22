import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel

from db.models import (
    Signal, Sweep, ReviewLog, OrgConfig, User,
    init_db, seed_feeds, seed_admin, get_db, get_org, SessionLocal,
    hash_password, verify_password,
)
from sweep import run_sweep
from ai.triage import get_org_context
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pyotp
import qrcode
import io
import base64

def _generate_recovery_codes() -> list:
    return [secrets.token_hex(5).upper() + '-' + secrets.token_hex(5).upper() for _ in range(8)]
app = FastAPI(title="IVAR", version="0.1.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

_sweep_running = False

# ── Demo mode ─────────────────────────────────────────────────────────────────
DEMO_MODE   = os.getenv("IVAR_DEMO_MODE", "false").lower() == "true"
ADMIN_TOKEN = os.getenv("IVAR_ADMIN_TOKEN", "")

# ── In-memory session store ───────────────────────────────────────────────────
_sessions: dict = {}
SESSION_TTL_HOURS = 24


def _create_session(user: User) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "user_id":  user.id,
        "username": user.username,
        "role":     user.role,
        "expires":  datetime.utcnow() + timedelta(hours=SESSION_TTL_HOURS),
    }
    return token


def _get_session(token: str) -> Optional[dict]:
    session = _sessions.get(token)
    if not session:
        return None
    if datetime.utcnow() > session["expires"]:
        _sessions.pop(token, None)
        return None
    return session


def _require_auth(request: Request) -> dict:
    if DEMO_MODE:
        admin_token = request.headers.get("X-Admin-Token", "")
        if ADMIN_TOKEN and admin_token == ADMIN_TOKEN:
            # Find the real admin user so profile edits work
            from db.models import SessionLocal as _SL, User as _U
            _db = _SL()
            try:
                _u = _db.query(_U).filter(_U.role == "admin", _U.is_active == True).first()
                if _u:
                    return {"user_id": _u.id, "username": _u.username, "role": "admin"}
            finally:
                _db.close()
            return {"user_id": 0, "username": "admin", "role": "admin"}
        return {"user_id": 0, "username": "demo", "role": "viewer"}
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth[7:]
    session = _get_session(token)
    if not session:
        raise HTTPException(401, "Session expired or invalid")
    return session


def _require_role(min_role: str):
    role_order = {"viewer": 0, "member": 1, "admin": 2}
    def _check(session: dict = Depends(_require_auth)):
        if role_order.get(session["role"], -1) < role_order.get(min_role, 99):
            raise HTTPException(403, f"Requires {min_role} role or higher")
        return session
    return _check


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    db = SessionLocal()
    try:
        seed_feeds(db)
        seed_admin(db)
    finally:
        db.close()
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


# ── Auth endpoints ────────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == body.username,
        User.is_active == True,
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    if user.totp_enabled:
        if not body.totp_code:
            return {"requires_2fa": True}
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(body.totp_code):
            pass
        elif user.recovery_codes and body.totp_code.upper() in user.recovery_codes:
            codes = [c for c in user.recovery_codes if c != body.totp_code.upper()]
            user.recovery_codes = codes
            db.commit()
        else:
            raise HTTPException(401, "Invalid 2FA code")
    user.last_login = datetime.utcnow()
    db.commit()
    token = _create_session(user)
    return {
        "token":                token,
        "username":             user.username,
        "role":                 user.role,
        "must_change_password": user.must_change_password,
        "totp_enabled":         user.totp_enabled,
    }


@app.post("/api/auth/logout")
def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        _sessions.pop(auth[7:], None)
    return {"ok": True}


@app.get("/api/auth/me")
def me(session: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    # Demo user has no DB record
    if session["user_id"] == 0:
        return {
            "user_id":              0,
            "username":             session["username"],
            "title":                None,
            "role":                 session["role"],
            "demo":                 DEMO_MODE,
            "must_change_password": False,
            "totp_enabled":         False,
        }
    user = db.query(User).filter(User.id == session["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "user_id":              user.id,
        "username":             user.username,
        "title":                user.title,
        "role":                 user.role,
        "avatar":               user.avatar,
        "demo":                 DEMO_MODE,
        "must_change_password": user.must_change_password,
        "totp_enabled":         user.totp_enabled,
    }


class ProfileUpdate(BaseModel):
    username:         Optional[str] = None
    title:            Optional[str] = None
    avatar:           Optional[str] = None
    current_password: Optional[str] = None
    new_password:     Optional[str] = None


@app.patch("/api/auth/profile")
def update_profile(
    body: ProfileUpdate,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    if session["user_id"] == 0:
        raise HTTPException(403, "Cannot update profile in demo mode")
    user = db.query(User).filter(User.id == session["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    if body.username and body.username != user.username:
        taken = db.query(User).filter(User.username == body.username).first()
        if taken:
            raise HTTPException(400, "Username already taken")
        user.username = body.username
        # Update active session username
        for s in _sessions.values():
            if s["user_id"] == user.id:
                s["username"] = body.username

    if body.title is not None:
        user.title = body.title or None

    if body.avatar is not None:
        user.avatar = body.avatar or None

    if body.new_password:
        if len(body.new_password) < 12:
            raise HTTPException(400, "Password must be at least 12 characters")
        if not body.current_password:
            raise HTTPException(400, "Current password required to set a new one")
        if not verify_password(body.current_password, user.password_hash):
            raise HTTPException(401, "Current password is incorrect")
        user.password_hash        = hash_password(body.new_password)
        user.must_change_password = False

    db.commit()
    return {"ok": True, "username": user.username, "title": user.title}


# ── 2FA endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/auth/2fa/setup")
def setup_2fa(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    if session["user_id"] == 0:
        raise HTTPException(403, "Not available in demo mode")
    user = db.query(User).filter(User.id == session["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.commit()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.username, issuer_name="IVAR")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    return {"secret": secret, "qr": f"data:image/png;base64,{qr_b64}"}


@app.post("/api/auth/2fa/verify")
def verify_2fa(
    body: dict,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    if session["user_id"] == 0:
        raise HTTPException(403, "Not available in demo mode")
    user = db.query(User).filter(User.id == session["user_id"]).first()
    if not user or not user.totp_secret:
        raise HTTPException(400, "2FA setup not initiated")
    totp = pyotp.TOTP(user.totp_secret)
    code = body.get("code", "")
    if not totp.verify(code):
        raise HTTPException(400, "Invalid code")
    codes = _generate_recovery_codes()
    user.totp_enabled = True
    user.recovery_codes = codes
    db.commit()
    return {"ok": True, "recovery_codes": codes}


@app.post("/api/auth/2fa/disable")
def disable_2fa(
    body: dict,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    if session["user_id"] == 0:
        raise HTTPException(403, "Not available in demo mode")
    user = db.query(User).filter(User.id == session["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(body.get("password", ""), user.password_hash):
        raise HTTPException(401, "Invalid password")
    user.totp_enabled = False
    user.totp_secret = None
    db.commit()
    return {"ok": True}

# ── User management (admin only) ──────────────────────────────────────────────

class CreateUserBody(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    title: Optional[str] = None


@app.get("/api/users")
def list_users(
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at).all()
    return {"users": [_user_dict(u) for u in users]}


@app.post("/api/users")
def create_user(
    body: CreateUserBody,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    if body.role not in ("admin", "member", "viewer"):
        raise HTTPException(400, "Role must be admin, member, or viewer")
    if len(body.password) < 12:
        raise HTTPException(400, "Password must be at least 12 characters")
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(400, "Username already exists")
    user = User(
        username=body.username,
        title=body.title,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    return {"ok": True, "id": user.id}


class UpdateUserBody(BaseModel):
    role:      Optional[str]  = None
    is_active: Optional[bool] = None
    password:  Optional[str]  = None


@app.patch("/api/users/{user_id}")
def update_user(
    user_id: int,
    body: UpdateUserBody,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if body.role is not None:
        if body.role not in ("admin", "member", "viewer"):
            raise HTTPException(400, "Role must be admin, member, or viewer")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        if len(body.password) < 12:
            raise HTTPException(400, "Password must be at least 12 characters")
        user.password_hash        = hash_password(body.password)
        user.must_change_password = True  # Force password change on next login
    db.commit()
    return {"ok": True}


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(400, "Cannot delete the last admin user")
    db.delete(user)
    db.commit()
    return {"ok": True}


def _user_dict(u: User) -> dict:
    return {
        "id":                   u.id,
        "username":             u.username,
        "title":                u.title,
        "role":                 u.role,
        "is_active":            u.is_active,
        "must_change_password": u.must_change_password,
        "created_at":           u.created_at.isoformat() if u.created_at else None,
        "last_login":           u.last_login.isoformat() if u.last_login else None,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0", "demo": DEMO_MODE}


# ── Config ────────────────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    org = get_org(db)
    return {
        "org": {
            "name":    org.name,
            "sector":  org.sector,
            "size":    org.size,
            "stack":   org.stack or [],
            "domains": org.domains or [],
            "logo_url": org.logo_url,
        },
        "ai": {
            "provider": org.ai_provider,
            "model":    org.ai_model,
            "enabled":  org.ai_provider != "none" and bool(org.ai_api_key),
        },
        "notifications": {
            "slack": {
                "enabled":  org.slack_enabled,
                "webhook":  org.slack_webhook or "",
                "flash":    org.slack_flash,
                "priority": org.slack_priority,
                "routine":  org.slack_routine,
            },
            "discord": {
                "enabled":  org.discord_enabled,
                "webhook":  org.discord_webhook or "",
                "flash":    org.discord_flash,
                "priority": org.discord_priority,
                "routine":  org.discord_routine,
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
    name:     Optional[str]       = None
    sector:   Optional[str]       = None
    size:     Optional[str]       = None
    stack:    Optional[List[str]] = None
    domains:  Optional[List[str]] = None
    logo_url: Optional[str]       = None


@app.post("/api/config/org")
def update_org(
    body: OrgUpdate,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
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
    api_key:  Optional[str] = None
    model:    Optional[str] = None


@app.post("/api/config/ai")
def update_ai(
    body: AIUpdate,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    org = get_org(db)
    org.ai_provider = body.provider
    if body.api_key is not None: org.ai_api_key = body.api_key
    if body.model is not None:   org.ai_model = body.model
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


class NotificationUpdate(BaseModel):
    slack_webhook:    Optional[str]  = None
    slack_enabled:    Optional[bool] = None
    slack_flash:      Optional[bool] = None
    slack_priority:   Optional[bool] = None
    slack_routine:    Optional[bool] = None
    discord_webhook:  Optional[str]  = None
    discord_enabled:  Optional[bool] = None
    discord_flash:    Optional[bool] = None
    discord_priority: Optional[bool] = None
    discord_routine:  Optional[bool] = None


@app.post("/api/config/notifications")
def update_notifications(
    body: NotificationUpdate,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    org = get_org(db)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(org, field, val)
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


class FeedKeysUpdate(BaseModel):
    otx_api_key:   Optional[str] = None
    hibp_api_key:  Optional[str] = None
    shodan_api_key: Optional[str] = None


@app.post("/api/config/feeds")
def update_feed_keys(
    body: FeedKeysUpdate,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    org = get_org(db)
    if body.otx_api_key is not None:    org.otx_api_key = body.otx_api_key
    if body.hibp_api_key is not None:   org.hibp_api_key = body.hibp_api_key
    if body.shodan_api_key is not None: org.shodan_api_key = body.shodan_api_key
    org.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Signals ───────────────────────────────────────────────────────────────────

@app.get("/api/signals")
def get_signals(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    stack_match: Optional[str] = None,
    limit: int = 100,
    session: dict = Depends(_require_auth),
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
    if stack_match is not None:
        q = q.filter(Signal.stack_match == (stack_match.lower() == "true"))
    signals = q.limit(limit).all()
    return {"signals": [_signal_dict(s) for s in signals], "total": q.count()}


@app.get("/api/signals/{signal_id:path}")
def get_signal(
    signal_id: str,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    s = db.query(Signal).filter(Signal.id == signal_id).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    return _signal_dict(s)


class ReviewBody(BaseModel):
    action:   str
    notes:    Optional[str] = None
    reviewer: Optional[str] = None


@app.post("/api/signals/{signal_id:path}/review")
def review_signal(
    signal_id: str,
    body: ReviewBody,
    session: dict = Depends(_require_role("member")),
    db: Session = Depends(get_db),
):
    s = db.query(Signal).filter(Signal.id == signal_id).first()
    if not s:
        raise HTTPException(404, "Signal not found")
    prev_status    = s.status
    s.status       = body.action
    s.reviewed_by  = body.reviewer or session["username"]
    s.reviewed_at  = datetime.utcnow()
    s.review_notes = body.notes
    log = ReviewLog(
        signal_id=signal_id,
        signal_title=s.title,
        action=f"{prev_status}→{body.action}",
        reviewer=s.reviewed_by,
        notes=body.notes,
    )
    db.add(log)
    db.commit()
    return {"ok": True, "status": body.action}


# ── Sweep ─────────────────────────────────────────────────────────────────────

@app.post("/api/sweep")
async def trigger_sweep(
    background_tasks: BackgroundTasks,
    session: dict = Depends(_require_role("member")),
    db: Session = Depends(get_db),
):
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
def sweep_status(session: dict = Depends(_require_auth)):
    return {"running": _sweep_running}


@app.get("/api/sweeps")
def get_sweeps(
    limit: int = 20,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    sweeps = db.query(Sweep).order_by(desc(Sweep.started_at)).limit(limit).all()
    return {"sweeps": [
        {
            "id":            s.id,
            "started_at":    s.started_at.isoformat()  if s.started_at  else None,
            "completed_at":  s.completed_at.isoformat() if s.completed_at else None,
            "signals_found": s.signals_found,
            "signals_new":   s.signals_new,
            "sources":       s.sources_queried,
            "errors":        s.errors,
        }
        for s in sweeps
    ]}


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    total     = db.query(func.count(Signal.id)).scalar()
    pending   = db.query(func.count(Signal.id)).filter(Signal.status == "pending").scalar()
    flash     = db.query(func.count(Signal.id)).filter(Signal.severity == "FLASH", Signal.status == "pending").scalar()
    stack     = db.query(func.count(Signal.id)).filter(Signal.stack_match == True, Signal.status == "pending").scalar()
    dismissed = db.query(func.count(Signal.id)).filter(Signal.status == "dismissed").scalar()
    reviewed  = db.query(func.count(Signal.id)).filter(Signal.status == "reviewed").scalar()
    escalated = db.query(func.count(Signal.id)).filter(Signal.status == "escalated").scalar()
    last_sweep = db.query(Sweep).order_by(desc(Sweep.completed_at)).first()
    return {
        "total_signals":   total,
        "pending_review":  pending,
        "flash_count":     flash,
        "stack_matches":   stack,
        "last_sweep":      last_sweep.completed_at.isoformat() if last_sweep and last_sweep.completed_at else None,
        "sweep_running":   _sweep_running,
        "dismissed_count": dismissed,
        "reviewed_count":  reviewed,
        "escalated_count": escalated,
    }


# ── Activity ──────────────────────────────────────────────────────────────────

@app.get("/api/activity")
def get_activity(
    limit: int = 100,
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
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
def export_activity(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
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


# ── Pulse ─────────────────────────────────────────────────────────────────────

@app.get("/api/pulse")
def get_pulse(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
    tz_offset: int = 0,
):
    from datetime import timedelta, timezone, datetime as dt
    user_tz = timezone(timedelta(minutes=-tz_offset))
    today = dt.now(user_tz).date()
    days = [(today - timedelta(days=i)) for i in range(29, -1, -1)]
    by_day = {str(d): {"FLASH": 0, "PRIORITY": 0, "ROUTINE": 0} for d in days}
    signals = db.query(Signal).filter(Signal.fetched_at >= dt.now(user_tz) - timedelta(days=29)).all()
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
                "date":     str(d),
                "flash":    by_day[str(d)]["FLASH"],
                "priority": by_day[str(d)]["PRIORITY"],
                "routine":  by_day[str(d)]["ROUTINE"],
                "total":    sum(by_day[str(d)].values()),
            }
            for d in days
        ]
    }


# ── Feeds ─────────────────────────────────────────────────────────────────────

from db.models import FeedConfig


@app.get("/api/feeds")
def get_feeds(
    session: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    feeds = db.query(FeedConfig).order_by(
        desc(FeedConfig.enabled),
        FeedConfig.region,
        FeedConfig.display_name,
    ).all()
    return {"feeds": [_feed_dict(f) for f in feeds]}


@app.post("/api/feeds/{feed_id}/toggle")
def toggle_feed(
    feed_id: int,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
    f = db.query(FeedConfig).filter(FeedConfig.id == feed_id).first()
    if not f:
        raise HTTPException(404, "Feed not found")
    f.enabled = not f.enabled
    db.commit()
    return {"ok": True, "enabled": f.enabled}


class CustomFeedBody(BaseModel):
    display_name: str
    url:          str
    format:       str = "rss"
    description:  Optional[str]  = None
    region:       Optional[str]  = "global"
    field_map:    Optional[dict] = None


@app.post("/api/feeds/custom")
def add_custom_feed(
    body: CustomFeedBody,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
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
def delete_feed(
    feed_id: int,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
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
def set_feed_key(
    feed_id: int,
    key: str,
    session: dict = Depends(_require_role("admin")),
    db: Session = Depends(get_db),
):
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
