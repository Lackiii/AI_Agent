from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.config import REMINDER_DEDUPE_MINUTES, BACKEND_DATABASE_PATH
from app.db.database import get_db_connection, init_schema


def normalize_title(title: str) -> str:
    t = title.strip().lower()
    # Remove common punctuation; keep it lightweight for "thesis" parity with TS version.
    for ch in ['，', ',', '。', '.', '!', '！', '?', '？', '、']:
        t = t.replace(ch, '')
    t = ''.join(t.split())  # remove whitespace
    return t


def _parse_iso_to_ms(iso_str: Optional[str]) -> Optional[int]:
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def ensure_repo_ready() -> None:
    init_schema()


@dataclass(frozen=True)
class ReminderRow:
    id: str
    title: str
    due_at: Optional[str]
    raw_text: Optional[str]
    created_at: str
    status: str
    fired_at: Optional[str]
    normalized_title: Optional[str]


def list_reminders() -> list[dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, title, due_at, raw_text, created_at, status, fired_at
            FROM reminders
            ORDER BY created_at ASC
            """
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "dueAt": r["due_at"],
                "dueAtMs": _parse_iso_to_ms(r["due_at"]),
                "rawText": r["raw_text"],
                "createdAt": r["created_at"],
                "status": r["status"],
                "firedAt": r["fired_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def create_reminder(title: str, due_at: Optional[str], raw_text: Optional[str]) -> tuple[dict[str, Any], bool, bool]:
    """
    Returns: (reminder_payload_for_client, duplicate, past)
    Client payload uses TS-compatible naming: id/title/dueAt/createdAt/rawText.
    """
    ensure_repo_ready()

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    due_ms = _parse_iso_to_ms(due_at)
    title_norm = normalize_title(title)

    duplicate = False
    past = False
    if due_ms is not None and due_ms < now_ms - 60 * 1000:
        past = True

    conn = get_db_connection()
    try:
        # Dedupe against existing scheduled reminders.
        if due_ms is not None and title_norm:
            delta = REMINDER_DEDUPE_MINUTES * 60 * 1000
            rows = conn.execute(
                """
                SELECT id, title, due_at, normalized_title, status
                FROM reminders
                WHERE status IN ('scheduled')
                """
            ).fetchall()
            for r in rows:
                r_due_ms = _parse_iso_to_ms(r["due_at"])
                r_norm = r["normalized_title"] or normalize_title(r["title"] or "")
                if not r_norm or r_due_ms is None:
                    continue
                if r_norm != title_norm:
                    continue
                if abs(r_due_ms - due_ms) <= delta:
                    duplicate = True
                    break

        if past:
            # Create it anyway? For safety, we do NOT schedule; but we still create record for UI history.
            pass

        if not duplicate and not past:
            reminder_id = str(uuid.uuid4())
            created_at = datetime.now(timezone.utc).astimezone().isoformat()
            conn.execute(
                """
                INSERT INTO reminders (id, title, due_at, raw_text, created_at, status, fired_at, normalized_title)
                VALUES (?, ?, ?, ?, ?, 'scheduled', NULL, ?)
                """,
                (reminder_id, title.strip() or "未命名提醒", due_at, raw_text, created_at, title_norm),
            )
            conn.commit()

            payload = {
                "id": reminder_id,
                "title": title.strip() or "未命名提醒",
                "dueAt": due_at,
                "rawText": raw_text,
                "createdAt": created_at,
                "status": "scheduled",
                "firedAt": None,
            }
            return payload, False, False

        # Duplicate or past: do not schedule new job; return minimal info.
        return {
            "id": None,
            "title": title.strip() or "未命名提醒",
            "dueAt": due_at,
            "rawText": raw_text,
            "createdAt": None,
            "status": "skipped",
            "firedAt": None,
        }, duplicate, past
    finally:
        conn.close()


def delete_reminder(reminder_id: str) -> bool:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        before = conn.execute("SELECT COUNT(1) AS c FROM reminders WHERE id = ?", (reminder_id,)).fetchone()["c"]
        conn.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
        conn.commit()
        after = conn.execute("SELECT COUNT(1) AS c FROM reminders WHERE id = ?", (reminder_id,)).fetchone()["c"]
        return before > 0 and after == 0
    finally:
        conn.close()


def mark_fired(reminder_id: str, fired_at_iso: str) -> Optional[dict[str, Any]]:
    """
    Mark reminder as fired and return payload for WS + notifications.
    """
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        conn.execute(
            """
            UPDATE reminders
            SET status = 'fired', fired_at = ?
            WHERE id = ? AND status = 'scheduled'
            """,
            (fired_at_iso, reminder_id),
        )
        row = conn.execute(
            """
            SELECT id, title, due_at, raw_text, created_at, status, fired_at
            FROM reminders
            WHERE id = ?
            """,
            (reminder_id,),
        ).fetchone()
        conn.commit()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "dueAt": row["due_at"],
            "rawText": row["raw_text"],
            "createdAt": row["created_at"],
            "status": row["status"],
            "firedAt": row["fired_at"],
        }
    finally:
        conn.close()


def get_pending_reminders() -> list[dict[str, Any]]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, title, due_at, raw_text, created_at
            FROM reminders
            WHERE status = 'scheduled' AND due_at IS NOT NULL
            """
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "dueAt": r["due_at"],
                "rawText": r["raw_text"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()

