import { runNotificationShowTool } from './greeting-notification.service';
import { runVaultTool } from './ai-vault.service';
import { runGreetingUpdateTool } from './greeting-tool.service';

export const runAssistantTool = (name: string, argsJson: string): string => {
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
            .catch(() => {});
        });
      }
    } catch {
      // ignore
    }
    return result;
  }
  return runVaultTool(name, argsJson);
};
