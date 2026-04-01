import { runNotificationShowTool } from './greeting-notification.service';
import { runVaultTool } from './ai-vault.service';
import { runGreetingUpdateTool } from './greeting-tool.service';
import { runScreenshotTool } from './screenshot.service';

export const runAssistantTool = async (name: string, argsJson: string): Promise<string> => {
  if (name === 'notification_show') {
    return runNotificationShowTool(argsJson);
  }
  if (name === 'greeting_update') {
    const result = runGreetingUpdateTool(argsJson);
    try {
      const parsed = JSON.parse(result) as { ok?: boolean };
      if (parsed.ok === true) {
        // 避免 greeting-scheduler ↔ llm ↔ assistant-tools 静态循环依赖
        queueMicrotask(() => {
          void import('./greeting-scheduler.service')
            .then((m) => m.restartGreetingScheduler())
            .catch((error) => {
              console.warn('[greeting] Failed to restart scheduler after greeting_update tool:', error);
            });
        });
      }
    } catch {
      // ignore
    }
    return result;
  }
  if (name === 'screenshot_search') {
    return runScreenshotTool(name, argsJson);
  }
  return runVaultTool(name, argsJson);
};
