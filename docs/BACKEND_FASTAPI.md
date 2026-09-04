# 后端说明（FastAPI + SQLite + APScheduler + WebSocket + OCR）

本说明文档用于整理论文中对应的后端技术栈，并指导你在本仓库里启动后端、核对接口、以及 Electron 端如何对接。

## 1. 技术栈对应论文（本仓库实现）

- Web 框架：`FastAPI`
- 数据存储：`SQLite`
- 定时调度：`APScheduler`
- 实时推送：`WebSocket`（推送提醒触发事件）
- LLM 接口：OpenAI-compatible `POST /chat/completions`
- OCR：`PaddleOCR`（当前为可选依赖；未安装时接口可用但 OCR 结果为空）

## 2. 后端启动

在项目根目录下启动：

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动成功后：
- `GET /health` 返回 `{"ok": true}`
- `WebSocket` 位于 `/ws`

## 3. 后端环境变量（`.env` 或系统环境变量）

主要变量如下（默认值已在 `backend/app/core/config.py` 中给出）：

- `BACKEND_HOST`：默认 `127.0.0.1`
- `BACKEND_PORT`：默认 `8000`
- `BACKEND_DATABASE_PATH`：默认 `./backend_data/app.sqlite3`
- `BACKEND_WS_PATH`：默认 `/ws`
- `BACKEND_TIMEZONE`：默认 `Asia/Shanghai`
- `REMINDER_DEDUPE_MINUTES`：提醒去重窗口，默认 `2`

LLM（用于 `/chat`、以及你后续把“人设抽取/提醒抽取”迁移到后端时会用到）：
- `LLM_API_KEY`：必填（OpenAI-compatible 的 Bearer token）
- `LLM_BASE_URL`：默认 `https://api.deepseek.com`
- `LLM_MODEL`：默认 `deepseek-chat`

默认人设：
- `DEFAULT_PERSONA`：默认已内置，与 `src/config/persona.ts` 保持一致（也可以在环境变量中覆盖）

## 4. 数据库表结构（SQLite）

默认数据库文件：`backend_data/app.sqlite3`

目前已建表（用于后续接入/论文一致性）：

- `reminders`
  - `status` 取值：`scheduled` / `fired`
  - 到点触发后会把 `status` 更新为 `fired` 并写入 `fired_at`
- `screenshots`
  - 保存 `captured_at`、`file_path`（可为空）、`ocr_text`、`ocr_status`、`ocr_error`
  - 以及可选画面摘要：`caption`、`caption_status`、`caption_error`
- `persona_override`
  - 保存用户通过对话覆盖的人设内容（只存一份，id=1）
- `conversation_memory`
  - 存储对话的 `user/assistant` 轮次（供 `/chat` 取最近窗口作为上下文）

## 5. REST API 端点清单

### Health

- `GET /health`

### Reminders

- `GET /reminders`
- `POST /reminders`
  - body：
    - `title`（string）
    - `dueAt`（ISO 8601 string，可选）
    - `rawText`（string，可选）
  - 行为：
    - 如果 `dueAt` 在当前时间之前：返回 `status="skipped"`，不创建调度任务
    - 如果命中去重：返回 `status="skipped"`，不创建调度任务
    - 成功创建：返回 `status="scheduled"`，并由后端 APScheduler 调度
- `DELETE /reminders/{reminder_id}`

### Screenshots

- `GET /screenshots?from=&to=`
  - 参数用 `from/to`（FastAPI 内部做了 alias，Electron 也可直接用同名）
- `DELETE /screenshots/{screenshot_id}`
  - 删除单条截图记录，返回 `{deleted: boolean}`
- `DELETE /screenshots`
  - 删除全部截图记录，返回 `{deletedCount: number}`
- `POST /screenshots/ocr`
  - body：
    - `imageBase64`（图片 base64，可为 data URL）
    - `capturedAt`（可选，ISO）
    - `filePath`（可选）
  - 返回：`{id, capturedAt, filePath, ocrText, ocrStatus, ocrError, caption?, captionStatus?, captionError?}`
- `PATCH /screenshots/{screenshot_id}/caption`
  - body：`{ caption?, captionStatus?, captionError? }`
  - 由 Electron 在视觉摘要完成后回写
- `GET /screenshots/ocr/status`
  - 返回 OCR 引擎可用性：`{available, engine, error?}`

### Persona & Memory（后端接口级骨架）

- `GET /persona`
- `POST /persona/override`（body：`{content}`）
- `POST /persona/reset`
- `POST /memory/clear`
- `GET /memory/recent?window=20`
- `POST /chat`
  - body：
    - `text`（string）
    - `temperature`（可选，number）
  - 返回：`{reply: string}`

## 6. WebSocket 推送（提醒触发）

- WebSocket 地址：`ws://127.0.0.1:8000/ws`
- 推送消息格式：

```json
{
  "type": "reminder_fired",
  "reminder": {
    "id": "…",
    "title": "…",
    "dueAt": "…",
    "createdAt": "…",
    "status": "fired",
    "firedAt": "…",
    "rawText": "…"
  }
}
```

Electron 端会收到该消息并用系统 `Notification` 弹窗。

## 7. Electron 端如何对接后端

你不需要手动改代码，仓库已做了“默认对接”：

- `src/main-process/bootstrap.ts`
  - 启动后会自动调用 `connectBackendReminderNotifications()` 连接后端 WS
- `src/main-process/backend-ws.ts`
  - 监听 `reminder_fired`，弹出系统通知
- `src/main-process/reminder.service.ts`
  - `createReminder/deleteReminder` 对后端做 Best-effort 同步
  - UI 仍以本地 JSON 作为存储来源之一（确保原型不被后端不可用影响）

可通过环境变量覆盖后端地址：
- `BACKEND_BASE_URL`：默认 `http://127.0.0.1:8000`

## 8. OCR 可选依赖说明（重要）

当前实现中，OCR 会尝试：
- `from paddleocr import PaddleOCR`

如果你的后端环境未安装 PaddleOCR：
- `/screenshots/ocr` 仍可调用
- `ocrStatus` 会是 `engine_unavailable`，`ocrText` 为空

## 9. 多模态画面摘要（Caption，可选）

采集链路：**截图 → 后端 OCR 入库 → Electron 主进程调用视觉模型写 caption → `PATCH /screenshots/{id}/caption` 回写**。

- OCR 仍是可检索文字底座；caption 是 1～3 句中文场景摘要（应用/在做什么/是否像报错）。
- 日常对话上下文只注入 `caption` + `ocrText`，**不把原图塞进对话**。
- Electron 环境变量（见根目录 `.env.example`）：
  - `LLM_VISION_MODEL`：必填才启用；未配置则 `captionStatus=skipped`
  - `LLM_VISION_BASE_URL`：缺省回退 `LLM_BASE_URL`
  - `LLM_VISION_API_KEY`：缺省回退 `LLM_API_KEY`
- 后端字段：`caption` / `caption_status` / `caption_error`
- 接口：`PATCH /screenshots/{screenshot_id}/caption`

