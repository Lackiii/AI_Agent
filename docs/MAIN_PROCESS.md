# 主进程：改什么、去哪改

主进程跑在 Node/Electron 里，负责窗口、读配置、调 LLM、写本地文件、注册 IPC。

## 入口与启动顺序

| 文件 | 作用 | 常见修改 |
| --- | --- | --- |
| `src/main.ts` | 唯一入口，只 `import './main-process/bootstrap'` | 一般**不用动** |
| `src/main-process/bootstrap.ts` | `loadProjectEnvironment` → `registerIpcHandlers` → `whenReady` 里 `createMainWindow` | 调整启动顺序、加 `app` 级事件 |
| `src/main-process/window.ts` | 创建 `BrowserWindow`、加载 Vite URL 或打包后的 `index.html` | 改窗口大小、标题、是否默认打开 DevTools |
| `src/main-process/env.ts` | 从多处路径加载 `.env` | 增加环境变量名、改 `.env` 查找路径 |

## 业务服务（逻辑核心）

| 文件 | 作用 | 常见修改 |
| --- | --- | --- |
| `src/main-process/llm.service.ts` | OpenAI 兼容 `POST /chat/completions` + **工具定义**（`vault_*`、`greeting_update`、`notification_show` 等） | 换路径、加 `max_tokens`、默认 `temperature`、增删工具 |
| `src/main-process/datetime-context.ts` | 为对话拼装「当前本地时间」类 system 片段 | 改时区展示格式、是否注入 |
| `src/main-process/memory.service.ts` | 对话轮次写入 `userData/conversation-memory.json` | 改保存条数上限、文件格式 |
| `src/main-process/ai-vault.service.ts` | `userData/ai-vault` 下列表/读/写/删、`runVaultTool` | 改单文件大小上限、是否 prune 空目录 |
| `src/main-process/persona-memory.service.ts` | 人设覆盖文件 `assistant-persona.json` | 改文件名、是否与默认人设合并而非覆盖 |
| `src/main-process/persona-extract.service.ts` | 用 LLM 从用户话里抽「新人设」 | 改触发关键词、system 提示词、JSON 字段 |
| `src/main-process/reminder.service.ts` | 提醒 CRUD → `reminders.json`（同时 best-effort 同步后端） | 改存储结构、以后换 SQLite 可整文件替换实现 |
| `src/main-process/reminder-extract.service.ts` | 从对话抽提醒并自动创建 | 改关键词、抽取提示词 |
| `src/main-process/screenshot.service.ts` | 截图列表接口化（优先读后端） | 接 `desktopCapturer`、写磁盘、调 OCR |
| `src/main-process/greeting-settings.service.ts` | `greeting-settings.json` 读写 | 改默认间隔枚举 |
| `src/main-process/greeting-scheduler.service.ts` | 定时触发问候、与 LLM/通知联动 | 改调度策略 |
| `src/main-process/greeting-notification.service.ts` | 系统 `Notification`、立即通知工具 | 改通知文案模板 |
| `src/main-process/greeting-tool.service.ts` | 解析 `greeting_update` 工具参数 | 改 interval 映射 |
| `src/main-process/assistant-tools.service.ts` | 将模型 tool 名分发到各 `run*Tool` | 新增非 vault 类工具时在此扩展 |
| `src/main-process/startup-greeting.service.ts` | 启动时（非同日复开）先发载入中通知，再调一次 LLM 生成问候；`china-long-holidays.ts` 提供国庆与春节区间判断 | 改昵称、句式、长假表、同日跳过策略 |
| `src/main-process/china-long-holidays.ts` | 春节区间表 + 国庆 10/01–10/07，供启动问候判断是否「隔周且跨长假」 | 每年国务院放假安排公布后更新春节日期 |

## IPC 汇总与对话流水线

**统一注册处：** `src/main-process/ipc/register.ts`（另见 **`bootstrap.ts`** 中 `greeting:testNotification`）。

- 绝大多数 `ipcMain.handle('xxx', …)` 在 `register.ts`。
- **`handleLlmChat` 顺序很重要**：先 `tryResetPersonaFromUserPhrase` → 再人设抽取保存 → 再提醒抽取 → 再用 `getEffectivePersona()` 拼 system → 主对话 → 拼接 footer。

要**改对话行为**（例如少调一次 LLM、改 footer 文案）：主要改这个文件 + 上面对应 `*-extract.service.ts`。

## 默认人设（代码内）

`src/config/persona.ts`：无本地覆盖时的 system 文本。详见 [PERSONA.md](./PERSONA.md)。

## 与渲染层的关系

渲染进程**不能**直接 `fs` / `fetch` 带密钥的请求；只能通过 **preload 暴露的方法** → **IPC** → 主进程。新增能力时顺序通常是：

`service` → `register.ts` 里 `handle` → `preload.ts` → `src/types/global.d.ts` → React 页面调用。

详见 [PRELOAD_AND_API.md](./PRELOAD_AND_API.md)。
