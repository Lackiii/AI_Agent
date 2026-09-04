# 配置与环境变量：`.env`、换模型、改请求

## 环境变量文件

| 文件 | 作用 |
| --- | --- |
| 项目根目录 `.env` | 本地密钥与模型配置（**勿提交仓库**，已在 `.gitignore`） |
| `.env.example` | 模板，可复制为 `.env` 后填值 |

## 变量说明（主进程读取）

主进程在 `src/main-process/env.ts` 加载 `.env`，业务里通过 `llm.service.ts` 的 `getLlmConfig()` 使用：

| 变量 | 含义 | 默认（未设置时） |
| --- | --- | --- |
| `LLM_API_KEY` | Bearer Token | 无（必填才能对话） |
| `LLM_BASE_URL` | 兼容 OpenAI 的 API 根地址 | `https://api.deepseek.com` |
| `LLM_MODEL` | 模型名 | `deepseek-chat` |
| `LLM_VISION_MODEL` | 截图画面摘要用的视觉模型 id | 无（未设则跳过 caption） |
| `LLM_VISION_BASE_URL` | 视觉 API 根地址 | 回退 `LLM_BASE_URL` |
| `LLM_VISION_API_KEY` | 视觉 API Key | 回退 `LLM_API_KEY` |
| `BACKEND_BASE_URL` | FastAPI 后端地址 | `http://127.0.0.1:8000` |
| `AI_AGENT_USER_DATA_PATH` | Electron `userData` 绝对路径 | 系统默认 |

仍兼容旧名：`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`（见 `env.ts` 兜底逻辑）。

### 截图多模态摘要（可选）

采集后：OCR 入库 → Electron 调视觉模型生成短 `caption` → `PATCH /screenshots/{id}/caption`。  
需配置 **支持 `image_url` 的 OpenAI 兼容接口**；纯文本模型（如默认 `deepseek-chat`）不能直接当 `LLM_VISION_MODEL`。详见 [BACKEND_FASTAPI.md](./BACKEND_FASTAPI.md) §9、[SCREENSHOTS_GUIDE.md](./SCREENSHOTS_GUIDE.md)。

## 换一家模型（例如智谱 ChatGLM）

只要对方提供 **OpenAI 兼容** 的 `POST {base}/chat/completions`，通常只需改 `.env`：

```env
LLM_API_KEY=你的key
LLM_BASE_URL=https://（厂商文档里的 base）
LLM_MODEL=（厂商文档里的模型 id）
```

**无需改** `llm.service.ts` 的路径，除非厂商路径不是 `/chat/completions`（那就要改 `fetch` URL）。

## 改请求参数

编辑 **`src/main-process/llm.service.ts`**：

- `temperature`：`chatCompletion(messages, { temperature: 0.1 })` 第二个参数（抽取类已用低温）。
- 可增加 `max_tokens`、`top_p` 等：在 `body: JSON.stringify({ … })` 里与厂商文档对齐。

人设抽取、提醒抽取在各自 `*-extract.service.ts` 里调用 `chatCompletion`，可单独调温度。

## 开发时环境变量不生效

- 确认 `.env` 已保存且为 UTF-8。
- **完全退出** Electron 再 `npm run start`。
- 若用系统环境变量，需保证启动应用的终端/IDE 已继承该变量。

主进程启动顺序见 [MAIN_PROCESS.md](./MAIN_PROCESS.md) 中 `bootstrap.ts` / `env.ts`。
