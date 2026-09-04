export type VisionCaptionResult = {
  caption?: string;
  captionStatus: 'ok' | 'skipped' | 'error';
  captionError?: string;
};

export const getVisionLlmConfig = () => {
  const model = (process.env.LLM_VISION_MODEL ?? '').trim();
  const apiKey =
    (process.env.LLM_VISION_API_KEY ?? process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '').trim();
  const baseUrl = (
    process.env.LLM_VISION_BASE_URL ??
    process.env.LLM_BASE_URL ??
    process.env.DEEPSEEK_BASE_URL ??
    'https://api.deepseek.com'
  ).trim();
  return { model, apiKey, baseUrl };
};

const CAPTION_PROMPT =
  '请用中文简洁描述这张电脑截图：1）主要在用什么应用或页面；2）用户大概在做什么；3）是否像报错/对话框/空白页。总共 1～3 句，不要臆造看不清的细节。';

const toDataUrl = (imageBase64OrDataUrl: string): string => {
  const raw = (imageBase64OrDataUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return `data:image/png;base64,${raw}`;
};

/**
 * OpenAI-compatible vision caption. Requires LLM_VISION_MODEL; otherwise skipped.
 */
export const captionScreenshotImage = async (imageBase64OrDataUrl: string): Promise<VisionCaptionResult> => {
  const { model, apiKey, baseUrl } = getVisionLlmConfig();
  if (!model) {
    return { captionStatus: 'skipped', captionError: 'LLM_VISION_MODEL 未配置，跳过画面摘要' };
  }
  if (!apiKey) {
    return { captionStatus: 'error', captionError: 'LLM_VISION_API_KEY / LLM_API_KEY 缺失' };
  }

  const dataUrl = toDataUrl(imageBase64OrDataUrl);
  if (!dataUrl) {
    return { captionStatus: 'error', captionError: '截图内容为空' };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 220,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: CAPTION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message = data.error?.message ?? `Vision request failed with status ${response.status}`;
      return { captionStatus: 'error', captionError: message };
    }

    const caption = (data.choices?.[0]?.message?.content ?? '').replace(/\s+/g, ' ').trim();
    if (!caption) {
      return { captionStatus: 'error', captionError: '视觉模型未返回有效摘要' };
    }
    return { caption: caption.slice(0, 600), captionStatus: 'ok' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { captionStatus: 'error', captionError: reason || '视觉摘要失败' };
  }
};
