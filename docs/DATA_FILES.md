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
| `conversation-memory.json` | `memory.service.ts` | 最近若干轮 user/assistant 对话，用于上下文 | 可删 = 清空记忆；也可手改 JSON（不推荐） |
| `assistant-persona.json` | `persona-memory.service.ts` | 对话里保存的人设覆盖，字段 `content` | 直接编辑 `content` 后重启应用；删文件 = 用默认 `persona.ts` |
| `reminders.json` | `reminder.service.ts` | 提醒列表 | 可手改，注意 JSON 结构；更建议用界面或 IPC |

## 与「代码里的默认」关系

- **人设**：有 `assistant-persona.json` 则**完全以其中 `content` 为 system**；没有则用 `src/config/persona.ts`。详见 [PERSONA.md](./PERSONA.md)。
- **对话记忆**：仅影响多轮上下文，**不包含**人设全文。
- **提醒**：与对话记忆独立；对话里「下午两点提醒我看书」会追加写入 `reminders.json`。

## 备份与重置

- **重置对话**：前端「清空记忆」或删 `conversation-memory.json`。
- **重置人设覆盖**：对话说「恢复默认人设」或删 `assistant-persona.json`，见 [PERSONA.md](./PERSONA.md)。
- **清空提醒**：在提醒页删除条目，或编辑/删除 `reminders.json`（需关应用避免覆盖）。
