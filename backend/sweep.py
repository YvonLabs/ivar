import asyncio
import httpx
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from db.models import Signal, Sweep, ReviewLog, get_org
from feeds import get_active_connectors
from ai.triage import triage

KEEP_DAYS = 90          # prune signals older than this
KEEP_DISMISSED = 30     # prune dismissed/reviewed signals after this many days


async def notify(org, signal) -> None:
    should_notify = (
        (signal.severity == "FLASH"    and (org.slack_flash    or org.discord_flash))    or
        (signal.severity == "PRIORITY" and (org.slack_priority or org.discord_priority)) or
        (signal.severity == "ROUTINE"  and (org.slack_routine  or org.discord_routine))
    )
    if not should_notify:
        return

    sev_emoji = {"FLASH": "🔴", "PRIORITY": "🟡", "ROUTINE": "🟢"}.get(signal.severity, "⚪")
    text = f"{sev_emoji} *{signal.severity}* — {signal.title}"
    if signal.triage_summary:
        text += f"\n{signal.triage_summary}"
    if signal.url:
        text += f"\n{signal.url}"

    async with httpx.AsyncClient(timeout=10) as client:
        if org.slack_enabled and org.slack_webhook:
            should = (
                (signal.severity == "FLASH"    and org.slack_flash)    or
                (signal.severity == "PRIORITY" and org.slack_priority) or
                (signal.severity == "ROUTINE"  and org.slack_routine)
            )
            if should:
                try:
                    await client.post(org.slack_webhook, json={"text": text})
                except Exception:
                    pass

        if org.discord_enabled and org.discord_webhook:
            should = (
                (signal.severity == "FLASH"    and org.discord_flash)    or
                (signal.severity == "PRIORITY" and org.discord_priority) or
                (signal.severity == "ROUTINE"  and org.discord_routine)
            )
            if should:
                try:
                    await client.post(org.discord_webhook, json={"content": text})
                except Exception:
                    pass


def should_auto_dismiss(signal) -> tuple[bool, str]:
    """
    Decide if a signal should be auto-dismissed without human review.
    Returns (dismiss: bool, reason: str)
    """
    # Always keep FLASH regardless of stack match
    if signal.severity == "FLASH":
        return False, ""

    # Keep PRIORITY if stack match
    if signal.severity == "PRIORITY" and signal.stack_match:
        return False, ""

    # Keep PRIORITY with high AI confidence even without stack match
    if signal.severity == "PRIORITY" and signal.triage_confidence and signal.triage_confidence >= 0.8:
        return False, ""

    # Auto-dismiss ROUTINE with no stack match
    if signal.severity == "ROUTINE" and not signal.stack_match:
        return True, "Auto-dismissed: ROUTINE severity, no stack match"

    # Auto-dismiss PRIORITY with no stack match and low confidence
    if signal.severity == "PRIORITY" and not signal.stack_match:
        return True, "Auto-dismissed: PRIORITY but no stack match detected"

    return False, ""


def prune_old_signals(db: Session) -> int:
    """Remove old signals to keep the DB lean."""
    cutoff_all       = datetime.utcnow() - timedelta(days=KEEP_DAYS)
    cutoff_dismissed = datetime.utcnow() - timedelta(days=KEEP_DISMISSED)

    # Delete very old signals regardless of status
    old = db.query(Signal).filter(Signal.fetched_at < cutoff_all).all()

    # Delete reviewed/dismissed signals after shorter window
    done = db.query(Signal).filter(
        Signal.status.in_(["dismissed", "reviewed"]),
        Signal.reviewed_at < cutoff_dismissed,
    ).all()

    to_delete = set([s.id for s in old] + [s.id for s in done])
    count = 0
    for sid in to_delete:
        s = db.query(Signal).filter(Signal.id == sid).first()
        if s:
            db.delete(s)
            count += 1

    db.commit()
    return count


