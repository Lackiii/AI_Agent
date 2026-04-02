# 构建、脚本与常见问题

## npm 脚本（`package.json`）

| 命令 | 作用 |
| --- | --- |
| `npm run start` | 开发：Electron Forge + Vite，热更新**主要针对渲染层** |
| `npm run lint` | ESLint（`.ts` / `.tsx`） |
| `npm run package` | 打未安装包目录 |
| `npm run make` | 生成各平台安装包（依赖本机环境） |
| `npm run publish` | 发布（需配置 Forge publish） |

## 配置文件位置

| 文件 | 作用 |
| --- | --- |
| `forge.config.ts` | Electron Forge：入口 `src/main.ts` / `src/preload.ts`、Vite 插件 |
| `vite.main.config.ts` | 主进程 Vite 打包 |
| `vite.preload.config.ts` | Preload 打包 |
| `vite.renderer.config.ts` | 渲染层 Vite + React 插件 |
| `tsconfig.json` | TypeScript（含 `jsx`） |

## 改了主进程 / preload 不生效

- 保存后**重启** `npm run start`（或终端里 Forge 提示的 `rs` 重载主进程，视版本而定）。
- Preload 变更通常也要**重启窗口**。

## `No handler registered for 'llm:chat'`

说明 IPC 未注册成功。已做修复：`bootstrap.ts` 在 `app.whenReady()` 后再注册 handler；`env.ts` 对 `getAppPath()` 做了保护。

若仍出现：看终端主进程是否报错；确认没有旧进程占用。

## `No handler registered for 'screenshot:*'`

- 常见于新增了截图 IPC（如 `screenshot:ocrStatus`、`screenshot:deleteAll`）后未重启主进程。
- 处理：在 `npm run start` 终端输入 `rs`（或直接重启开发进程）。

## 渲染层白屏 / 路由 404

- Hash 路由地址应为 `#/page/home` 形式。
- 打开 DevTools 看 Console 报错（`window.ts` 里开发模式会 `openDevTools`）。

## Autofill 相关 DevTools 报错

控制台里 `Autofill.enable` 等失败多为 **Chromium DevTools 与 Electron 版本差异**，一般**可忽略**，不影响业务。

## 依赖与 Node

- 使用仓库 `package-lock.json` 对应版本安装：`npm install`。
- 若 `antd` 等与 Vite 版本冲突，以当前 `package.json` 为准；不要随意升 major 除非对照官方文档。
