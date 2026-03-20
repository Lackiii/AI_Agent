from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL


async def chat_completion(messages: list[dict[str, str]], temperature: float = 0.7) -> str:
    """
    Call OpenAI-compatible `/chat/completions`.
    Electron 端 `src/main-process/llm.service.ts` 使用的就是同一类接口。
    """
    api_key = LLM_API_KEY.strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY is missing for backend.")

    base_url = LLM_BASE_URL.rstrip("/")
    url = f"{base_url}/chat/completions"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": LLM_MODEL,
                "messages": messages,
                "temperature": temperature,
            },
        )

    data = resp.json()
    if resp.status_code >= 400:
        msg = (data.get("error") or {}).get("message") or f"Request failed: {resp.status_code}"
        raise RuntimeError(msg)

    return (
        (data.get("choices") or [{}])[0]
        .get("message", {})
        .get("content", "")
    )

