# 前端界面（Renderer）：改什么、去哪改

界面是 **React 19 + TypeScript + react-router-dom（Hash 路由）+ Ant Design 6**。

## 入口与路由

| 文件 | 作用 |
| --- | --- |
| `index.html` | 挂载点 `#app`，脚本入口 `/src/renderer/main.tsx` |
| `src/renderer/main.tsx` | `createRoot`、`HashRouter`、包一层 `AppTheme`（Ant Design） |
| `src/renderer/App.tsx` | `Routes`：各页面路径与 `AppShell` 布局 |
| `vite.renderer.config.ts` | Vite + `@vitejs/plugin-react`；一般只加别名或代理时改 |

### 新增一个页面（示例）

1. 在 `src/renderer/features/<名字>/` 新建 `XxxPage.tsx`（导出一个组件）。
2. 在 `App.tsx` 里加一条：`<Route path="/page/xxx" element={<XxxPage />} />`。
3. 在 `layout/AppShell.tsx` 的 `Menu` `items` 里加一项，`key` 与 path 一致，`onClick` 会 `navigate(key)`。

路由使用 **Hash**（`#/page/...`），方便 Electron `file://` 打包后也能跳转。

## 布局与主题（Ant Design）

| 文件 | 作用 | 常见修改 |
| --- | --- | --- |
| `src/renderer/providers/AppTheme.tsx` | `ConfigProvider`（中文 `locale`）、`theme.token` / `components` | 主色、圆角、紧凑算法、暗色可换 `theme.darkAlgorithm` |
| `src/renderer/layout/AppShell.tsx` | 左侧 `Layout.Sider` + `Menu`，右侧 `Outlet` | 改导航文案、图标、侧栏宽度 |
| `src/renderer/index.css` | 全局极少样式（根节点高度等） | 大面积样式优先用 antd `token` 或组件 `style` |

Ant Design 文档索引见仓库内 [llms.txt](./llms.txt)。

## 各功能页

| 路径 | 文件 | 说明 |
| --- | --- | --- |
| `/page/home` | `features/home/HomePage.tsx` | 首页欢迎与入口按钮 |
| `/page/pet` | `features/pet/DesktopPetPage.tsx` | 桌宠渲染页（仅桌宠透明窗口使用，不在主导航展示）；支持气泡显示与打开对话按钮 |
| `/page/chat` | `features/chat/ChatPage.tsx` | 对话输入、`assistantApi.llm.chat`；**「记忆与资料」下拉**：查看 `ai-vault` 列表（Modal）、预览、**删除**单文件（`vault:delete`）、**清空对话记忆**；删除按钮在列表行上 **悬停显示**（样式见同目录 **`ChatPage.css`**，Popconfirm 打开时用类名保持可见）。回复区 `components/MarkdownContent.tsx` |
| `/page/chat-history` | `features/chat/ChatHistoryPage.tsx` | 只读/管理本地对话记忆列表，可按条删除（`memory:remove`） |
| `/page/reminders` | `features/reminders/RemindersPage.tsx` | 提醒列表与表单 |
| `/page/screenshots` | `features/screenshots/ScreenshotsPage.tsx` | 截图轨迹：立即截图、定时采集（间隔+窗口）、**框选 OCR 范围**（裁剪后再识别，去掉标签栏/地址栏噪声）、OCR 状态展示、关键词检索、单条删除与一键删除（样式与历史页一致） |
| `/page/region-picker` | `features/screenshots/RegionPickerPage.tsx` | 全屏透明选框层（只给主进程选框窗口使用，正常导航不会进入） |

侧栏 **`layout/AppShell.tsx`**：主导航菜单；**设置** 抽屉（含 `greeting:*` 与 `pet:*`）；应用名「拉文杜拉」等文案亦在此。

改**文案、按钮、表单字段**：直接改对应 `*Page.tsx`。

## 类型与全局 API

- 前端调用 `window.assistantApi` 的类型在 **`src/types/global.d.ts`**。  
  若在 preload 里加了新方法，这里要同步声明，否则 TS 报错。

## 遗留文件说明

若仍存在 **`src/pages/chat.tsx`**（旧版单文件页面），当前路由**不会**使用它，可删除以免混淆。以 `src/renderer/features/chat/ChatPage.tsx` 为准。
