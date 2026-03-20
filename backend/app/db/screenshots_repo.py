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


def list_screenshots(from_iso: Optional[str] = None, to_iso: Optional[str] = None) -> list[dict[str, Any]]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        if from_iso or to_iso:
            rows = conn.execute(
                """
                SELECT id, captured_at, file_path, ocr_text
                FROM screenshots
                WHERE ( ? IS NULL OR captured_at >= ? )
                  AND ( ? IS NULL OR captured_at <= ? )
                ORDER BY captured_at ASC
                """,
                (from_iso, from_iso, to_iso, to_iso),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, captured_at, file_path, ocr_text
                FROM screenshots
                ORDER BY captured_at ASC
                """
            ).fetchall()

        return [
            {
                "id": r["id"],
                "capturedAt": r["captured_at"],
                "filePath": r["file_path"],
                "ocrText": r["ocr_text"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def create_screenshot_record(captured_at_iso: Optional[str], file_path: Optional[str], ocr_text: Optional[str]) -> dict[str, Any]:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        reminder_id = str(uuid.uuid4())
        captured_at = captured_at_iso or _now_iso()
        conn.execute(
            """
            INSERT INTO screenshots (id, captured_at, file_path, ocr_text)
            VALUES (?, ?, ?, ?)
            """,
            (reminder_id, captured_at, file_path, ocr_text),
        )
        conn.commit()
        return {
            "id": reminder_id,
            "capturedAt": captured_at,
            "filePath": file_path,
            "ocrText": ocr_text,
        }
    finally:
        conn.close()

