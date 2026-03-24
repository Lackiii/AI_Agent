import { Notification } from 'electron';
import { showDesktopNotification } from './desktop-notification.service';
import { queueNotificationMemory } from './notification-memory-queue';
import type { GreetingIntervalMode, GreetingSettingsDTO } from '../shared/types/greeting';

const TITLE = '拉文杜拉';

const firstFireHint = (m: GreetingIntervalMode): string => {
  switch (m) {
    case '5m':
      return '约 5 分钟';
    case '10m':
      return '约 10 分钟';
    case '30m':
      return '约半小时';
    case '1h':
      return '约 1 小时';
    default:
      return '随机 5～60 分钟内某一档';
  }
};

export const notifyGreetingSettingsChange = (prev: GreetingSettingsDTO, next: GreetingSettingsDTO): void => {
  if (!Notification.isSupported()) {
    // eslint-disable-next-line no-console
    console.warn('[greeting-notification] 当前环境不支持系统通知');
    return;
  }

  try {
    if (next.enabled && !prev.enabled) {
      showDesktopNotification(
        TITLE,
        `定时问候已开启。第一次提醒会在 ${firstFireHint(next.intervalMode)} 后弹出。若仍无弹窗，请在 Windows「设置 → 系统 → 通知」中检查本应用是否允许通知。`,
      );
      return;
    }
    if (!next.enabled && prev.enabled) {
      showDesktopNotification(TITLE, '定时问候已关闭，好好休息～');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[greeting-notification]', e);
  }
};

export type TestNotificationResult = { ok: true } | { ok: false; error: string };

export const sendTestNotification = (): TestNotificationResult => {
  if (!Notification.isSupported()) {
    return { ok: false, error: '当前环境不支持系统通知' };
  }
  try {
    showDesktopNotification(TITLE, '这是一条测试通知：若能看到，说明系统通知通道正常（与是否开启定时问候无关）。');
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
};

const MAX_TOAST_TITLE = 64;
const MAX_TOAST_BODY = 280;

/** LLM 工具 notification_show：排队写入记忆 + 弹窗（记忆在本轮 appendExchange 前 flush） */
export const runNotificationShowTool = (argsJson: string): string => {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: 'arguments 不是合法 JSON' });
  }

  const bodyRaw = String(args.body ?? '').trim();
  if (!bodyRaw) {
    return JSON.stringify({ ok: false, error: '缺少 body' });
  }

  const titleRaw = args.title != null ? String(args.title).trim() : '';
  const title = (titleRaw || TITLE).slice(0, MAX_TOAST_TITLE);
  const body = bodyRaw.replace(/\s+/g, ' ').slice(0, MAX_TOAST_BODY);

  if (!Notification.isSupported()) {
    return JSON.stringify({ ok: false, error: '当前环境不支持系统通知' });
  }

  try {
    showDesktopNotification(title, body);
    queueNotificationMemory({ title, body });
    return JSON.stringify({ ok: true, title, body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ ok: false, error: msg });
  }
};
