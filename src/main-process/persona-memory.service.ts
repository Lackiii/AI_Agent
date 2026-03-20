import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { assistantPersona as defaultPersona } from '../config/persona';

type PersonaFile = {
  version: 1;
  /** 用户通过对话写入的人设，覆盖默认 config */
  content: string;
};

const getFilePath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), 'assistant-persona.json');
};

const readFile = (): PersonaFile | null => {
  const fp = getFilePath();
  if (!fs.existsSync(fp)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw) as PersonaFile;
    if (typeof data.content !== 'string') {
      return null;
    }
    return { version: 1, content: data.content };
  } catch {
    return null;
  }
};

const writeFile = (content: string): void => {
  const fp = getFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const payload: PersonaFile = { version: 1, content };
  fs.writeFileSync(fp, JSON.stringify(payload, null, 2), 'utf8');
};

/** 当前用于 system 的完整人设（有用户覆盖则用覆盖，否则用代码默认） */
export const getEffectivePersona = (): string => {
  const saved = readFile();
  const text = saved?.content?.trim();
  if (text) {
    return text;
  }
  return defaultPersona;
};

export const savePersonaOverride = (content: string): void => {
  writeFile(content.trim());
};

export const clearPersonaOverride = (): void => {
  const fp = getFilePath();
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
};

/**
 * 用户在对话里表达「恢复默认 / 清除自定义人设」等时，删除本地覆盖文件。
 * 在「抽取新人设」之前调用，避免同一句既重置又误触发抽取。
 */
export const tryResetPersonaFromUserPhrase = (text: string): boolean => {
  const t = text.trim();
  if (!t) {
    return false;
  }
  if (/(不要|别|勿|不想|不用|无需).{0,8}(恢复默认|清除人设|重置人设|删掉人设|还原)/.test(t)) {
    return false;
  }
  if (
    /恢复默认[人]?设/.test(t) ||
    /^恢复默认$/i.test(t) ||
    /清除[了]?自定义[人]?设|清除[人]?设记忆/.test(t) ||
    /删掉[人]?设|重置[人]?设|还原默认[人]?设/.test(t) ||
    /^恢复代码(里)?的默认人设$/i.test(t)
  ) {
    clearPersonaOverride();
    return true;
  }
  return false;
};
