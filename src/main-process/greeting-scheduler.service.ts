import type { ChatMessage } from '../shared/types/llm';
import type { GreetingIntervalMode } from '../shared/types/greeting';
import { showDesktopNotification } from './desktop-notification.service';
import { chatCompletion, getLlmConfig } from './llm.service';
import { appendNotificationTurn } from './memory.service';
import { getEffectivePersona } from './persona-memory.service';
import { getGreetingSettings } from './greeting-settings.service';

let timer: ReturnType<typeof setTimeout> | null = null;

const MS = {
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
} as const;

const nextDelayMs = (mode: GreetingIntervalMode): number => {
  if (mode === 'random') {
    const presets = [5, 10, 30, 60] as const;
    const minutes = presets[Math.floor(Math.random() * presets.length)] ?? 30;
    return minutes * 60 * 1000;
  }
  return MS[mode];
};

const clearTimer = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
};

const runGreeting = async (): Promise<void> => {
  const settings = getGreetingSettings();
  if (!settings.enabled) {
    return;
  }

  const { apiKey } = getLlmConfig();
  if (!apiKey) {
    scheduleNextTick();
    return;
  }

  try {
    const persona = getEffectivePersona();
    const messages: ChatMessage[] = [
      { role: 'system', content: persona },
      {
        role: 'system',
        content:
          '这是一次定时触发的主动问候（用户并未发送新消息）。请用一两句简短、自然的中文关心对方，符合你的人设；可以像「姐姐，你已经工作半小时啦，喝杯茶休息一下吧」这类口吻（称呼按人设调整）。不要提起「定时」「系统」「任务」「触发」，不要要求用户写长回复。',
      },
      { role: 'user', content: '（请主动问候我）' },
    ];
    const reply = await chatCompletion(messages, { temperature: 0.85 });
    const body = (reply.trim() || '主人，在这儿陪着您呢。').slice(0, 280);
    appendNotificationTurn(body, '拉文杜拉');
    showDesktopNotification('拉文杜拉', body);
  } catch (e) {
    console.error('[greeting-scheduler]', e);
  }

  scheduleNextTick();
};

const scheduleNextTick = (): void => {
  clearTimer();
  const settings = getGreetingSettings();
  if (!settings.enabled) {
    return;
  }
  const delay = nextDelayMs(settings.intervalMode);
  timer = setTimeout(() => {
    void runGreeting();
  }, delay);
};

/** 应用启动或设置变更后调用：从当前时刻起等待一个完整间隔再问候。 */
export const restartGreetingScheduler = (): void => {
  clearTimer();
  const settings = getGreetingSettings();
  if (!settings.enabled) {
    return;
  }
  scheduleNextTick();
};
