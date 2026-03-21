import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { GreetingIntervalMode, GreetingSettingsDTO } from '../shared/types/greeting';

type GreetingSettingsFile = GreetingSettingsDTO & { version: 1 };

const DEFAULTS: GreetingSettingsFile = {
  version: 1,
  enabled: false,
  intervalMode: '30m',
};

const VALID_MODES: GreetingIntervalMode[] = ['5m', '10m', '30m', '1h', 'random'];

const getFilePath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), 'greeting-settings.json');
};

const readFile = (): GreetingSettingsFile => {
  const fp = getFilePath();
  if (!fs.existsSync(fp)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw) as Partial<GreetingSettingsFile>;
    const enabled = typeof data.enabled === 'boolean' ? data.enabled : DEFAULTS.enabled;
    const intervalMode = VALID_MODES.includes(data.intervalMode as GreetingIntervalMode)
      ? (data.intervalMode as GreetingIntervalMode)
      : DEFAULTS.intervalMode;
    return { version: 1, enabled, intervalMode };
  } catch {
    return { ...DEFAULTS };
  }
};

const writeFile = (data: GreetingSettingsFile): void => {
  const fp = getFilePath();
  const dir = path.dirname(fp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
};

export const getGreetingSettings = (): GreetingSettingsDTO => {
  const f = readFile();
  return { enabled: f.enabled, intervalMode: f.intervalMode };
};

export const setGreetingSettings = (patch: Partial<GreetingSettingsDTO>): GreetingSettingsDTO => {
  const cur = readFile();
  const next: GreetingSettingsFile = {
    version: 1,
    enabled: patch.enabled ?? cur.enabled,
    intervalMode:
      patch.intervalMode && VALID_MODES.includes(patch.intervalMode)
        ? patch.intervalMode
        : cur.intervalMode,
  };
  writeFile(next);
  return { enabled: next.enabled, intervalMode: next.intervalMode };
};
