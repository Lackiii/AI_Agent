import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getEnvLoadReport } from '../env';
import { chatCompletion, getLlmConfig } from '../llm.service';
import { appendExchange, clearConversationMemory, getRecentConversation } from '../memory.service';
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
import type { CreateReminderInput, ScreenshotListFilter } from '../../shared/types/domain';
import type { ChatMessage } from '../../shared/types/llm';

const MEMORY_WINDOW = 20;

const formatDueAtClock = (dueAtIso: string): string => {
  const ms = Date.parse(dueAtIso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (minutes === 0) return `${hours}点`;
  return `${hours}点${minutes}分`;
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

  let reminderImmediateReply = '';
  let reminderSkipPersonaFooter = false;
  if (mightContainReminderIntent(trimmed)) {
    try {
      const extracted = await extractReminderFromNaturalLanguage(trimmed);
      if (extracted) {
        const nowMs = Date.now();
        const dueAtMs = extracted.dueAt ? Date.parse(extracted.dueAt) : NaN;

        // 如果抽取出的 dueAt 已经早于当前时间（给一点容忍），认为用户“看错时间/写错时间”，阻断创建。
        if (!Number.isNaN(dueAtMs) && dueAtMs < nowMs - 60 * 1000) {
          const clock = extracted.dueAt ? formatDueAtClock(extracted.dueAt) : '';
          reminderImmediateReply = `啊噢，现在已经过了${clock || '这个时间'}了哦，主人是不是看错时间啦？`;
          reminderSkipPersonaFooter = true;
        } else {
          const dup = isDuplicateReminder(extracted);
          if (dup.duplicate) {
            reminderImmediateReply = '主人，这个事项你已经让知知提醒过啦~';
            reminderSkipPersonaFooter = true;
          } else {
            createReminder(extracted);
            const timeHint = extracted.dueAt ? `，时间：${extracted.dueAt}` : '';
            reminderImmediateReply = `好的主人，已为你加入提醒列表：\n- 事项：${extracted.title}${timeHint}\n\n我会记着这件事。还要我顺便给你拆成执行步骤吗？`;
          }
        }
      }
    } catch {
      // 抽取失败时不阻断正常对话
    }
  }

  if (reminderImmediateReply) {
    const finalReply = `${reminderImmediateReply}${reminderSkipPersonaFooter ? '' : personaFooter}`;
    appendExchange(trimmed, finalReply);
    return finalReply;
  }

  const history = getRecentConversation(MEMORY_WINDOW);
  const messages: ChatMessage[] = [
    { role: 'system', content: getEffectivePersona() },
    ...history,
    { role: 'user', content: trimmed },
  ];

  const reply = await chatCompletion(messages);
  const fullReply = `${reply}${personaFooter}`;
  // 只把主回复写入记忆，避免把操作性 footer 反复带入上下文导致重复。
  appendExchange(trimmed, reply);
  return fullReply;
};

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('llm:chat');
  ipcMain.removeHandler('memory:clear');
  ipcMain.removeHandler('persona:reset');
  ipcMain.removeHandler('reminder:list');
  ipcMain.removeHandler('reminder:create');
  ipcMain.removeHandler('reminder:delete');
  ipcMain.removeHandler('screenshot:list');
  ipcMain.removeHandler('deepseek:chat');

  ipcMain.handle('llm:chat', handleLlmChat);
  ipcMain.handle('deepseek:chat', handleLlmChat);

  ipcMain.handle('memory:clear', async () => {
    clearConversationMemory();
    return true;
  });

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
};
