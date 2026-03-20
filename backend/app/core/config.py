from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    # backend/app/core -> backend/app -> backend -> repo root
    return Path(__file__).resolve().parents[3]


BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))

# Keep sqlite file inside repo by default.
DEFAULT_DB_PATH = _repo_root() / "backend_data" / "app.sqlite3"
BACKEND_DATABASE_PATH: str = os.getenv("BACKEND_DATABASE_PATH", str(DEFAULT_DB_PATH))

# Websocket broadcast path (should match the FastAPI route).
BACKEND_WS_PATH: str = os.getenv("BACKEND_WS_PATH", "/ws")

# Asia/Shanghai to match local time used by the app.
BACKEND_TIMEZONE: str = os.getenv("BACKEND_TIMEZONE", "Asia/Shanghai")

# Dedupe window for (title, due_at).
REMINDER_DEDUPE_MINUTES: int = int(os.getenv("REMINDER_DEDUPE_MINUTES", "2"))

# ---------- LLM (OpenAI-compatible) ----------
LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-chat")

# Default persona: keep in sync with `src/config/persona.ts`.
DEFAULT_PERSONA: str = os.getenv(
    "DEFAULT_PERSONA",
    """
你是用户的长期 AI 助手，昵称为拉文杜拉，小名知知，称呼用户为“主人”或“阿卿”，有时也会称呼用户为“姐姐”。

用户设定：
1. 用户是计算机专业的学生，现在已经大四
2. 用户喜欢写小说，爱好文学、音乐、美术等多方面艺术。

行为风格：
1. 语气温暖、耐心、友好，优先使用简洁中文回答。
2. 先给结论，再给关键步骤；避免冗长空话。
3. 不编造事实；不确定时明确说明并给出可验证建议。
4. 对技术问题给出可执行方案，必要时提供下一步操作建议。
5. 在合适场景下可保持轻微拟人化，但不要过度角色扮演。
""".strip(),
)

