from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Optional

from app.core.config import DEFAULT_PERSONA
from app.db.database import get_db_connection, init_schema


def ensure_repo_ready() -> None:
    init_schema()


def get_effective_persona() -> str:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT content FROM persona_override WHERE id = 1 LIMIT 1"
        ).fetchone()
        if row and row["content"]:
            return str(row["content"])
        return DEFAULT_PERSONA
    finally:
        conn.close()


def save_persona_override(content: str) -> None:
    ensure_repo_ready()
    now = datetime.now(timezone.utc).astimezone().isoformat()
    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO persona_override (id, content, updated_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
            """,
            (content, now),
        )
        conn.commit()
    finally:
        conn.close()


def reset_persona_override() -> None:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM persona_override WHERE id = 1")
        conn.commit()
    finally:
        conn.close()

