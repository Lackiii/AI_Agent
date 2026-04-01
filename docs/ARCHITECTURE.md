# 架构说明（对齐开题报告）

> **各模块「怎么改」**：见 **[docs/README.md](./README.md)** 中的分文档索引。

开题报告《基于 ChatGLM 的智能记忆聊天助手设计与实现》中的系统能力，在本 Electron 桌面端按**模块边界**落地为下列结构，便于后续接入 **FastAPI + SQLite + WebSocket + APScheduler + PaddleOCR** 等后端能力。

## 功能模块 ↔ 代码位置

| 报告模块 | 当前实现 | 说明 |
| --- | --- | --- |
| 智能对话 + 记忆 | `src/main-process/memory.service.ts`、`ipc/register.ts`（`llm:chat`） | **人设**：默认 `src/config/persona.ts`；用户可在对话中描述人设，经 `persona-extract.service.ts` 解析后写入 `userData/assistant-persona.json`，由 `persona-memory.service.ts` 覆盖默认。对话轮次记忆存 `conversation-memory.json`。对话请求会附带 **`datetime-context.ts`** 注入的本地日期时间，减少模型对「今天」等表述的偏差。 |
| AI 资料夹（随笔/笔记） | `src/main-process/ai-vault.service.ts`、`vault:*` IPC | 数据在 `userData/ai-vault/` 下；模型工具 **`vault_list` / `vault_read` / `vault_write` / `vault_delete`**（见 `llm.service.ts` + `runVaultTool`）。前端对话页可查看列表、预览、**删除**文件（与工具删除共用同一套路径校验）。 |
| 提醒记录 | `src/main-process/reminder.service.ts`、`reminder:*` IPC | 本地 `userData/reminders.json`，前端 `src/renderer/features/reminders/`。对话中含「提醒」等关键词时，主进程会通过 `reminder-extract.service.ts` 调用 LLM 抽取事项与时间并自动 `createReminder`。 |
| 定时问候 + 通知 | `greeting-settings.service.ts`、`greeting-scheduler.service.ts`、`greeting-notification.service.ts`、`greeting-tool.service.ts` | 设置存 `greeting-settings.json`；到点或用户通过工具 **`greeting_update`** 调整间隔。可调用 **`notification_show`** 立即弹出系统通知。测试通知 IPC 见下文 `greeting:testNotification`（在 `bootstrap.ts` 注册）。 |
| 定时截图 + OCR + 轨迹检索 | `src/main-process/screenshot.service.ts`、`screenshot:*` IPC | 已支持立即截图、定时采集（窗口/间隔，开启后窗口内会先立即采集一次）、**交互式框选 OCR 裁剪范围**（避免浏览器标签栏/地址栏噪声）、OCR 状态可观测、单条/全部删除；后端异常时可回退本地内存记录并与后端列表合并展示。对话链路接入 `screenshot_search` 工具用于“基于截图证据回答”，时间线按本地时间组织。 |
| 前端界面 | `src/renderer/` | React + TypeScript + `react-router-dom`（Hash 路由）+ **Ant Design**（`ConfigProvider` 主题、`Layout`/`Menu`/`Card` 等，见 `docs/llms.txt` 索引）。含**对话历史**页、**定时问候设置**侧栏抽屉等。 |

## 目录结构（摘要）

```
src/
  main.ts                      # Electron 主进程入口（仅引入 bootstrap）
  preload.ts                   # 暴露 window.assistantApi
  main-process/
    bootstrap.ts               # 应用生命周期（含部分 IPC，如测试通知）
    env.ts                     # .env 加载
    llm.service.ts             # LLM HTTP 调用 + 资料夹/问候/截图检索等工具声明
    memory.service.ts          # 对话记忆持久化
    ai-vault.service.ts        # AI 资料夹目录 list/read/write/delete + runVaultTool
    datetime-context.ts        # 注入当前本地时间 system 片段（对话用）
    reminder.service.ts        # 提醒持久化
    screenshot.service.ts      # 截图轨迹（采集/删除/OCR状态/检索工具执行）
    greeting-*.service.ts      # 定时问候、通知、工具调度等
    ipc/register.ts            # 统一注册 IPC（大半业务通道）
    window.ts                  # BrowserWindow
  renderer/
    main.tsx                   # React 挂载
    App.tsx                    # 路由
    layout/AppShell.tsx        # 主导航、问候设置抽屉
    features/                  # 按业务拆页面（chat / chat-history / reminders …）
    features/chat/ChatPage.css # 资料列表行悬停显示删除等样式
  shared/types/                # 前后端共享类型（领域模型）
  config/persona.ts            # 性格 / 人设
```

## 与论文技术栈的衔接

- **报告**：React + TS 前端，Python FastAPI + SQLite + WebSocket + APScheduler + ChatGLM + PaddleOCR。  
- **当前仓库**：Electron 一体化原型；**接口形态**（提醒列表、截图列表、对话）已按模块拆开，后续可将 `*.service.ts` 中的实现替换为 **HTTP/WebSocket 调用远端服务**，Renderer 侧几乎无需改路由结构。

## IPC 通道一览

主业务通道多在 **`ipc/register.ts`**；下列通道在 **`bootstrap.ts`** 注册（避免与 `register` 循环依赖）：`greeting:testNotification`。

- `llm:chat` / `deepseek:chat`：发送用户输入，返回模型回复（含记忆、可选工具调用：资料夹、定时问候、立即通知、截图检索）。
- `memory:clear`：清空本地对话记忆文件。
- `memory:list`：只读列出 `conversation-memory.json` 中的 user/assistant 消息。
- `memory:remove`：按消息 id 删除单条记忆（对话历史页可用）。
- `persona:reset`：清除人设覆盖文件，恢复默认 `persona.ts`。
- `greeting:getSettings` / `greeting:setSettings`：定时问候开关与间隔；保存后会重启主进程内调度。
- `greeting:testNotification`：立即发送一条测试系统通知（设置抽屉内按钮）。
- `reminder:list` | `reminder:create` | `reminder:delete`
- `screenshot:list`：截图记录列表（优先读 FastAPI 后端）。
- `screenshot:captureNow`：立即截图并提交 OCR。
- `screenshot:start` / `screenshot:stop` / `screenshot:status`：定时采集开关与状态。
- `screenshot:ocrStatus`：OCR 引擎可用性状态。
- `screenshot:delete` / `screenshot:deleteAll`：删除单条或全部截图记录。
- `vault:list`：列出 `userData/ai-vault/` 下所有文件相对路径。
- `vault:read`：按相对路径读 UTF-8 文本。
- `vault:delete`：删除资料夹内指定文件（路径校验同读写）。

导航类事件：主进程可向渲染进程发 **`app:navigate`**，preload 通过 **`assistantApi.navigation.onAppNavigate`** 订阅（侧栏路由联动等）。
