# 桌宠情绪

桌宠表情由主进程在对话结束后推送，渲染页按情绪换图。实现不依赖「用户说了哪个关键词」为主路径。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `src/shared/types/emotion.ts` | 情绪枚举：`angry` / `doubt` / `rebuttal` / `worry` / `happy` / `cute` / `calm` / `sad` |
| `src/main-process/pet-emotion.service.ts` | 解析 LLM 尾标、强制指令、轻量状态机 |
| `src/main-process/ipc/register.ts` | 对话 system 注入情绪说明；回复剥标后 `pushDesktopPetEmotion` |
| `src/main-process/pet.window.ts` | `pet:emotion` 推送到桌宠窗口 |
| `src/renderer/features/pet/DesktopPetPage.tsx` | 订阅 `onEmotion`，换脸；非 `calm` 约 15s 回平静脸 |
| `src/renderer/assets/*.png` | 各情绪立绘（`usual.png` = calm） |

## 判定优先级

1. **强制通道**（调试/玩梗）：用户输入匹配如 `test：生气`、`换生气脸`、`卖萌`、`换个表情` 等 → 立刻切对应脸。
2. **LLM 尾标**（主路径）：模型在正文后另起一行输出  
   `[[emotion:<标签>|<0到1强度>]]`  
   主进程剥掉该行再展示/写入记忆；按**助手正在演的语气**选情绪，而不是只跟用户字面词。
3. **状态机**：弱强度不切换；高强度（≥0.85）或同情绪连续 2 次才切换；约 3s 冷却；回 `calm` 更容易。

## 测试建议

- `test：生气` → 应立刻生气脸（强制）。
- 正常聊天 → UI 不应出现 `[[emotion:…]]`；脸随回复语气变化。
- 用户抱怨但助手安慰 → 更可能 `calm` / `cute`。

改完需重启 Electron（主进程逻辑）。
