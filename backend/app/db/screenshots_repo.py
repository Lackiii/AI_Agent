from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.db.database import get_db_connection, init_schema


def ensure_repo_ready() -> None:
    init_schema()


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def _row_to_dict(r: sqlite3.Row) -> dict[str, Any]:
    keys = set(r.keys())
    return {
        "id": r["id"],
        "capturedAt": r["captured_at"],
        "filePath": r["file_path"],
        "ocrText": r["ocr_text"],
        "ocrStatus": r["ocr_status"],
        "ocrError": r["ocr_error"],
        "caption": r["caption"] if "caption" in keys else None,
        "captionStatus": r["caption_status"] if "caption_status" in keys else None,
        "captionError": r["caption_error"] if "caption_error" in keys else None,
    }


_SELECT_COLS = (
    "id, captured_at, file_path, ocr_text, ocr_status, ocr_error, "
    "caption, caption_status, caption_error"
)


def list_screenshots(from_iso: Optional[str] = None, to_iso: Optional[str] = None) -> list[dict[str, Any]]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        if from_iso or to_iso:
            rows = conn.execute(
                f"""
                SELECT {_SELECT_COLS}
                FROM screenshots
                WHERE ( ? IS NULL OR captured_at >= ? )
                  AND ( ? IS NULL OR captured_at <= ? )
                ORDER BY captured_at ASC
                """,
                (from_iso, from_iso, to_iso, to_iso),
            ).fetchall()
        else:
            rows = conn.execute(
                f"""
                SELECT {_SELECT_COLS}
                FROM screenshots
                ORDER BY captured_at ASC
                """
            ).fetchall()

        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def create_screenshot_record(
    captured_at_iso: Optional[str],
    file_path: Optional[str],
    ocr_text: Optional[str],
    ocr_status: Optional[str] = None,
    ocr_error: Optional[str] = None,
    caption: Optional[str] = None,
    caption_status: Optional[str] = None,
    caption_error: Optional[str] = None,
) -> dict[str, Any]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        reminder_id = str(uuid.uuid4())
        captured_at = captured_at_iso or _now_iso()
        conn.execute(
            """
            INSERT INTO screenshots (
              id, captured_at, file_path, ocr_text, ocr_status, ocr_error,
              caption, caption_status, caption_error
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                reminder_id,
                captured_at,
                file_path,
                ocr_text,
                ocr_status,
                ocr_error,
                caption,
                caption_status,
                caption_error,
            ),
        )
        conn.commit()
        return {
            "id": reminder_id,
            "capturedAt": captured_at,
            "filePath": file_path,
            "ocrText": ocr_text,
            "ocrStatus": ocr_status,
            "ocrError": ocr_error,
            "caption": caption,
            "captionStatus": caption_status,
            "captionError": caption_error,
        }
    finally:
        conn.close()


def update_screenshot_caption(
    screenshot_id: str,
    caption: Optional[str],
    caption_status: Optional[str],
    caption_error: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        cur = conn.execute(
            """
            UPDATE screenshots
            SET caption = ?, caption_status = ?, caption_error = ?
            WHERE id = ?
            """,
            (caption, caption_status, caption_error, screenshot_id),
        )
        conn.commit()
        if cur.rowcount <= 0:
            return None
        row = conn.execute(
            f"SELECT {_SELECT_COLS} FROM screenshots WHERE id = ?",
            (screenshot_id,),
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def delete_screenshot_record(screenshot_id: str) -> bool:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM screenshots WHERE id = ?", (screenshot_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_all_screenshot_records() -> int:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        cur = conn.execute("DELETE FROM screenshots")
        conn.commit()
        return int(cur.rowcount or 0)
    finally:
        conn.close()
