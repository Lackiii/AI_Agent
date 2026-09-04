import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { chatCompletion, getLlmConfig } from './llm.service';
import { showDesktopNotification } from './desktop-notification.service';
import {
  diffCalendarDays,
  longHolidayStrictlyBetween,
  toLocalYmd,
} from './china-long-holidays';
import { getWeatherContextMessage } from './weather-context.service';

const TITLE = '拉文杜拉';
const USER_NICK = '主人';
const STATE_FILE = 'startup-greeting-state.json';

type StartupGreetingState = {
  lastGreetingLocalDate: string;
  lastGreetingAt?: string;
};

const BOOT_LOADING_BODY = '拉文杜拉已启动，用户信息载入中——';

const getStatePath = (): string => path.join(app.getPath('userData'), STATE_FILE);

const readState = (): StartupGreetingState | null => {
  try {
    const p = getStatePath();
    if (!fs.existsSync(p)) {
      return null;
    }
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw) as StartupGreetingState;
    if (j && typeof j.lastGreetingLocalDate === 'string') {
      return j;
    }
    return null;
  } catch {
    return null;
  }
};

const writeState = (s: StartupGreetingState): void => {
  const p = getStatePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf8');
};

const isWeekendLocal = (d: Date): boolean => {
  const w = d.getDay();
  return w === 0 || w === 6;
};

const isWeekdayLocal = (d: Date): boolean => !isWeekendLocal(d);

const morningOrAfternoon = (d: Date): 'morning' | 'afternoon' =>
  d.getHours() < 12 ? 'morning' : 'afternoon';

