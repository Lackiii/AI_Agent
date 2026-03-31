import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getEnvLoadReport } from '../env';
import { getVaultRootPath, vaultDeleteFile, vaultListFiles, vaultReadFile } from '../ai-vault.service';
import { chatCompletionWithAssistantTools, getLlmConfig } from '../llm.service';
import {
  appendExchange,
  appendNotificationTurn,
  clearConversationMemory,
  getConversationHistory,
  getRecentConversation,
  removeMessageById,
} from '../memory.service';
import { takePendingNotifications } from '../notification-memory-queue';
import { extractPersonaFromNaturalLanguage, mightContainPersonaIntent } from '../persona-extract.service';
import {
  clearPersonaOverride,
  getEffectivePersona,
  savePersonaOverride,
  tryResetPersonaFromUserPhrase,
} from '../persona-memory.service';
import { extractReminderFromNaturalLanguage, mightContainReminderIntent } from '../reminder-extract.service';
import { createReminder, deleteReminder, isDuplicateReminder, listReminders } from '../reminder.service';
import {
  captureScreenshotNow,
  getOcrEngineStatus,
  getScreenshotCaptureStatus,
  listScreenshots,
  startScreenshotCapture,
  stopScreenshotCapture,
} from '../screenshot.service';
import { buildLocalDateTimeSystemMessage } from '../datetime-context';
import { shouldDisableTimedGreeting } from '../greeting-intent-heuristic.service';
import { notifyGreetingSettingsChange } from '../greeting-notification.service';
import { getGreetingSettings, setGreetingSettings } from '../greeting-settings.service';
import { restartGreetingScheduler } from '../greeting-scheduler.service';
import type { CreateReminderInput, ScreenshotCaptureStartOptions, ScreenshotListFilter } from '../../shared/types/domain';
import type { GreetingSettingsDTO } from '../../shared/types/greeting';
import type { ChatMessage } from '../../shared/types/llm';
import type { VaultReadResult } from '../../shared/types/vault';

const MEMORY_WINDOW = 20;

const hourToChineseClock = (hour24: number): string => {
  const h12 = hour24 % 12;
  const hour = h12 === 0 ? 12 : h12;
  const map: Record<number, string> = {
    1: '一点',
    2: '两点',
    3: '三点',
    4: '四点',
    5: '五点',
    6: '六点',
    7: '七点',
    8: '八点',
    9: '九点',
    10: '十点',
    11: '十一点',
    12: '十二点',
  };
  return map[hour] ?? `${hour}点`;
};

const flushPendingNotificationsToMemory = (): void => {
  for (const p of takePendingNotifications()) {
    appendNotificationTurn(p.body, p.title || '拉文杜拉');
  }
};

