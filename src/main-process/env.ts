import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseEnv } from 'dotenv';

export type EnvLoadReport = {
  loadedFrom: string | null;
  parsedKeys: string[];
  triedPaths: string[];
};

let envLoadReport: EnvLoadReport = {
  loadedFrom: null,
  parsedKeys: [],
  triedPaths: [],
};

export const getEnvLoadReport = (): EnvLoadReport => envLoadReport;

const tryParseEnvText = (text: string): Record<string, string> => {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n');
  const sanitizeKey = (rawKey: string): string =>
    rawKey
      .replace(/^[^A-Za-z_]+/, '')
      .replace(/[^A-Za-z0-9_]/g, '')
      .trim();

  const parsed = parseEnv(normalized);
  const sanitizedParsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const safeKey = sanitizeKey(key);
    if (safeKey) {
      sanitizedParsed[safeKey] = value;
    }
  }
  if (Object.keys(sanitizedParsed).length > 0) {
    return sanitizedParsed;
  }

  const manual: Record<string, string> = {};
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator < 1) {
      continue;
    }

    const key = sanitizeKey(line.slice(0, separator));
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) {
      manual[key] = value;
    }
  }

  return manual;
};

export const loadProjectEnvironment = (): void => {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve('.', '.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  try {
    envPaths.push(path.resolve(app.getAppPath(), '.env'));
  } catch {
    // 在部分 Electron 版本 / 生命周期下，getAppPath 在 ready 前可能不可用，避免阻断后续 IPC 注册
  }

  let loadedFrom: string | null = null;
  const parsedKeys: string[] = [];
  const triedPaths: string[] = [];

  for (const envPath of envPaths) {
    const normalizedPath = path.normalize(envPath);
    const exists = fs.existsSync(normalizedPath);
    triedPaths.push(`${normalizedPath}:${exists ? 'exists' : 'missing'}`);
    if (!exists) {
      continue;
    }

    const raw = fs.readFileSync(normalizedPath);
    const candidates = [raw.toString('utf8'), raw.toString('utf16le'), raw.toString('latin1')];
    let parsed: Record<string, string> = {};
    for (const candidate of candidates) {
      parsed = tryParseEnvText(candidate);
      if (Object.keys(parsed).length > 0) {
        break;
      }
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
      parsedKeys.push(key);
    }

    if (Object.keys(parsed).length > 0) {
      loadedFrom = normalizedPath;
      break;
    }
  }

  envLoadReport = { loadedFrom, parsedKeys, triedPaths };

  if (!process.env.LLM_API_KEY) {
    const localEnvPath = path.resolve(process.cwd(), '.env');
    const localEnvContent = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath) : null;
    if (localEnvContent) {
      const fallbackText = localEnvContent
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .replace(/\0/g, '')
        .replace(/\r\n/g, '\n');
      const keyLine = fallbackText
        .split('\n')
        .find(
          (line) =>
            line.trim().startsWith('LLM_API_KEY=') || line.trim().startsWith('DEEPSEEK_API_KEY='),
        );
      if (keyLine) {
        const trimmedLine = keyLine.trim();
        const value = trimmedLine
          .slice(trimmedLine.indexOf('=') + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        process.env.LLM_API_KEY = value;
      }
    }
  }
};