/** (lastYmd, todayYmd) 开区间内是否存在周六或周日 */
const crossedWeekendBetween = (lastYmd: string, todayYmd: string): boolean => {
  const [y, m, day] = lastYmd.split('-').map(Number);
  const cur = new Date(y, m - 1, day + 1);
  while (toLocalYmd(cur) < todayYmd) {
    const w = cur.getDay();
    if (w === 0 || w === 6) {
      return true;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return false;
};

export type StartupScenario =
  | 'weekend'
  | 'long_absence'
  | 'after_weekend'
  | 'new_day'
  | 'first_visit'
  | 'default';

const pickScenario = (opts: {
  now: Date;
  todayYmd: string;
  lastYmd: string | null;
}): StartupScenario | 'skip' => {
  const { now, todayYmd, lastYmd } = opts;

  if (lastYmd != null && lastYmd === todayYmd) {
    return 'skip';
  }

  if (lastYmd == null) {
    return isWeekendLocal(now) ? 'weekend' : 'first_visit';
  }

  if (isWeekendLocal(now)) {
    return 'weekend';
  }

  const diff = diffCalendarDays(lastYmd, todayYmd);
  if (diff >= 7 && !longHolidayStrictlyBetween(lastYmd, todayYmd)) {
    return 'long_absence';
  }
  if (diff >= 2 && isWeekdayLocal(now) && crossedWeekendBetween(lastYmd, todayYmd)) {
    return 'after_weekend';
  }
  if (diff === 1 && isWeekdayLocal(now)) {
    return 'new_day';
  }

  return 'default';
};

const fallbackLine = (
  scenario: StartupScenario,
  period: 'morning' | 'afternoon',
): string => {
  const hi = period === 'morning' ? '早上好' : '下午好';
  switch (scenario) {
    case 'weekend':
      return `${USER_NICK}，周末好～`;
    case 'long_absence':
      return `${USER_NICK}……好久不见，我好想你`;
    case 'after_weekend':
      return `${hi}${USER_NICK}，周末过得怎么样？`;
    case 'new_day':
      return `${hi}，今天也是新的一天啦`;
    case 'first_visit':
      return `${USER_NICK}，我是拉文杜拉，很高兴见到你～`;
    default:
      return `${hi}，又见面啦～`;
  }
};

const buildPromptMessages = (opts: {
  scenario: StartupScenario;
  nowIso: string;
  todayYmd: string;
  lastYmd: string | null;
  calendarGapDays: number | null;
  period: 'morning' | 'afternoon';
  crossedWeekend: boolean;
  longHolidayBetween: boolean;
  isWeekendToday: boolean;
}): { system: string; user: string } => {
  const {
    scenario,
    nowIso,
    todayYmd,
    lastYmd,
    calendarGapDays,
    period,
    crossedWeekend,
    longHolidayBetween,
    isWeekendToday,
  } = opts;

  const system = [
    `你是桌面助手「${TITLE}」，称呼用户「${USER_NICK}」。`,
    '根据下面 JSON 事实，只输出**一条**简短的简体中文问候（30 字以内），不要标题、不要引号、不要换行、不要解释规则。',
    '语气温柔、略带宅向陪伴感；若 scenario 已暗示句式，可在此基础上稍作变化但不要违背事实。',
  ].join('');

  const user = JSON.stringify(
    {
      scenario,
      currentLocalTime: nowIso,
      todayLocalDate: todayYmd,
      lastGreetingLocalDate: lastYmd,
      calendarGapDays,
      period: period === 'morning' ? '上午' : '下午',
      isWeekendToday,
      crossedWeekendSinceLastGreeting: crossedWeekend,
      longPublicHolidayStrictlyBetweenLastAndToday: longHolidayBetween,
      styleHints: {
        weekend: '例如：主人，周末好～',
        new_day: '例如：早上好/下午好，今天也是新的一天啦',
        after_weekend: '例如：早上好主人，周末过得怎么样？',
        long_absence: '例如：主人……好久不见，我好想你',
        first_visit: '首次见面，热情但不冗长',
      },
    },
    null,
    0,
  );

  return { system, user };
};

/** 应用启动后调用：同日再次启动不执行；先系统通知「载入中」，再可选调用大模型生成问候并通知 */
export const runStartupGreetingIfNeeded = async (): Promise<void> => {
  if (!app.isReady()) {
    return;
  }

  const now = new Date();
  const todayYmd = toLocalYmd(now);
  const state = readState();
  const lastYmd = state?.lastGreetingLocalDate ?? null;

  const scenario = pickScenario({ now, todayYmd, lastYmd });
  if (scenario === 'skip') {
    return;
  }

  showDesktopNotification(TITLE, BOOT_LOADING_BODY);

  const calendarGapDays = lastYmd != null ? diffCalendarDays(lastYmd, todayYmd) : null;
  const crossed =
    lastYmd != null && todayYmd > lastYmd ? crossedWeekendBetween(lastYmd, todayYmd) : false;
  const holidayBetween =
    lastYmd != null && todayYmd > lastYmd ? longHolidayStrictlyBetween(lastYmd, todayYmd) : false;
  const period = morningOrAfternoon(now);

  const { apiKey } = getLlmConfig();
  let bodyOut: string | null = null;

  if (apiKey) {
    try {
      const { system, user } = buildPromptMessages({
        scenario,
        nowIso: now.toISOString(),
        todayYmd,
        lastYmd,
        calendarGapDays,
        period,
        crossedWeekend: crossed,
        longHolidayBetween: holidayBetween,
        isWeekendToday: isWeekendLocal(now),
      });

      const weatherContext = await getWeatherContextMessage();
      const raw = await chatCompletion(
        [
          { role: 'system', content: `${system}\n补充要求：若存在高温/雷暴预警，可在问候中自然加入一句提醒（仍保持简短）。` },
          { role: 'system', content: weatherContext },
          { role: 'user', content: user },
        ],
        { temperature: 0.55 },
      );

      bodyOut = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!bodyOut) {
        bodyOut = fallbackLine(scenario, period);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[startup-greeting] LLM failed:', e);
      bodyOut = fallbackLine(scenario, period);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[startup-greeting] LLM_API_KEY missing, using template greeting');
    bodyOut = fallbackLine(scenario, period);
  }

  if (bodyOut && bodyOut !== BOOT_LOADING_BODY) {
    showDesktopNotification(TITLE, bodyOut);
  }

  writeState({
    lastGreetingLocalDate: todayYmd,
    lastGreetingAt: now.toISOString(),
  });
};