const handleLlmChat = async (_event: IpcMainInvokeEvent, prompt: string) => {
  const { apiKey } = getLlmConfig();
  if (!apiKey) {
    const report = getEnvLoadReport();
    throw new Error(
      `LLM_API_KEY is missing. envLoadedFrom=${report.loadedFrom ?? 'none'} parsedKeys=${report.parsedKeys.join(',') || 'none'} cwd=${process.cwd()} triedPaths=${report.triedPaths.join('|') || 'none'}`,
    );
  }

  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Empty prompt.');
  }

  let greetingFooter = '';
  if (shouldDisableTimedGreeting(trimmed)) {
    setGreetingSettings({ enabled: false });
    restartGreetingScheduler();
    greetingFooter = '\n\n—\n✓ 已关闭定时问候，好好休息，明天见～';
  }

  let personaFooter = '';
  const didResetPersona = tryResetPersonaFromUserPhrase(trimmed);
  if (didResetPersona) {
    personaFooter = `\n\n—\n✓ 已恢复为默认人设（与项目里 src/config/persona.ts 一致）。`;
  } else if (mightContainPersonaIntent(trimmed)) {
    try {
      const newPersona = await extractPersonaFromNaturalLanguage(trimmed);
      if (newPersona) {
        savePersonaOverride(newPersona);
        personaFooter = `\n\n—\n✓ 已记住你的人设，后续对话将按此设定回复。需要恢复默认时，在对话里说「恢复默认人设」即可。`;
      }
    } catch {
      // 抽取失败不阻断对话
    }
  }

  let reminderActionText = '';
  let reminderSkipPersonaFooter = false;
  let reminderOutcome: 'none' | 'created' | 'duplicate' | 'past' = 'none';
  let reminderShouldShortReply = false;
  if (mightContainReminderIntent(trimmed)) {
    try {
      const extracted = await extractReminderFromNaturalLanguage(trimmed);
      if (extracted) {
        const nowMs = Date.now();
        const dueAtMs = extracted.dueAt ? Date.parse(extracted.dueAt) : NaN;

        // 如果抽取出的 dueAt 已经早于当前时间（给一点容忍），认为用户“看错时间/写错时间”，阻断创建。
        if (!Number.isNaN(dueAtMs) && dueAtMs < nowMs - 60 * 1000) {
          const d = new Date(dueAtMs);
          reminderOutcome = 'past';
          reminderSkipPersonaFooter = true;
          reminderShouldShortReply = true;
          reminderActionText = `现在已经过了${hourToChineseClock(d.getHours())}了哦，主人是不是看错时间啦？`;
        } else {
          const dup = isDuplicateReminder(extracted);
          if (dup.duplicate) {
            reminderOutcome = 'duplicate';
            reminderSkipPersonaFooter = true;
            reminderShouldShortReply = true;
            reminderActionText = '主人，这个事项你已经让知知提醒过啦~，并阻断事项的创建';
          } else {
            await createReminder(extracted);
            reminderOutcome = 'created';
            const timeHint = extracted.dueAt ? `，时间：${extracted.dueAt}` : '';
            reminderActionText = `\n\n—\n✓ 已为你加入提醒列表：「${extracted.title}」${timeHint}`;
          }
        }
      }
    } catch {
      // 抽取失败时不阻断正常对话
    }
  }

  const history = getRecentConversation(MEMORY_WINDOW);
  const messages: ChatMessage[] = [{ role: 'system', content: getEffectivePersona() }];

  messages.push({ role: 'system', content: buildLocalDateTimeSystemMessage() });

  messages.push({
    role: 'system',
    content: `你拥有工具：
1) vault_list / vault_read / vault_write / vault_delete：只能访问本机用户资料目录下的 AI 资料夹（其它路径一律不可用）。资料夹绝对路径：${getVaultRootPath()}。用户让你保存随笔/笔记/草稿时，必须用 vault_write 写入完整正文；未调用工具则视为未保存。用户明确要求删除资料夹内某个已存文件时，用 vault_delete。
2) notification_show：立刻弹出一条系统通知（Toast），且正文会写入对话记忆（用户可在「对话历史」看到），便于你记得自己刚通过弹窗说过什么。用户要求「马上/立即弹窗或通知测试」等必须调用；参数 body 为通知正文。
3) greeting_update：控制「定时主动问候」（到点发系统通知、一两句关心话，用户未发消息也会触发）。用户希望每隔一段时间被提醒休息、喝水、陪聊、写代码间歇等，须调用本工具开启并设定间隔（如半小时用 interval_mode=30m，或 interval_minutes=30）；用户说下班、明天见、再见、不用提醒、关掉问候等，须设 enabled=false。若用户只是描述需求，你应在回复中确认已生效（并实际调用工具）。`,
  });

  if (reminderOutcome === 'created') {
    messages.push({
      role: 'system',
      content:
        '用户的输入中包含“设置提醒”的请求。提醒已经由系统成功处理，并会在回复末尾追加确认信息。你只需要正常回答用户的其它内容，不要说“无法主动发送提醒/通知”，也不要重复提醒确认。',
    });
  }

  messages.push(...history, { role: 'user', content: trimmed });

  // 仅在“重复/过时”场景短路，避免把固定文案夹杂进主回复里。
  if (reminderShouldShortReply) {
    const finalReply = `${reminderActionText}${reminderSkipPersonaFooter ? '' : personaFooter}${greetingFooter}`;
    flushPendingNotificationsToMemory();
    appendExchange(trimmed, finalReply);
    return finalReply;
  }

  let reply: string;
  try {
    reply = await chatCompletionWithAssistantTools(messages);
  } catch (e) {
    takePendingNotifications();
    throw e;
  }
  const fullReply = `${reply}${reminderSkipPersonaFooter ? '' : personaFooter}${reminderActionText}${greetingFooter}`;
  flushPendingNotificationsToMemory();
  // 只把主回复写入记忆，避免把操作性 footer 反复带入上下文导致重复。
  appendExchange(trimmed, reply);
  return fullReply;
};

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('llm:chat');
  ipcMain.removeHandler('memory:clear');
  ipcMain.removeHandler('memory:list');
  ipcMain.removeHandler('memory:remove');
  ipcMain.removeHandler('persona:reset');
  ipcMain.removeHandler('reminder:list');
  ipcMain.removeHandler('reminder:create');
  ipcMain.removeHandler('reminder:delete');
  ipcMain.removeHandler('screenshot:list');
  ipcMain.removeHandler('screenshot:captureNow');
  ipcMain.removeHandler('screenshot:start');
  ipcMain.removeHandler('screenshot:stop');
  ipcMain.removeHandler('screenshot:status');
  ipcMain.removeHandler('screenshot:ocrStatus');
  ipcMain.removeHandler('deepseek:chat');
  ipcMain.removeHandler('greeting:getSettings');
  ipcMain.removeHandler('greeting:setSettings');
  ipcMain.removeHandler('vault:list');
  ipcMain.removeHandler('vault:read');

  ipcMain.handle('llm:chat', handleLlmChat);
  ipcMain.handle('deepseek:chat', handleLlmChat);

  ipcMain.handle('memory:clear', async () => {
    clearConversationMemory();
    return true;
  });

  ipcMain.handle('memory:list', async () => getConversationHistory());

  ipcMain.handle('memory:remove', async (_event, messageId: string) => removeMessageById(String(messageId ?? '')));

  ipcMain.handle('persona:reset', async () => {
    clearPersonaOverride();
    return true;
  });

  ipcMain.handle('reminder:list', async () => listReminders());

  ipcMain.handle('reminder:create', async (_event, input: CreateReminderInput) => {
    return createReminder(input);
  });

  ipcMain.handle('reminder:delete', async (_event, id: string) => {
    return deleteReminder(id);
  });

  ipcMain.handle('screenshot:list', async (_event, filter?: ScreenshotListFilter) => {
    return listScreenshots(filter);
  });

  ipcMain.handle('screenshot:captureNow', async () => {
    return captureScreenshotNow();
  });

  ipcMain.handle('screenshot:start', async (_event, options?: ScreenshotCaptureStartOptions) => {
    return startScreenshotCapture({
      intervalMinutes: Number(options?.intervalMinutes ?? 5),
      windowStart: options?.windowStart,
      windowEnd: options?.windowEnd,
    });
  });

  ipcMain.handle('screenshot:stop', async () => {
    return stopScreenshotCapture();
  });

  ipcMain.handle('screenshot:status', async () => {
    return getScreenshotCaptureStatus();
  });

  ipcMain.handle('screenshot:ocrStatus', async () => {
    return getOcrEngineStatus();
  });

  ipcMain.handle('greeting:getSettings', async () => getGreetingSettings());

  ipcMain.handle('greeting:setSettings', async (_event, patch: Partial<GreetingSettingsDTO>) => {
    const prev = getGreetingSettings();
    const next = setGreetingSettings(patch);
    notifyGreetingSettingsChange(prev, next);
    restartGreetingScheduler();
    return next;
  });

  ipcMain.handle('vault:list', async () => vaultListFiles());

  ipcMain.handle('vault:read', async (_event, relativePath: string): Promise<VaultReadResult> => {
    const p = String(relativePath ?? '').trim();
    if (!p) {
      throw new Error('路径为空');
    }
    const content = vaultReadFile(p);
    return { path: p, content };
  });

  ipcMain.handle('vault:delete', async (_event, relativePath: string) => {
    const p = String(relativePath ?? '').trim();
    if (!p) {
      throw new Error('路径为空');
    }
    vaultDeleteFile(p);
    return true;
  });
};
