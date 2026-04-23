import type { AssistantEmotion } from '../shared/types/emotion';

type EmotionScoreMap = Record<AssistantEmotion, number>;

const EMOTION_RULES: Array<{ emotion: AssistantEmotion; keywords: string[]; weight: number }> = [
  { emotion: 'angry', weight: 3.4, keywords: ['生气', '恼火', '愤怒', '气死', '怒', '烦死', '别闹', '够了'] },
  { emotion: 'doubt', weight: 2.6, keywords: ['真的吗', '确定', '是吗', '怀疑', '可疑', '不太对', '你确定'] },
  { emotion: 'rebuttal', weight: 2.8, keywords: ['不对', '不是这样', '我反对', '反驳', '并非', '纠正', '但是'] },
  { emotion: 'worry', weight: 2.5, keywords: ['担心', '害怕', '紧张', '风险', '谨慎', '不放心', '可能出错'] },
  { emotion: 'happy', weight: 2.4, keywords: ['开心', '太好了', '好耶', '棒', '赞', '哈哈', '成功了', '真不错'] },
  { emotion: 'cute', weight: 2.4, keywords: ['主人', '嘛', '呀', '呢', '抱抱', '哼哼', '撒娇', '喵', '贴贴'] },
  { emotion: 'calm', weight: 2.0, keywords: ['好的', '明白', '收到', '先', '我们一步步', '冷静', '平稳', '可以这样'] },
  { emotion: 'sad', weight: 2.8, keywords: ['难过', '伤心', '抱歉', '遗憾', '失望', '失败', '没做到', '对不起'] },
];

const hasAnyKeyword = (text: string, keywords: string[]): boolean => keywords.some((k) => text.includes(k));

const EXPLICIT_EMOTION_KEYWORDS: Array<{ emotion: AssistantEmotion; keywords: string[] }> = [
  { emotion: 'angry', keywords: ['生气', '愤怒', '气呼呼', '发火', 'angry'] },
  { emotion: 'doubt', keywords: ['质疑', '怀疑', '疑惑', 'question', 'doubt'] },
  { emotion: 'rebuttal', keywords: ['反驳', '反对', '驳回', 'rebut'] },
  { emotion: 'worry', keywords: ['担心', '焦虑', '不安', 'worry'] },
  { emotion: 'happy', keywords: ['开心', '高兴', '快乐', '惊喜', '礼物', '激动', '笑容', 'happy', '😊', '😄', '😁', '😍', '💕'] },
  { emotion: 'cute', keywords: ['撒娇', '可爱', '卖萌', 'cute'] },
  { emotion: 'calm', keywords: ['平静', '冷静', 'calm'] },
  { emotion: 'sad', keywords: ['伤心', '难过', '悲伤', 'sad'] },
];

const inferExplicitEmotionFromPrompt = (normalizedPrompt: string): AssistantEmotion | null => {
  let picked: { emotion: AssistantEmotion; index: number } | null = null;
  for (const rule of EXPLICIT_EMOTION_KEYWORDS) {
    for (const keyword of rule.keywords) {
      const idx = normalizedPrompt.lastIndexOf(keyword);
      if (idx >= 0 && (!picked || idx > picked.index)) {
        picked = { emotion: rule.emotion, index: idx };
      }
    }
  }
  if (picked) return picked.emotion;

  // 用户只说“换个情绪/表情”但没指定类别时，给一个可感知的默认切换。
  if (
    normalizedPrompt.includes('换个情绪') ||
    normalizedPrompt.includes('换个表情') ||
    normalizedPrompt.includes('切换情绪') ||
    normalizedPrompt.includes('换张脸')
  ) {
    return 'happy';
  }
  return null;
};

const scoreText = (text: string, scores: EmotionScoreMap, factor: number): void => {
  if (!text.trim()) return;
  for (const rule of EMOTION_RULES) {
    if (hasAnyKeyword(text, rule.keywords)) {
      scores[rule.emotion] += rule.weight * factor;
    }
  }
};

export const inferAssistantEmotion = (prompt: string, reply: string): AssistantEmotion => {
  const normalizedPrompt = (prompt || '').toLowerCase();
  const normalizedReply = (reply || '').toLowerCase();

  const explicit = inferExplicitEmotionFromPrompt(normalizedPrompt);
  if (explicit) return explicit;

  const scores: EmotionScoreMap = {
    angry: 0,
    doubt: 0,
    rebuttal: 0,
    worry: 0,
    happy: 0,
    cute: 0,
    calm: 1.2,
    sad: 0,
  };

  // 用户输入与助手回复共同影响情绪，回复权重更高。
  scoreText(normalizedPrompt, scores, 0.8);
  scoreText(normalizedReply, scores, 1);

  // 强化“惊喜/礼物/笑容”这类正向语义，避免被弱负向词意外压过。
  if (hasAnyKeyword(normalizedPrompt + normalizedReply, ['惊喜', '礼物', '激动', '灿烂笑容', '开心', '高兴', '😊', '😄', '💕'])) {
    scores.happy += 1.2;
  }

  let best: AssistantEmotion = 'calm';
  let max = scores.calm;
  for (const emotion of Object.keys(scores) as AssistantEmotion[]) {
    if (scores[emotion] > max) {
      max = scores[emotion];
      best = emotion;
    }
  }
  return best;
};
