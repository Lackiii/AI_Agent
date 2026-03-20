# 架构说明（对齐开题报告）

> **各模块「怎么改」**：见 **[docs/README.md](./README.md)** 中的分文档索引。

开题报告《基于 ChatGLM 的智能记忆聊天助手设计与实现》中的系统能力，在本 Electron 桌面端按**模块边界**落地为下列结构，便于后续接入 **FastAPI + SQLite + WebSocket + APScheduler + PaddleOCR** 等后端能力。

## 功能模块 ↔ 代码位置

| 报告模块 | 当前实现 | 说明 |
| --- | --- | --- |
| 智能对话 + 记忆 | `src/main-process/memory.service.ts`、`ipc/register.ts`（`llm:chat`） | **人设**：默认 `src/config/persona.ts`；用户可在对话中描述人设，经 `persona-extract.service.ts` 解析后写入 `userData/assistant-persona.json`，由 `persona-memory.service.ts` 覆盖默认。对话轮次记忆存 `conversation-memory.json`。 |
| 提醒记录 | `src/main-process/reminder.service.ts`、`reminder:*` IPC | 本地 `userData/reminders.json`，前端 `src/renderer/features/reminders/`。对话中含「提醒」等关键词时，主进程会通过 `reminder-extract.service.ts` 调用 LLM 抽取事项与时间并自动 `createReminder`。 |
| 定时截图 + OCR + 轨迹检索 | `src/main-process/screenshot.service.ts`、`screenshot:list` IPC | 已对接后端 `GET /screenshots` 与 `POST /screenshots/ocr`；采集链路（`desktopCapturer`/定时采集）待你确认截图方法后补齐。 |
| 前端界面 | `src/renderer/` | React + TypeScript + `react-router-dom`（Hash 路由）+ **Ant Design**（`ConfigProvider` 主题、`Layout`/`Menu`/`Card` 等，见 `docs/llms.txt` 索引）。 |

## 目录结构（摘要）

```
src/
  main.ts                      # Electron 主进程入口（仅引入 bootstrap）
  preload.ts                   # 暴露 window.assistantApi
  main-process/
    bootstrap.ts               # 应用生命周期
    env.ts                     # .env 加载
    llm.service.ts             # LLM HTTP 调用
    memory.service.ts          # 对话记忆持久化
    reminder.service.ts        # 提醒持久化
    screenshot.service.ts      # 截图轨迹（占位）
    ipc/register.ts            # 统一注册 IPC
    window.ts                  # BrowserWindow
  renderer/
    main.tsx                   # React 挂载
    App.tsx                    # 路由
    layout/AppShell.tsx        # 主导航
    features/                  # 按业务拆页面
  shared/types/                # 前后端共享类型（领域模型）
  config/persona.ts            # 性格 / 人设
```

## 与论文技术栈的衔接

- **报告**：React + TS 前端，Python FastAPI + SQLite + WebSocket + APScheduler + ChatGLM + PaddleOCR。  
- **当前仓库**：Electron 一体化原型；**接口形态**（提醒列表、截图列表、对话）已按模块拆开，后续可将 `*.service.ts` 中的实现替换为 **HTTP/WebSocket 调用远端服务**，Renderer 侧几乎无需改路由结构。

## IPC 通道一览

- `llm:chat` / `deepseek:chat`：发送用户输入，返回模型回复（含记忆）。
- `memory:clear`：清空本地对话记忆文件。
- `reminder:list` | `reminder:create` | `reminder:delete`
- `screenshot:list`
