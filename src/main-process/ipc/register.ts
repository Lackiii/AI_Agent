import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getEnvLoadReport } from '../env';
import { chatCompletion, getLlmConfig } from '../llm.service';
import {
  appendExchange,
  clearConversationMemory,
  getConversationHistory,
  getRecentConversation,
} from '../memory.service';
import { extractPersonaFromNaturalLanguage, mightContainPersonaIntent } from '../persona-extract.service';
import {
  clearPersonaOverride,
  getEffectivePersona,
  savePersonaOverride,
  tryResetPersonaFromUserPhrase,
} from '../persona-memory.service';
import { extractReminderFromNaturalLanguage, mightContainReminderIntent } from '../reminder-extract.service';
import { createReminder, deleteReminder, isDuplicateReminder, listReminders } from '../reminder.service';
import { listScreenshots } from '../screenshot.service';
import { getGreetingSettings, setGreetingSettings } from '../greeting-settings.service';
import { restartGreetingScheduler } from '../greeting-scheduler.service';
import type { CreateReminderInput, ScreenshotListFilter } from '../../shared/types/domain';
import type { GreetingSettingsDTO } from '../../shared/types/greeting';
import type { ChatMessage } from '../../shared/types/llm';

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
    const finalReply = `${reminderActionText}${reminderSkipPersonaFooter ? '' : personaFooter}`;
    appendExchange(trimmed, finalReply);
    return finalReply;
  }

  const reply = await chatCompletion(messages);
  const fullReply = `${reply}${reminderSkipPersonaFooter ? '' : personaFooter}${reminderActionText}`;
  // 只把主回复写入记忆，避免把操作性 footer 反复带入上下文导致重复。
  appendExchange(trimmed, reply);
  return fullReply;
};

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('llm:chat');
  ipcMain.removeHandler('memory:clear');
  ipcMain.removeHandler('memory:list');
  ipcMain.removeHandler('persona:reset');
  ipcMain.removeHandler('reminder:list');
  ipcMain.removeHandler('reminder:create');
  ipcMain.removeHandler('reminder:delete');
  ipcMain.removeHandler('screenshot:list');
  ipcMain.removeHandler('deepseek:chat');
  ipcMain.removeHandler('greeting:getSettings');
  ipcMain.removeHandler('greeting:setSettings');

  ipcMain.handle('llm:chat', handleLlmChat);
  ipcMain.handle('deepseek:chat', handleLlmChat);

  ipcMain.handle('memory:clear', async () => {
    clearConversationMemory();
    return true;
  });

  ipcMain.handle('memory:list', async () => getConversationHistory());

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

  ipcMain.handle('greeting:getSettings', async () => getGreetingSettings());

  ipcMain.handle('greeting:setSettings', async (_event, patch: Partial<GreetingSettingsDTO>) => {
    const next = setGreetingSettings(patch);
    restartGreetingScheduler();
    return next;
  });
};
