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
    const needsPersist = filtered.some((m) => !m.id);
    const normalized = withIds(filtered);
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
  return messages.slice(-limit).map(({ role, content }) => ({ role, content }));
};

/** 带 id，供界面展示与单条删除 */
export const getConversationHistory = (): ChatMessage[] => {
  const { messages } = readFile();
  return messages.slice();
};

export const appendExchange = (userText: string, assistantText: string): void => {
  const data = readFile();
  data.messages.push(
    { role: 'user', content: userText, id: randomUUID() },
    { role: 'assistant', content: assistantText, id: randomUUID() },
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
  data.messages.push(
    { role: 'user', content: '（桌面通知·点击可回到对话）', id: randomUUID() },
    { role: 'assistant', content: assistantContent, id: randomUUID() },
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
