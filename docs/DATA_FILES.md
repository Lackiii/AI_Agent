# 用户数据文件：都存在哪、改了会怎样

应用运行后，会在 Electron **`userData`** 目录下写 JSON（路径与 `package.json` 的 `productName` 有关，当前为 **`ai_agent`**）。

## 目录速查

| 系统 | 典型路径 |
| --- | --- |
| Windows | `%APPDATA%\ai_agent\` |
| macOS | `~/Library/Application Support/ai_agent/` |

## 文件一览

| 文件名 | 谁写入 | 内容含义 | 你怎么改 |
| --- | --- | --- | --- |
| `conversation-memory.json` | `memory.service.ts` | 最近若干轮 user/assistant 对话，用于上下文；每条含 `id` 与本地时间 `createdAt`（ISO + 时区偏移） | 可删 = 清空记忆；也可手改 JSON（不推荐） |
| `assistant-persona.json` | `persona-memory.service.ts` | 对话里保存的人设覆盖，字段 `content` | 直接编辑 `content` 后重启应用；删文件 = 用默认 `persona.ts` |
| `reminders.json` | `reminder.service.ts` | 提醒列表 | 可手改，注意 JSON 结构；更建议用界面或 IPC |
| `greeting-settings.json` | `greeting-settings.service.ts` | 定时问候开关与间隔（`enabled`、`intervalMode`） | 侧栏「定时问候设置」抽屉会写；删文件 = 恢复默认（关闭、30 分钟档） |
| `startup-greeting-state.json` | `startup-greeting.service.ts` | 上次触发「启动问候」的本地日期（`lastGreetingLocalDate`），用于同日再次启动时跳过问候链 | 删文件后下次启动视为首次/隔日逻辑重算；不涉及密钥 |

## 目录：`ai-vault/`（AI 资料夹）

| 路径 | 谁写入 | 内容含义 | 你怎么改 |
| --- | --- | --- | --- |
| `ai-vault/**` | `ai-vault.service.ts`（对话中 **`vault_write` 工具** 或等价 IPC） | 助手保存的随笔、笔记等 **UTF-8 文本**；列表中为相对路径（可含子目录） | **应用内**：对话页「记忆与资料」→ 查看已存资料 → 预览或删除单文件。**手动**：关应用后直接删 `userData/ai-vault/` 下文件；勿用 `..` 越界路径（代码侧会拒绝） |

删除子目录内最后一个文件后，**空目录可能仍存在**（当前实现不自动 prune）。

## 后端 SQLite（截图轨迹）

当后端 FastAPI 启用时，截图轨迹写入 `backend_data/app.sqlite3`（`screenshots` 表）：

- 关键字段：`captured_at`、`ocr_text`、`ocr_status`、`ocr_error`
- 前端「截图轨迹」页的**单条删除**与**一键删除**会通过后端接口删除对应记录
- 后端不可用时，主进程会回退到内存记录（重启后不保留）；当前列表会合并展示后端与本地兜底记录，避免短时异常导致“记录消失”

## 与「代码里的默认」关系

- **人设**：有 `assistant-persona.json` 则**完全以其中 `content` 为 system**；没有则用 `src/config/persona.ts`。详见 [PERSONA.md](./PERSONA.md)。
- **对话记忆**：仅影响多轮上下文，**不包含**人设全文。
- **提醒**：与对话记忆独立；对话里「下午两点提醒我看书」会追加写入 `reminders.json`。

## 备份与重置

- **重置对话**：前端「记忆与资料」菜单里的「清空记忆」，或删 `conversation-memory.json`。
- **重置人设覆盖**：对话说「恢复默认人设」或删 `assistant-persona.json`，见 [PERSONA.md](./PERSONA.md)。
- **清空提醒**：在提醒页删除条目，或编辑/删除 `reminders.json`（需关应用避免覆盖）。
- **清空资料夹**：在对话页已存资料列表逐条删除，或退出应用后删除整个 `ai-vault` 目录（下次启动会按需再建）。
