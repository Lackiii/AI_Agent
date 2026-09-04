# 文档索引

按你想改的内容选对应文件即可。

| 文档 | 适合场景 |
| --- | --- |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 整体架构、模块与开题报告对应关系、IPC 列表总览 |
| **[PERSONA.md](./PERSONA.md)** | 默认人设 `persona.ts`、对话覆盖文件路径、对话里如何恢复默认 |
| **[MAIN_PROCESS.md](./MAIN_PROCESS.md)** | 改主进程：窗口、启动顺序、各 `*.service.ts`、对话/提醒/人设流水线 |
| **[RENDERER_UI.md](./RENDERER_UI.md)** | 改界面：页面、路由、Ant Design 主题与布局 |
| **[PRELOAD_AND_API.md](./PRELOAD_AND_API.md)** | 改 `preload`、前端 `window.assistantApi`、新增 IPC 通道 |
| **[CONFIG_ENV_AND_LLM.md](./CONFIG_ENV_AND_LLM.md)** | `.env`、换模型厂商、改请求参数与温度 |
| **[DATA_FILES.md](./DATA_FILES.md)** | 用户数据目录：`*.json`、**`ai-vault/`** 资料夹路径与重置方式 |
| **[BACKEND_FASTAPI.md](./BACKEND_FASTAPI.md)** | FastAPI 后端：SQLite/APScheduler/WS/OCR/多模态 caption 接入说明 |
| **[SCREENSHOTS_GUIDE.md](./SCREENSHOTS_GUIDE.md)** | 截图轨迹功能使用手册（操作、OCR、画面摘要、对话联动、演示） |
| **[PET_EMOTION.md](./PET_EMOTION.md)** | 桌宠情绪：LLM 尾标、状态机、强制调试通道 |
| **[FLOWCHART.md](./FLOWCHART.md)** | 项目流程图（启动流程、对话链路、模块分层） |
| **[BUILD_AND_TROUBLESHOOT.md](./BUILD_AND_TROUBLESHOOT.md)** | 脚本命令、打包、常见问题（如 IPC 未注册） |
| **[llms.txt](./llms.txt)** | Ant Design 官方文档索引（外链汇总） |

建议顺序：先扫 **ARCHITECTURE.md** → 按需深入某一篇。
