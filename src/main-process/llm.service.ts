import { runAssistantTool } from './assistant-tools.service';
import type { ChatCompletionResponse, ChatMessage, ToolCall } from '../shared/types/llm';

export const getLlmConfig = () => ({
  apiKey: process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '',
  baseUrl: process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  model: process.env.LLM_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
});

const VAULT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'vault_list',
      description:
        '列出用户 AI 资料夹内所有文件的相对路径（可含子目录）。用于查看已保存的随笔、笔记等。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_read',
      description:
        '读取资料夹内某个 UTF-8 文本文件的全部内容。path 为相对路径，例如 jottings/2026-03-23.md。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_write',
      description:
        '在资料夹内新建或覆盖 UTF-8 文本文件。当用户要求保存、存储、归档随笔/草稿/笔记/对话摘录时使用；将完整正文写入 content，自行选择清晰的相对路径（可用子目录，如 jottings/标题.md）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径（可含子目录）' },
          content: { type: 'string', description: '要保存的完整文本' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'vault_delete',
      description:
        '永久删除资料夹内的一个已存文本文件。仅当用户明确要求删除、移除某条已保存的笔记/文件时使用；path 为相对路径。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
];

const NOTIFICATION_SHOW_TOOL = {
  type: 'function' as const,
  function: {
    name: 'notification_show',
    description:
      '立即向用户弹出一条系统通知（桌面 Toast），不经过定时器、不调用其它工具。当用户说「马上弹窗」「立即发一条弹窗/通知测试」「用系统通知提醒我一下」或类似要求立刻弹出通知时，必须调用本工具；body 写通知正文（简短、符合人设），title 可选、默认「拉文杜拉」。仅口头说「已发送」而未调用本工具则用户不会看到弹窗。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '通知标题，可省略',
        },
        body: {
          type: 'string',
          description: '通知正文，建议一两句话',
        },
      },
      required: ['body'],
      additionalProperties: false,
    },
  },
};

const GREETING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'greeting_update',
    description:
      '更新「定时主动问候」：到点会通过系统通知发一两句关心话（用户未发消息也会触发）。当用户希望每隔一段时间被提醒休息、喝水、聊聊天、陪陪写代码等，应开启并设定间隔；当用户说下班、再见、明天见、不用提醒了、关掉问候等，应关闭（enabled=false）。interval_mode：5m / 10m / 30m（半小时）/ 1h / random；也可用 interval_minutes 口语换算。',
    parameters: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'true=开启定时问候，false=关闭',
        },
        interval_mode: {
          type: 'string',
          enum: ['5m', '10m', '30m', '1h', 'random'],
          description: '问候周期间隔；半小时写作 30m',
        },
        interval_minutes: {
          type: 'number',
          description: '若用户说「每 20 分钟」等，可填数字，系统会映射到最接近档位',
        },
      },
      additionalProperties: false,
    },
  },
};

const SCREENSHOT_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'screenshot_search',
      description:
        '检索截图轨迹（按关键词、时间范围与 OCR 状态过滤），返回命中的截图时间、画面摘要（caption）与 OCR 摘要。适用于回答“我刚刚做了什么/哪里报错/什么时候开始失败”等问题。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '关键词，可为空' },
        from: { type: 'string', description: '起始时间，ISO 8601，可选' },
        to: { type: 'string', description: '结束时间，ISO 8601，可选' },
        status: {
          type: 'string',
          enum: ['ok', 'no_text', 'engine_unavailable', 'ocr_error', 'backend_unreachable', 'unknown'],
          description: '按 OCR 状态筛选，可选',
        },
        limit: { type: 'number', description: '返回条数上限 1-20，默认 6' },
      },
      additionalProperties: false,
    },
  },
};

const ASSISTANT_TOOLS = [...VAULT_TOOLS, NOTIFICATION_SHOW_TOOL, GREETING_TOOL, SCREENSHOT_SEARCH_TOOL];

const MAX_TOOL_ROUNDS = 8;

const toApiMessage = (m: ChatMessage): Record<string, unknown> => {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: m.tool_call_id,
      content: m.content ?? '',
    };
  }
  if (m.role === 'assistant' && m.tool_calls?.length) {
    return {
      role: 'assistant',
      content: m.content ?? null,
      tool_calls: m.tool_calls,
    };
  }
  return { role: m.role, content: m.content ?? '' };
};

const postChat = async (body: Record<string, unknown>): Promise<ChatCompletionResponse> => {
  const { apiKey, baseUrl } = getLlmConfig();
  if (!apiKey) {
    throw new Error('LLM_API_KEY is missing.');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    const message = data.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
};

export const chatCompletion = async (
  messages: ChatMessage[],
  options?: { temperature?: number },
): Promise<string> => {
  for (const m of messages) {
    if (m.role === 'tool' || m.tool_calls?.length) {
      throw new Error('chatCompletion does not accept tool messages; use chatCompletionWithAssistantTools');
    }
  }

  const data = await postChat({
    model: getLlmConfig().model,
    messages: messages.map((m) => ({ role: m.role, content: m.content ?? '' })),
    temperature: options?.temperature ?? 0.7,
  });

  return data.choices?.[0]?.message?.content ?? '';
};

/**
 * 对话补全 + 主进程工具：资料夹（vault_*）与定时问候（greeting_update）。
 */
export const chatCompletionWithAssistantTools = async (
  messages: ChatMessage[],
  options?: { temperature?: number },
): Promise<string> => {
  const { model } = getLlmConfig();
  const temperature = options?.temperature ?? 0.7;
  const working: ChatMessage[] = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await postChat({
      model,
      messages: working.map(toApiMessage),
      temperature,
      tools: ASSISTANT_TOOLS,
      tool_choice: 'auto',
    });

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      throw new Error('LLM returned no message');
    }

    const toolCalls = msg.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const normalizedCalls: ToolCall[] = toolCalls
        .filter((tc) => tc?.type === 'function' && tc.function?.name)
        .map((tc) => {
          const raw = tc.function.arguments;
          const argsStr = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
          return {
            id: tc.id || `call_${round}_${tc.function.name}`,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: argsStr,
            },
          };
        });

      if (normalizedCalls.length === 0) {
        return msg.content ?? '';
      }

      working.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: normalizedCalls,
      });

      for (const tc of normalizedCalls) {
        if (tc.type !== 'function') continue;
        const result = await runAssistantTool(tc.function.name, tc.function.arguments);
        working.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    return msg.content ?? '';
  }

  throw new Error('工具调用轮数过多，已中止');
};
