export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON object string from the model */
    arguments: string;
  };
};

export type ChatMessage = {
  role: ChatRole;
  /** Plain text; null/omit when assistant message is tool_calls-only */
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /** 本地对话记忆文件中的稳定 id，用于单条删除；不进大模型 API */
  id?: string;
  /** 消息创建时间（ISO 8601） */
  createdAt?: string;
};

export type ChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
};
