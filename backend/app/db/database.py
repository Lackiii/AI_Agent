from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

from app.core.config import BACKEND_DATABASE_PATH


def _ensure_db_parent_dir() -> None:
    db_path = Path(BACKEND_DATABASE_PATH)
    if db_path.parent.exists():
        return
    db_path.parent.mkdir(parents=True, exist_ok=True)


def get_db_connection() -> sqlite3.Connection:
    """
    Create a new SQLite connection per operation.
    APScheduler runs in a background thread, so connections must be thread-safe.
    """
    _ensure_db_parent_dir()
    conn = sqlite3.connect(BACKEND_DATABASE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema() -> None:
    conn = get_db_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS reminders (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              due_at TEXT,
              raw_text TEXT,
              created_at TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'scheduled',
              fired_at TEXT,
              normalized_title TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_status_due
              ON reminders(status, due_at);

            CREATE TABLE IF NOT EXISTS screenshots (
              id TEXT PRIMARY KEY,
              captured_at TEXT NOT NULL,
              file_path TEXT,
              ocr_text TEXT,
              ocr_status TEXT,
              ocr_error TEXT,
              caption TEXT,
              caption_status TEXT,
              caption_error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_screenshots_captured_at
              ON screenshots(captured_at);

            -- Persona override (optional; default persona is in backend config)
            CREATE TABLE IF NOT EXISTS persona_override (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              content TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            -- Conversation memory (append-only; last N is used as context)
            CREATE TABLE IF NOT EXISTS conversation_memory (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_memory_created_at ON conversation_memory(created_at);
            """
        )
        # Lightweight migration for existing DBs (SQLite has no IF NOT EXISTS for columns).
        try:
            conn.execute("ALTER TABLE screenshots ADD COLUMN ocr_status TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE screenshots ADD COLUMN ocr_error TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE screenshots ADD COLUMN caption TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE screenshots ADD COLUMN caption_status TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE screenshots ADD COLUMN caption_error TEXT")
        except Exception:
            pass
        conn.commit()
    finally:
        conn.close()


def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Cursor]:
    cur = conn.cursor()
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()