async def run_sweep(db: Session) -> dict:
    org = get_org(db)
    sweep = Sweep(started_at=datetime.utcnow(), sources_queried=[], errors=[])
    db.add(sweep)
    db.commit()

    signals_found  = 0
    signals_new    = 0
    signals_auto_dismissed = 0
    errors = []

    for connector in get_active_connectors(db):
        try:
            raw_signals = await connector.fetch()
            sweep.sources_queried = sweep.sources_queried + [connector.name]
            # Clear any previous error and update last_fetched
            try:
                from db.models import FeedConfig
                fc = db.query(FeedConfig).filter(FeedConfig.name == connector.name).first()
                if fc:
                    from datetime import datetime as _dt
                    fc.last_fetched = _dt.utcnow()
                    fc.last_error = None
                    fc.signal_count = (fc.signal_count or 0) + len(raw_signals)
                    db.commit()
            except Exception:
                pass
            signals_found += len(raw_signals)

            for raw in raw_signals:
                signal_id = f"{connector.name}:{raw.source_id}"
                existing = db.query(Signal).filter(Signal.id == signal_id).first()
                if existing:
                    # Re-triage if org stack changed and signal is still pending
                    if existing.status == "pending" and existing.triage_method == "rule_based":
                        signal_data = {
                            "title": existing.title,
                            "description": existing.description,
                            "source": existing.source,
                            "cve_id": existing.cve_id,
                            "affected_vendors": existing.affected_vendors,
                            "severity_hint": existing.severity,
                        }
                        result = await triage(signal_data, db)
                        existing.severity         = result.severity
                        existing.triage_method    = result.method
                        existing.triage_confidence = result.confidence
                        existing.triage_summary   = result.summary
                        existing.stack_match      = result.stack_match

                        dismiss, reason = should_auto_dismiss(existing)
                        if dismiss:
                            existing.status      = "dismissed"
                            existing.reviewed_by = "ivar-auto"
                            existing.reviewed_at = datetime.utcnow()
                            existing.review_notes = reason
                            db.add(ReviewLog(
                                signal_id=signal_id,
                                signal_title=existing.title,
                                action="dismissed",
                                reviewer="ivar-auto",
                                notes=reason,
                            ))
                            signals_auto_dismissed += 1
                        db.commit()
                    continue

                # New signal — triage it
                signal_data = {
                    "title": raw.title,
                    "description": raw.description,
                    "source": connector.display_name,
                    "cve_id": raw.cve_id,
                    "affected_vendors": raw.affected_vendors,
                    "severity_hint": raw.severity_hint,
                }
                result = await triage(signal_data, db)

                signal = Signal(
                    id=signal_id,
                    source=connector.display_name,
                    severity=result.severity,
                    title=raw.title,
                    description=raw.description,
                    cve_id=raw.cve_id,
                    affected_vendors=raw.affected_vendors,
                    url=raw.url,
                    published_at=raw.published_at,
                    fetched_at=datetime.utcnow(),
                    raw=raw.raw,
                    triage_method=result.method,
                    triage_confidence=result.confidence,
                    triage_summary=result.summary,
                    stack_match=result.stack_match,
                    status="pending",
                )

                dismiss, reason = should_auto_dismiss(signal)
                if dismiss:
                    signal.status      = "dismissed"
                    signal.reviewed_by = "ivar-auto"
                    signal.reviewed_at = datetime.utcnow()
                    signal.review_notes = reason
                    signals_auto_dismissed += 1

                db.add(signal)
                db.commit()
                signals_new += 1

                if signal.status == "pending":
                    await notify(org, signal)

        except Exception as e:
            errors.append({"source": connector.name, "error": str(e)})
            # Write error back to feed_configs
            try:
                from db.models import FeedConfig
                fc = db.query(FeedConfig).filter(FeedConfig.name == connector.name).first()
                if fc:
                    fc.last_error = str(e)[:500]
                    db.commit()
            except Exception:
                pass

    # Prune old signals
    pruned = prune_old_signals(db)

    sweep.completed_at     = datetime.utcnow()
    sweep.signals_found    = signals_found
    sweep.signals_new      = signals_new
    sweep.errors           = errors
    db.commit()

    return {
        "signals_found":       signals_found,
        "signals_new":         signals_new,
        "signals_actionable":  signals_new - signals_auto_dismissed,
        "signals_dismissed":   signals_auto_dismissed,
        "signals_pruned":      pruned,
        "sources":             sweep.sources_queried,
        "errors":              errors,
    }
