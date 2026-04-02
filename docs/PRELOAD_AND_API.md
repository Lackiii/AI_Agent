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
| `assistantApi.llm.chat(text)` | `llm:chat` | 人设/提醒处理 + 带记忆对话；模型可调用资料夹、问候、通知等工具 |
| `assistantApi.memory.clear()` | `memory:clear` | 清空 `conversation-memory.json` |
| `assistantApi.memory.list()` | `memory:list` | 只读返回已存对话消息数组（每条含 `id`、`role`、`content`、`createdAt` 本地时间） |
| `assistantApi.memory.remove(id)` | `memory:remove` | 按 id 删除单条对话消息 |
| `assistantApi.persona.reset()` | `persona:reset` | 删除 `assistant-persona.json`，恢复默认人设 |
| `assistantApi.reminders.list/create/remove` | `reminder:*` | 读写 `reminders.json`（创建时可能同步后端） |
| `assistantApi.screenshots.list` | `screenshot:list` | 截图记录列表（对接 FastAPI 为主） |
| `assistantApi.screenshots.captureNow()` | `screenshot:captureNow` | 立即截图并提交 OCR |
| `assistantApi.screenshots.start(options)` | `screenshot:start` | 开启定时截图（`intervalMinutes` + 可选 `windowStart/windowEnd`） |
| `assistantApi.screenshots.stop()` | `screenshot:stop` | 停止定时截图 |
| `assistantApi.screenshots.status()` | `screenshot:status` | 获取采集状态（运行中、间隔、窗口、最近截图时间） |
| `assistantApi.screenshots.ocrStatus()` | `screenshot:ocrStatus` | OCR 引擎可用性状态 |
| `assistantApi.screenshots.pickRegion()` | `screenshot:pickRegion` | 打开交互式选框窗口，返回裁剪范围（用于去掉浏览器标签栏/地址栏等噪声） |
| `assistantApi.screenshots.clearRegion()` | `screenshot:region:clear` | 清除裁剪范围，恢复全屏 OCR |
| `assistantApi.screenshots.submitPickRegion(region)` | `screenshot:pickRegion:submit` | 选框页内部提交选区（一般不在业务页直接调用） |
| `assistantApi.screenshots.cancelPickRegion()` | `screenshot:pickRegion:cancel` | 选框页内部取消（一般不在业务页直接调用） |
| `assistantApi.screenshots.remove(id)` | `screenshot:delete` | 删除单条截图记录 |
| `assistantApi.screenshots.removeAll()` | `screenshot:deleteAll` | 删除全部截图记录 |
| `assistantApi.greeting.getSettings / setSettings` | `greeting:getSettings` / `greeting:setSettings` | 定时问候开关与间隔；保存后会重启主进程调度 |
| `assistantApi.greeting.sendTestNotification()` | `greeting:testNotification` | 发一条测试系统通知（handler 在 `bootstrap.ts`） |
| `assistantApi.vault.list()` | `vault:list` | 列出 `ai-vault` 下文件相对路径 |
| `assistantApi.vault.read(path)` | `vault:read` | 读资料夹内 UTF-8 文本 |
| `assistantApi.vault.delete(path)` | `vault:delete` | 删除资料夹内指定文件 |
| `assistantApi.navigation.onAppNavigate(cb)` | （`ipcRenderer.on('app:navigate')`） | 订阅主进程下发的路由跳转；返回取消订阅函数 |

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
