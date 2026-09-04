# 截图功能使用手册（演示版）

本页面向演示/答辩，快速说明「截图轨迹」能做什么、怎么用、怎么看结果。

## 1. 功能概览

- 定时截图：可配置间隔与采集窗口（例如 09:00-18:00）
- OCR 入库：自动提取截图中的文字并保存状态
- **画面摘要（caption，可选）**：配置 `LLM_VISION_*` 后，采集时用视觉模型写 1～3 句场景描述
- 轨迹检索：支持按关键词筛选 **caption + OCR** 文本
- 记录管理：支持单条删除与一键删除全部记录
- 对话联动：助手可基于画面摘要与 OCR 回答“刚才在做什么/哪里报错”

## 2. 页面入口

- 左侧导航：`截图轨迹`
- 页面文件：`src/renderer/features/screenshots/ScreenshotsPage.tsx`

## 3. 基础操作流程

1. 点击 `立即截图`，触发一次采集 + OCR（及可选 caption）。
2. 如需自动采集，设置：
   - 间隔（分钟）
   - 开始时间 `HH:mm`
   - 结束时间 `HH:mm`
3. 点击 `开启定时截图`。
   - 若当前时间在采集窗口内，会立即执行一次截图（不必等待首个间隔周期）。
   - 定时运行期间页面会自动刷新列表（约每 15 秒）以展示新增记录。
4. 在检索框输入关键词，查看命中记录（可匹配摘要或 OCR）。

## 4. 状态说明

每条记录会显示 OCR 状态：

- `识别成功`：OCR 文本可用
- `未识别到文字`：截图中无可识别文本或文本过弱
- `OCR 未安装`：后端缺少 `paddleocr/paddlepaddle`
- `后端不可达`：Electron 调用后端失败，回退本地内存记录
- `OCR 报错`：OCR 引擎运行失败（会展示错误详情）
- `状态未知`：历史记录未写入状态字段或数据异常

画面摘要状态（若已跑过 caption 链路）：

- `已生成`（`captionStatus=ok`）：列表会显示「摘要：…」
- `已跳过`（`skipped`）：通常未配置 `LLM_VISION_MODEL`
- `失败`（`error`）：视觉 API 报错（见「摘要备注」）

启用视觉摘要需在根目录 `.env` 配置支持看图的 OpenAI 兼容接口，见 [CONFIG_ENV_AND_LLM.md](./CONFIG_ENV_AND_LLM.md)。

## 5. 删除与数据管理

- 单条删除：列表右侧悬停显示删除图标（与对话历史样式一致）
- 一键删除：工具栏 `一键删除`（二次确认）

后端可用时删除的是 SQLite 中的持久记录；后端不可用时删除的是本地内存回退记录。

## 6. 与助手对话联动

模型工具支持：

- `screenshot_search`：按关键词/时间/OCR 状态检索轨迹（关键词也会匹配 caption）
- 工具返回的时间线和上下文中的截图时间统一为**本地时间**（`YYYY-MM-DD HH:mm:ss`）
- 对话 system 会注入最近截图的**画面摘要优先、OCR 其次**的片段

典型提问：

- “我刚刚在做什么？”
- “刚才哪个时间点开始报错？”
- “根据截图给我 3 条排查建议”

助手会优先基于截图证据回答；证据不足时会明确说明。

日常对话**不会**把原图发给聊天模型，只使用已生成的文本摘要与 OCR，以控制成本与隐私。

## 7. 后端接口（截图相关）

- `GET /screenshots`
- `POST /screenshots/ocr`
- `PATCH /screenshots/{screenshot_id}/caption`（回写画面摘要）
- `GET /screenshots/ocr/status`
- `DELETE /screenshots/{screenshot_id}`
- `DELETE /screenshots`

## 8. 常见问题

- `No handler registered for 'screenshot:*'`
  - 重启 Electron 主进程（`npm run start` 终端输入 `rs` 或重启进程）
- OCR 始终为空
  - 先看页面顶部 OCR 引擎状态
  - 检查后端依赖是否在同一 Python 环境
- 画面摘要一直「已跳过」
  - 在 `.env` 配置 `LLM_VISION_MODEL`（及可选 `LLM_VISION_BASE_URL` / `LLM_VISION_API_KEY`），并**重启** Electron
- 自动截图后历史里看不到
  - 开启定时后先观察是否立刻新增 1 条（窗口内会立即截图）
  - 定时运行中可等待 15 秒自动刷新，或手动点击 `刷新`
  - 若后端短时不可达，会生成本地兜底记录并显示在历史中（应用重启后本地兜底记录不会保留）
