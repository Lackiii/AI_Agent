import type { CreateReminderInput } from '../shared/types/domain';
import type { ChatMessage } from '../shared/types/llm';
import { chatCompletion } from './llm.service';

/** 可能包含「创建提醒」语义的输入，才调用模型抽取（省一次请求） */
export const mightContainReminderIntent = (text: string): boolean => {
  return /提醒|别忘了|记得叫我|记一下|叫我一下|闹钟|定时/i.test(text);
};

type ExtractPayload = {
  isReminder?: boolean;
  title?: string | null;
  dueAt?: string | null;
};

const stripCodeFence = (raw: string): string => {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence) {
    s = fence[1].trim();
  }
  return s;
};

const parseJsonObject = (raw: string): ExtractPayload | null => {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as ExtractPayload;
  } catch {
    return null;
  }
};

/**
 * 用 LLM 从自然语言中抽取提醒主题与时间（如「下午两点提醒我看书」）。
 * 若不是创建提醒的请求则返回 null。
 */
export const extractReminderFromNaturalLanguage = async (userText: string): Promise<CreateReminderInput | null> => {
  const nowLocal = new Date().toLocaleString('zh-CN', {
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const system = `你是「日程提醒」解析器。判断用户是否在**请求创建一条待办/提醒**。

规则：
1. 若用户是在**取消、拒绝、询问概念**（如「别提醒我」「不用提醒」「提醒是什么意思」），输出：{"isReminder":false}
2. 若用户**明确想让你在某个时间提醒他做某事**，输出：
   {"isReminder":true,"title":"事项简述","dueAt":"ISO8601"}
   - title：只写要做的事，不要「提醒我」等套话。例如输入「下午两点提醒我看书」→ title 为「看书」
   - dueAt：尽量给出完整 ISO8601（可带时区偏移）。参考下方「当前本地时间」推断「下午两点」「今晚八点」「明天早上九点」等。
   - 若完全无法推断时间，则 dueAt 为 null
3. **只输出一个 JSON 对象**，不要 markdown、不要其它文字。

当前本地时间参考：${nowLocal}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: userText },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.1 });
  const payload = parseJsonObject(raw);
  if (!payload || payload.isReminder !== true) {
    return null;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    return null;
  }

  const dueRaw = payload.dueAt;
  let dueAt: string | undefined;
  if (typeof dueRaw === 'string' && dueRaw.trim()) {
    dueAt = dueRaw.trim();
    const t = Date.parse(dueAt);
    if (Number.isNaN(t)) {
      dueAt = undefined;
    }
  }

  return {
    title,
    dueAt,
    rawText: userText,
  };
};
