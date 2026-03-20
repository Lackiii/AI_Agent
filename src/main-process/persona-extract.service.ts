import type { ChatMessage } from '../shared/types/llm';
import { chatCompletion } from './llm.service';

/** 可能是在改人设时才调用抽取（省请求） */
export const mightContainPersonaIntent = (text: string): boolean => {
  return /人设|性格设定|助手设定|说话风格|扮演|称呼我|叫我|记住你是|更新人设|换个人设|你的人设/i.test(text);
};

type ExtractPayload = {
  updatePersona?: boolean;
  persona?: string | null;
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
 * 从自然语言中抽取「要长期记住的助手人设」文本；若不是更新人设则返回 null。
 */
export const extractPersonaFromNaturalLanguage = async (userText: string): Promise<string | null> => {
  const system = `你是「人设解析器」。判断用户是否在**设定或更新 AI 助手的长期人设**（性格、称呼、语气、角色、禁忌等）。

规则：
1. 若用户只是在**讨论人设概念、提问、或拒绝修改**（如「人设是什么意思」「别改人设」），输出：{"updatePersona":false}
2. 若用户**明确希望助手按某种方式长期表现**，输出：{"updatePersona":true,"persona":"..."}
   - persona 必须是**完整、可直接用作 system prompt 的中文说明**，可多条列举；合并用户零散描述为连贯指令
   - 若用户同时提了其它闲聊问题，只把人设相关写进 persona，不要回答闲聊
3. **只输出一个 JSON 对象**，不要 markdown、不要其它文字。`;

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: userText },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.15 });
  const payload = parseJsonObject(raw);
  if (!payload || payload.updatePersona !== true) {
    return null;
  }

  const persona = typeof payload.persona === 'string' ? payload.persona.trim() : '';
  if (persona.length < 6) {
    return null;
  }

  return persona;
};
