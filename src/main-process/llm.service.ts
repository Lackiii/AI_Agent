import type { ChatCompletionResponse, ChatMessage } from '../shared/types/llm';

export const getLlmConfig = () => ({
  apiKey: process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '',
  baseUrl: process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  model: process.env.LLM_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
});

export const chatCompletion = async (
  messages: ChatMessage[],
  options?: { temperature?: number },
): Promise<string> => {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) {
    throw new Error('LLM_API_KEY is missing.');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  const data = (await response.json()) as ChatCompletionResponse;
  if (!response.ok) {
    const message = data.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data.choices?.[0]?.message?.content ?? '';
};
