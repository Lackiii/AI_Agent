import type { GreetingIntervalMode, GreetingSettingsDTO } from '../shared/types/greeting';
import { notifyGreetingSettingsChange } from './greeting-notification.service';
import { getGreetingSettings, setGreetingSettings } from './greeting-settings.service';

const VALID: GreetingIntervalMode[] = ['5m', '10m', '30m', '1h', 'random'];

const minutesToMode = (minutes: number): GreetingIntervalMode => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '30m';
  if (minutes <= 7) return '5m';
  if (minutes <= 20) return '10m';
  if (minutes <= 45) return '30m';
  return '1h';
};

/**
 * LLM 工具 greeting_update 的执行体：写 greeting-settings.json 并重启调度。
 */
export const runGreetingUpdateTool = (argsJson: string): string => {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: 'arguments 不是合法 JSON' });
  }

  const patch: Partial<GreetingSettingsDTO> = {};

  if (typeof args.enabled === 'boolean') {
    patch.enabled = args.enabled;
  }

  const modeRaw = args.interval_mode;
  if (typeof modeRaw === 'string' && VALID.includes(modeRaw as GreetingIntervalMode)) {
    patch.intervalMode = modeRaw as GreetingIntervalMode;
  }

  if (typeof args.interval_minutes === 'number') {
    patch.intervalMode = minutesToMode(args.interval_minutes);
  }

  if (Object.keys(patch).length === 0) {
    return JSON.stringify({
      ok: false,
      error: '至少需要 enabled 和/或 interval_mode / interval_minutes 之一',
    });
  }

  // 用户只改间隔时，视为要开启定时问候
  if (patch.enabled === undefined && patch.intervalMode !== undefined) {
    patch.enabled = true;
  }

  const prev = getGreetingSettings();
  const next = setGreetingSettings(patch);
  notifyGreetingSettingsChange(prev, next);

  return JSON.stringify({
    ok: true,
    settings: next,
    note:
      next.enabled === true
        ? `已开启；下次问候会在约 ${describeMode(next.intervalMode)} 后由系统通知发出（首次也按该间隔计时）。`
        : '已关闭定时问候。',
  });
};

const describeMode = (m: GreetingIntervalMode): string => {
  switch (m) {
    case '5m':
      return '5 分钟';
    case '10m':
      return '10 分钟';
    case '30m':
      return '半小时';
    case '1h':
      return '1 小时';
    default:
      return '随机 5～60 分钟中的一档';
  }
};
