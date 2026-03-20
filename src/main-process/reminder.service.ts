import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CreateReminderInput, Reminder } from '../shared/types/domain';

const getBackendBaseUrl = (): string => {
  return process.env.BACKEND_BASE_URL?.trim() || 'http://127.0.0.1:8000';
};

const getStorePath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), 'reminders.json');
};

type ReminderStore = {
  version: 1;
  items: Reminder[];
};

const readStore = (): ReminderStore => {
  const filePath = getStorePath();
  if (!fs.existsSync(filePath)) {
    return { version: 1, items: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as ReminderStore;
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return { version: 1, items: [] };
    }
    return parsed;
  } catch {
    return { version: 1, items: [] };
  }
};

const writeStore = (store: ReminderStore): void => {
  const filePath = getStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
};

export const listReminders = (): Reminder[] => {
  return readStore().items.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const normalizeTitle = (title: string): string =>
  title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,。.!！？?、]/g, '');

const parseDueAtMs = (dueAt?: string): number | undefined => {
  if (!dueAt) return undefined;
  const ms = Date.parse(dueAt);
  if (Number.isNaN(ms)) return undefined;
  return ms;
};

export const isDuplicateReminder = (input: CreateReminderInput): { duplicate: boolean; matchedId?: string } => {
  const titleNorm = normalizeTitle(input.title);
  const dueAtMs = parseDueAtMs(input.dueAt);
  if (!titleNorm || !dueAtMs) {
    return { duplicate: false };
  }

  const store = readStore();
  for (const item of store.items) {
    const itemTitleNorm = normalizeTitle(item.title);
    const itemDueAtMs = parseDueAtMs(item.dueAt);
    if (!itemTitleNorm || !itemDueAtMs) continue;
    if (itemTitleNorm !== titleNorm) continue;
    // “同一个时间”：容忍 2 分钟内的偏差（处理模型输出的秒/时区细微差异）
    if (Math.abs(itemDueAtMs - dueAtMs) <= 2 * 60 * 1000) {
      return { duplicate: true, matchedId: item.id };
    }
  }

  return { duplicate: false };
};

export const createReminder = async (input: CreateReminderInput): Promise<Reminder> => {
  const store = readStore();

  const localNow = new Date().toISOString();
  const localItem: Reminder = {
    id: randomUUID(),
    title: input.title.trim() || '未命名提醒',
    dueAt: input.dueAt,
    rawText: input.rawText,
    createdAt: localNow,
  };

  // Best-effort:让后端 APScheduler 存储并到点推送通知。
  // 如果后端不可用，则仍保留本地提醒（至少 UI 可见）。
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/reminders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: localItem.title,
        dueAt: localItem.dueAt,
        rawText: localItem.rawText,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const data = (await res.json()) as Partial<Reminder> & {
        id?: string;
        dueAt?: string;
        rawText?: string;
        createdAt?: string;
      };
      if (data.id && data.createdAt) {
        localItem.id = data.id;
        localItem.dueAt = data.dueAt;
        localItem.rawText = data.rawText;
        localItem.createdAt = data.createdAt;
      }
    }
  } catch (e) {
    console.warn('[reminders] backend create failed, fallback to local only:', e);
  }

  const item = localItem;
  store.items.push(item);
  writeStore(store);
  return item;
};

export const deleteReminder = async (id: string): Promise<boolean> => {
  // Best-effort 同步后端；失败不阻止本地删除。
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      // ignore
    }
  } catch {
    // ignore
  }

  const store = readStore();
  const before = store.items.length;
  store.items = store.items.filter((r) => r.id !== id);
  if (store.items.length === before) {
    return false;
  }
  writeStore(store);
  return true;
};
