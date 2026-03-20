from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from app.db.database import get_db_connection, init_schema


def ensure_repo_ready() -> None:
    init_schema()


def clear_conversation_memory() -> None:
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM conversation_memory")
        conn.commit()
    finally:
        conn.close()


def append_exchange(user_text: str, assistant_reply: str) -> None:
    """
    Store user + assistant messages as separate rows.
    """
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        now = datetime.now(timezone.utc).astimezone().isoformat()
        conn.execute(
            "INSERT INTO conversation_memory (role, content, created_at) VALUES (?, ?, ?)",
            ("user", user_text, now),
        )
        conn.execute(
            "INSERT INTO conversation_memory (role, content, created_at) VALUES (?, ?, ?)",
            ("assistant", assistant_reply, now),
        )
        conn.commit()
    finally:
        conn.close()


def get_recent_exchanges(limit: int = 20) -> list[dict[str, Any]]:
    """
    Returns messages for context window: [{role, content}, ...].
    """
    ensure_repo_ready()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT role, content
            FROM conversation_memory
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        # We fetched newest first; reverse to keep chronology.
        rows = list(reversed(rows))
        return [{"role": r["role"], "content": r["content"]} for r in rows]
    finally:
        conn.close()

