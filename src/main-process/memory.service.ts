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
    return {
      version: 1,
      messages: parsed.messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    };
  } catch {
    return { version: 1, messages: [] };
  }
};

const writeFile = (data: MemoryFile): void => {
  const filePath = getMemoryFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const getRecentConversation = (limit: number): ChatMessage[] => {
  const { messages } = readFile();
  return messages.slice(-limit);
};

export const appendExchange = (userText: string, assistantText: string): void => {
  const data = readFile();
  data.messages.push(
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText },
  );
  if (data.messages.length > MAX_STORED_MESSAGES) {
    data.messages = data.messages.slice(-MAX_STORED_MESSAGES);
  }
  writeFile(data);
};

export const clearConversationMemory = (): void => {
  writeFile({ version: 1, messages: [] });
};
