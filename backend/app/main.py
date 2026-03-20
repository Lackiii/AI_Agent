from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.config import BACKEND_PORT, BACKEND_HOST, BACKEND_WS_PATH
from app.db.database import init_schema
from app.db.reminders_repo import create_reminder, delete_reminder, list_reminders, ensure_repo_ready
from app.db.screenshots_repo import create_screenshot_record, list_screenshots
from app.db.persona_repo import get_effective_persona, reset_persona_override, save_persona_override
from app.db.memory_repo import append_exchange, clear_conversation_memory, get_recent_exchanges
from app.services.scheduler import create_scheduler, schedule_pending_on_startup, schedule_reminder
from app.services.ocr_service import run_paddle_ocr
from app.llm_client import chat_completion
from app.ws.manager import WebSocketManager


from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    ok: bool = True


class CreateReminderRequest(BaseModel):
    title: str = Field(min_length=1)
    # ISO 8601 string (with timezone offset).
    dueAt: Optional[str] = None
    rawText: Optional[str] = None


class DeleteReminderResponse(BaseModel):
    deleted: bool


class OcrScreenshotRequest(BaseModel):
    imageBase64: str
    capturedAt: Optional[str] = None
    filePath: Optional[str] = None


class PersonaOverrideRequest(BaseModel):
    content: str


class ChatRequest(BaseModel):
    text: str
    temperature: Optional[float] = None


app = FastAPI(title="AI Agent Backend (Reminders)")


@app.on_event("startup")
async def on_startup() -> None:
    ensure_repo_ready()
    init_schema()
    ws_manager = WebSocketManager()
    loop = asyncio.get_running_loop()
    scheduler = create_scheduler(ws_manager=ws_manager, loop=loop)
    scheduler.start()

    schedule_pending_on_startup(scheduler)

    app.state.ws_manager = ws_manager
    app.state.scheduler = scheduler


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(ok=True)


@app.get("/reminders")
async def get_reminders() -> list[dict]:
    return list_reminders()


@app.post("/reminders")
async def post_reminder(req: CreateReminderRequest) -> dict:
    payload, duplicate, past = create_reminder(
        title=req.title,
        due_at=req.dueAt,
        raw_text=req.rawText,
    )

    # Only schedule when backend created a new scheduled reminder.
    if payload.get("id") and payload.get("status") == "scheduled" and req.dueAt:
        schedule_reminder(
            scheduler=app.state.scheduler,
            reminder_id=payload["id"],
            due_at_iso=req.dueAt,
        )

    if duplicate:
        # For now we return 200 so Electron can decide UX (it already blocks duplicates).
        return payload
    if past:
        return payload
    return payload


@app.delete("/reminders/{reminder_id}", response_model=DeleteReminderResponse)
async def del_reminder(reminder_id: str) -> DeleteReminderResponse:
    deleted = delete_reminder(reminder_id)
    return DeleteReminderResponse(deleted=deleted)


@app.get("/screenshots")
async def get_screenshots(
    from_: Optional[str] = Query(default=None, alias="from"),
    to_: Optional[str] = Query(default=None, alias="to"),
) -> list[dict]:
    # Keep parameter names simple; Electron can map from/to -> from_/to_.
    return list_screenshots(from_iso=from_, to_iso=to_)


@app.post("/screenshots/ocr")
async def ocr_screenshot(req: OcrScreenshotRequest) -> dict:
    # Best-effort OCR. If PaddleOCR isn't installed, this returns "".
    ocr_text = await asyncio.to_thread(run_paddle_ocr, req.imageBase64)
    record = create_screenshot_record(
        captured_at_iso=req.capturedAt,
        file_path=req.filePath,
        ocr_text=ocr_text,
    )
    return record


@app.websocket(BACKEND_WS_PATH)
async def ws_reminders(websocket: WebSocket) -> None:
    ws_manager: WebSocketManager = app.state.ws_manager
    await ws_manager.connect(websocket)
    try:
        # Keep the socket open; client may send pings.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)


# ---------------- Persona + Memory + Chat (for backend completeness) ----------------


@app.get("/persona")
async def get_persona() -> dict:
    return {"persona": get_effective_persona()}


@app.post("/persona/override")
async def override_persona(req: PersonaOverrideRequest) -> dict:
    save_persona_override(req.content)
    return {"ok": True}


@app.post("/persona/reset")
async def reset_persona() -> dict:
    reset_persona_override()
    return {"ok": True}


@app.post("/memory/clear")
async def memory_clear() -> dict:
    clear_conversation_memory()
    return {"ok": True}


@app.get("/memory/recent")
async def memory_recent(window: int = 20) -> dict:
    # window is interpreted as max rows (user/assistant messages).
    return {"messages": get_recent_exchanges(limit=window)}


@app.post("/chat")
async def chat(req: ChatRequest) -> dict:
    persona = get_effective_persona()
    history = get_recent_exchanges(limit=20)

    messages = [{"role": "system", "content": persona}] + history + [
        {"role": "user", "content": req.text.strip()},
    ]

    reply = await chat_completion(messages=messages, temperature=req.temperature or 0.7)
    append_exchange(user_text=req.text, assistant_reply=reply)
    return {"reply": reply}


def _run() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    _run()

