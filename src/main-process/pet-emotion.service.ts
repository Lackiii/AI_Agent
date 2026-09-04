import type { AssistantEmotion } from '../shared/types/emotion';

export const ASSISTANT_EMOTIONS: AssistantEmotion[] = [
  'angry',
  'doubt',
  'rebuttal',
  'worry',
  'happy',
  'cute',
  'calm',
  'sad',
];

const EMOTION_SET = new Set<string>(ASSISTANT_EMOTIONS);

/** Compact trailer the model must append; stripped before UI/memory. */
const EMOTION_TAG_RE =
  /\[\s*\[\s*emotion\s*:\s*([a-zA-Z_]+)\s*(?:\|\s*([01](?:\.\d+)?|1(?:\.0+)?))?\s*\]\s*\]\s*$/i;

const FORCE_PATTERNS: Array<{ emotion: AssistantEmotion; patterns: RegExp[] }> = [
  {
    emotion: 'angry',
    patterns: [/换.*(生气|愤怒).*脸/, /生气脸/, /愤怒脸/, /强制生气/, /扮生气/, /演.*生气/, /test[:：]?\s*生气/i],
  },
  {
    emotion: 'happy',
    patterns: [/换.*(开心|高兴).*脸/, /开心脸/, /强制开心/, /扮开心/, /test[:：]?\s*开心/i],
  },
  {
    emotion: 'cute',
    patterns: [/卖萌/, /换.*(可爱|撒娇).*脸/, /可爱脸/, /强制可爱/, /test[:：]?\s*可爱/i],
  },
  {
    emotion: 'sad',
    patterns: [/换.*(伤心|难过|悲伤).*脸/, /伤心脸/, /扮难过/, /test[:：]?\s*难过/i],
  },
  {
    emotion: 'worry',
    patterns: [/换.*(担心|焦虑).*脸/, /担心脸/, /test[:：]?\s*担心/i],
  },
  {
    emotion: 'doubt',
    patterns: [/换.*(质疑|怀疑|疑惑).*脸/, /质疑脸/, /test[:：]?\s*质疑/i],
  },
  {
    emotion: 'rebuttal',
    patterns: [/换.*(反驳|反对).*脸/, /反驳脸/, /test[:：]?\s*反驳/i],
  },
  {
    emotion: 'calm',
    patterns: [/换.*(平静|冷静).*脸/, /平静脸/, /恢复默认表情/, /还原表情/],
  },
];

const GENERIC_SWITCH_RE = /(换个情绪|换个表情|切换情绪|换张脸)/;

type EmotionState = {
  current: AssistantEmotion;
  pending: AssistantEmotion | null;
  pendingCount: number;
  lastChangeAt: number;
};

let state: EmotionState = {
  current: 'calm',
  pending: null,
  pendingCount: 0,
  lastChangeAt: 0,
};

const COOLDOWN_MS = 3000;
const SWITCH_STREAK = 2;
const HIGH_INTENSITY = 0.85;
const MIN_INTENSITY = 0.55;

export const buildEmotionInstructionSystemMessage = (): string =>
  [
    '桌宠表情控制（对用户不可见）：',
    '在完整回复正文结束后，另起一行、只输出一行情绪标记，格式严格为：[[emotion:<标签>|<0到1强度>]]',
    `可选标签：${ASSISTANT_EMOTIONS.join('|')}`,
    '按你此刻的人设语气与表演选择（助手正在演的情绪），不要只跟着用户字面词走：',
    '- 用户说“生气/test：生气”且你在配合演戏 → angry',
    '- 用户抱怨但你温柔安慰 → calm 或 cute',
    '- 不确定时用 calm，强度 0.3～0.5',
    '不要向用户解释这行标记，也不要把它写进正文中间。',
  ].join('\n');

const parseEmotionName = (raw: string | undefined): AssistantEmotion | null => {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return EMOTION_SET.has(key) ? (key as AssistantEmotion) : null;
};

