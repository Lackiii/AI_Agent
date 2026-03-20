# 人设文件说明

项目里和「助手人设」相关的有两处：

## 1. 默认人设（改完需重新打包 / 开发热更新）

**路径：** `src/config/persona.ts`  

这是代码里的**默认** system 人设。改这里的字符串后，保存文件；开发模式下重新跑 `npm run start`（或等 Vite 重编主进程，视改动而定）即会生效。

只要**没有**下面的「对话覆盖文件」，就会一直用这个默认。

## 2. 对话里保存的人设（覆盖默认）

当你在对话里描述人设并被系统识别保存后，会生成一个 JSON 文件，**优先级高于** `persona.ts`。

- **文件名：** `assistant-persona.json`
- **目录：** Electron 的 **userData**（因 `package.json` 里 `productName` 为 `ai_agent`）

常见位置：

| 系统 | 大致路径 |
| --- | --- |
| Windows | `%APPDATA%\ai_agent\assistant-persona.json`（一般为 `C:\Users\<你的用户名>\AppData\Roaming\ai_agent\`） |
| macOS | `~/Library/Application Support/ai_agent/assistant-persona.json` |

文件结构示例：

```json
{
  "version": 1,
  "content": "（这里是一整段人设说明，会作为 system prompt 使用）"
}
```

你可以用记事本 / VS Code **直接改 `content`**，保存后**重启应用**生效。

## 在对话里操作（无需按钮）

- **保存 / 更新人设：** 用自然语言说明即可（含「人设、性格、称呼」等更容易触发解析）。
- **恢复默认：** 例如说「恢复默认人设」「清除人设记忆」「重置人设」等（见 `persona-memory.service.ts` 内 `tryResetPersonaFromUserPhrase`）。

恢复默认会**删除** `assistant-persona.json`，之后重新使用 `src/config/persona.ts`。

---

其它模块修改说明见 **[文档索引 README.md](./README.md)**。
