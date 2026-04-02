import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { DesktopPetSettingsDTO } from '../shared/types/pet';

type DesktopPetSettingsFile = DesktopPetSettingsDTO & { version: 1 };

const DEFAULTS: DesktopPetSettingsFile = {
  version: 1,
  showOnStartup: true,
  size: 220,
  opacity: 1,
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const normalizeSize = (v: unknown): number => clamp(Number(v) || DEFAULTS.size, 140, 420);
const normalizeOpacity = (v: unknown): number => clamp(Number(v) || DEFAULTS.opacity, 0.35, 1);

const getFilePath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), 'desktop-pet-settings.json');
};

const readFile = (): DesktopPetSettingsFile => {
  const fp = getFilePath();
  if (!fs.existsSync(fp)) return { ...DEFAULTS };
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw) as Partial<DesktopPetSettingsFile>;
    return {
      version: 1,
      showOnStartup: typeof data.showOnStartup === 'boolean' ? data.showOnStartup : DEFAULTS.showOnStartup,
      size: normalizeSize(data.size),
      opacity: normalizeOpacity(data.opacity),
    };
  } catch {
    return { ...DEFAULTS };
  }
};

const writeFile = (data: DesktopPetSettingsFile): void => {
  const fp = getFilePath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
};

export const getDesktopPetSettings = (): DesktopPetSettingsDTO => {
  const f = readFile();
  return {
    showOnStartup: f.showOnStartup,
    size: f.size,
    opacity: f.opacity,
  };
};

export const setDesktopPetSettings = (patch: Partial<DesktopPetSettingsDTO>): DesktopPetSettingsDTO => {
  const cur = readFile();
  const next: DesktopPetSettingsFile = {
    version: 1,
    showOnStartup: typeof patch.showOnStartup === 'boolean' ? patch.showOnStartup : cur.showOnStartup,
    size: patch.size == null ? cur.size : normalizeSize(patch.size),
    opacity: patch.opacity == null ? cur.opacity : normalizeOpacity(patch.opacity),
  };
  writeFile(next);
  return { showOnStartup: next.showOnStartup, size: next.size, opacity: next.opacity };
};