export const extractForcedEmotion = (prompt: string): AssistantEmotion | null => {
  const text = (prompt || '').trim();
  if (!text) return null;
  for (const rule of FORCE_PATTERNS) {
    if (rule.patterns.some((re) => re.test(text))) return rule.emotion;
  }
  if (GENERIC_SWITCH_RE.test(text)) return 'happy';
  return null;
};

export type ParsedEmotionReply = {
  cleanReply: string;
  emotion: AssistantEmotion | null;
  intensity: number;
};

/**
 * Strip trailing [[emotion:tag|intensity]] and return cleaned reply + parsed tag.
 */
export const parseEmotionTaggedReply = (reply: string): ParsedEmotionReply => {
  const raw = reply ?? '';
  const match = raw.match(EMOTION_TAG_RE);
  if (!match) {
    return { cleanReply: raw.trimEnd(), emotion: null, intensity: 0.5 };
  }
  const emotion = parseEmotionName(match[1]);
  const intensityRaw = match[2] ? Number(match[2]) : 0.7;
  const intensity = Number.isFinite(intensityRaw) ? Math.min(1, Math.max(0, intensityRaw)) : 0.7;
  const cleanReply = raw.slice(0, match.index).trimEnd();
  return { cleanReply, emotion, intensity };
};

export type ResolveEmotionResult = {
  emotion: AssistantEmotion;
  cleanReply: string;
  forced: boolean;
};

/**
 * Resolve pet emotion: force keyword > LLM tag (with light state machine) > calm.
 */
export const resolveAssistantEmotion = (prompt: string, reply: string): ResolveEmotionResult => {
  const forced = extractForcedEmotion(prompt);
  const parsed = parseEmotionTaggedReply(reply);
  const now = Date.now();

  if (forced) {
    state = {
      current: forced,
      pending: null,
      pendingCount: 0,
      lastChangeAt: now,
    };
    return { emotion: forced, cleanReply: parsed.cleanReply, forced: true };
  }

  const candidate = parsed.emotion ?? 'calm';
  const intensity = parsed.emotion ? parsed.intensity : 0.4;

  if (candidate === state.current) {
    state = { ...state, pending: null, pendingCount: 0 };
    return { emotion: state.current, cleanReply: parsed.cleanReply, forced: false };
  }

  const sinceLast = now - state.lastChangeAt;
  const inCooldown = sinceLast < COOLDOWN_MS;
  const towardCalm = candidate === 'calm';
  const strongEnough = towardCalm ? intensity >= 0.4 : intensity >= MIN_INTENSITY;
  const veryStrong = intensity >= HIGH_INTENSITY;

  if (!strongEnough) {
    return { emotion: state.current, cleanReply: parsed.cleanReply, forced: false };
  }

  let pending = state.pending;
  let pendingCount = state.pendingCount;
  if (pending === candidate) {
    pendingCount += 1;
  } else {
    pending = candidate;
    pendingCount = 1;
  }

  // calm 衰减更容易；强情绪或连续同情绪才切换，冷却期内除非强度很高。
  const allowSwitch =
    (!inCooldown || veryStrong || towardCalm) &&
    (veryStrong || towardCalm || pendingCount >= SWITCH_STREAK);

  if (allowSwitch) {
    state = {
      current: candidate,
      pending: null,
      pendingCount: 0,
      lastChangeAt: now,
    };
    return { emotion: candidate, cleanReply: parsed.cleanReply, forced: false };
  }

  state = { ...state, pending, pendingCount };
  return { emotion: state.current, cleanReply: parsed.cleanReply, forced: false };
};

/** @deprecated Prefer resolveAssistantEmotion; kept for call-site clarity in tests. */
export const inferAssistantEmotion = (prompt: string, reply: string): AssistantEmotion =>
  resolveAssistantEmotion(prompt, reply).emotion;

export const getAssistantEmotionState = (): Readonly<EmotionState> => ({ ...state });

export const resetAssistantEmotionState = (): void => {
  state = { current: 'calm', pending: null, pendingCount: 0, lastChangeAt: 0 };
};
