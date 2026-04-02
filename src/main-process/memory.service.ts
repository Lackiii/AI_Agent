import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ChatMessage } from '../shared/types/llm';

const MAX_STORED_MESSAGES = 40;

type MemoryFile = {
  version: 1;
  messages: ChatMessage[];
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

const toLocalDateTimeWithOffset = (date: Date): string => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offsetHour = pad2(Math.floor(abs / 60));
  const offsetMinute = pad2(abs % 60);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
};

const normalizeToLocalDateTime = (time?: string): string => {
  if (time) {
    const parsed = new Date(time);
    if (!Number.isNaN(parsed.getTime())) {
      return toLocalDateTimeWithOffset(parsed);
    }
  }
  return toLocalDateTimeWithOffset(new Date());
};

const getMemoryFilePath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), 'conversation-memory.json');
};

const withIds = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((m) => ({
    ...m,
    id: m.id || randomUUID(),
  }));

const withTimestamps = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map((m) => ({
    ...m,
    createdAt: normalizeToLocalDateTime(m.createdAt),
  }));
};

const readFile = (): MemoryFile => {
  const filePath = getMemoryFilePath();
  if (!fs.existsSync(filePath)) {
    return { version: 1, messages: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as MemoryFile;
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      return { version: 1, messages: [] };
    }
    const filtered = parsed.messages.filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    );
    const needsPersist = filtered.some((m) => !m.id || !m.createdAt);
    const normalized = withTimestamps(withIds(filtered));
    if (needsPersist && normalized.length > 0) {
      writeFile({ version: 1, messages: normalized });
    }
    return { version: 1, messages: normalized };
  } catch {
    return { version: 1, messages: [] };
  }
};

const writeFile = (data: MemoryFile): void => {
  const filePath = getMemoryFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const trimToMax = (data: MemoryFile): void => {
  if (data.messages.length > MAX_STORED_MESSAGES) {
    data.messages = data.messages.slice(-MAX_STORED_MESSAGES);
  }
};

/** 供 LLM 使用的近期消息（去掉 id，避免多余字段进 API） */
export const getRecentConversation = (limit: number): ChatMessage[] => {
  const { messages } = readFile();
  return messages.slice(-limit).map(({ role, content }) => ({
    role,
    content,
  }));
};

/** 供时间语义增强使用（保留 createdAt） */
export const getRecentConversationWithTimestamp = (limit: number): ChatMessage[] => {
  const { messages } = readFile();
  return messages.slice(-limit).map(({ role, content, createdAt }) => ({
    role,
    content,
    createdAt,
  }));
};

/** 带 id，供界面展示与单条删除 */
export const getConversationHistory = (): ChatMessage[] => {
  const { messages } = readFile();
  return messages.slice();
};

export const appendExchange = (userText: string, assistantText: string): void => {
  const data = readFile();
  const userTs = toLocalDateTimeWithOffset(new Date());
  const assistantTs = toLocalDateTimeWithOffset(new Date());
  data.messages.push(
    { role: 'user', content: userText, id: randomUUID(), createdAt: userTs },
    { role: 'assistant', content: assistantText, id: randomUUID(), createdAt: assistantTs },
  );
  trimToMax(data);
  writeFile(data);
};

/** 桌面通知归档：助手在弹窗里说过的话 */
export const appendNotificationTurn = (assistantBody: string, title?: string): void => {
  const data = readFile();
  const assistantContent = title
    ? `「${title.slice(0, 48)}」${assistantBody}`.slice(0, 2000)
    : assistantBody.slice(0, 2000);
  const userTs = toLocalDateTimeWithOffset(new Date());
  const assistantTs = toLocalDateTimeWithOffset(new Date());
  data.messages.push(
    { role: 'user', content: '（桌面通知·点击可回到对话）', id: randomUUID(), createdAt: userTs },
    { role: 'assistant', content: assistantContent, id: randomUUID(), createdAt: assistantTs },
  );
  trimToMax(data);
  writeFile(data);
};

export const removeMessageById = (messageId: string): boolean => {
  const id = messageId.trim();
  if (!id) return false;
  const data = readFile();
  const next = data.messages.filter((m) => m.id !== id);
  if (next.length === data.messages.length) return false;
  data.messages = next;
  writeFile(data);
  return true;
};

export const clearConversationMemory = (): void => {
  writeFile({ version: 1, messages: [] });
};
