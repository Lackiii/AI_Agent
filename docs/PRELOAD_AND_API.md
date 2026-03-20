# Preload 与前端 API：怎么改、怎么加功能

Electron 安全模型下：**渲染进程默认不信任**，敏感能力放在**主进程**，通过 **preload** 用 `contextBridge` 暴露有限 API。

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/preload.ts` | `contextBridge.exposeInMainWorld('assistantApi', { … })` |
| `src/types/global.d.ts` | 声明 `Window` 上的 `assistantApi` / `deepseekApi` |
| `src/main-process/ipc/register.ts` | `ipcMain.handle('通道名', handler)`，与 preload `invoke` 一一对应 |

`forge.config.ts` 里 preload 入口是 **`src/preload.ts`**，构建产物名为 `preload.js`，由 `window.ts` 里 `preload: path.join(__dirname, 'preload.js')` 加载。

## 现有 `assistantApi` 与 IPC 通道

| 前端调用 | IPC 通道 | 主进程行为（摘要） |
| --- | --- | --- |
| `assistantApi.llm.chat(text)` | `llm:chat` | 人设/提醒处理 + 带记忆对话 |
| `assistantApi.memory.clear()` | `memory:clear` | 清空 `conversation-memory.json` |
| `assistantApi.persona.reset()` | `persona:reset` | 删除 `assistant-persona.json`（可选保留给调试） |
| `assistantApi.reminders.list/create/remove` | `reminder:*` | 读写 `reminders.json` |
| `assistantApi.screenshots.list` | `screenshot:list` | 占位列表 |

`deepseekApi.chat` 与 `llm:chat` **同源**，仅为兼容旧代码。

## 新增一项能力的标准步骤

假设要加 `assistantApi.foo.bar()`：

1. **主进程** `src/main-process/` 写业务（或扩展现有 service）。
2. **`ipc/register.ts`**：`ipcMain.handle('foo:bar', async (event, arg) => { … })`。
3. **`preload.ts`**：`ipcRenderer.invoke('foo:bar', arg)` 并挂到 `assistantApi`。
4. **`global.d.ts`**：给 `assistantApi` 增加类型。
5. **React** 页面里调用 `window.assistantApi.foo.bar(...)`。

改完需**重启 Electron**（主进程与 preload 一般不热更）。

## 注意事项

- **不要把 API Key 放进 preload 或渲染层**；密钥只在主进程读 `process.env`。
- 通道名建议统一前缀：`llm:`、`reminder:`，避免冲突。
- `invoke` 的 handler 抛错会传到渲染层 `Promise.reject`，前端用 `try/catch` 或 `.catch` 处理。
