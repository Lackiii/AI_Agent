from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import BACKEND_TIMEZONE
from app.db.reminders_repo import get_pending_reminders, mark_fired
from app.ws.manager import WebSocketManager


def _parse_iso_to_datetime(iso_str: str) -> datetime:
    # datetime.fromisoformat supports timezone offsets; "Z" must be normalized.
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _get_scheduler_tz() -> Any:
    try:
        return ZoneInfo(BACKEND_TIMEZONE)
    except Exception:
        return timezone.utc


def create_scheduler(ws_manager: WebSocketManager, loop: asyncio.AbstractEventLoop) -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=_get_scheduler_tz())

    def fire_job(reminder_id: str) -> None:
        fired_payload = mark_fired(reminder_id, datetime.now(timezone.utc).isoformat())
        if not fired_payload:
            return

        payload = {"type": "reminder_fired", "reminder": fired_payload}
        asyncio.run_coroutine_threadsafe(ws_manager.broadcast_json(payload), loop)

    # Attach to app.state for later scheduling (used by schedule_reminder()).
    scheduler._fire_job = fire_job  # type: ignore[attr-defined]
    return scheduler


def schedule_reminder(scheduler: BackgroundScheduler, reminder_id: str, due_at_iso: str) -> None:
    # Replace existing job for the same reminder id (idempotent).
    run_date = _parse_iso_to_datetime(due_at_iso)
    fire_job = getattr(scheduler, "_fire_job")  # type: ignore[attr-defined]
    scheduler.add_job(fire_job, trigger="date", run_date=run_date, args=[reminder_id], id=reminder_id, replace_existing=True)


def schedule_pending_on_startup(scheduler: BackgroundScheduler) -> None:
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    for r in get_pending_reminders():
        due_at = r.get("dueAt")
        if not due_at:
            continue
        try:
            due_dt = _parse_iso_to_datetime(due_at)
            due_ms = int(due_dt.timestamp() * 1000)
            if due_ms <= now_ms:
                # If it's already due when we restart, schedule a near-future run.
                # This avoids "missed" reminders after app restarts.
                due_dt = datetime.now(timezone.utc) + timedelta(seconds=1)
                due_at = due_dt.isoformat()
        except Exception:
            continue

        schedule_reminder(scheduler, r["id"], due_at)

