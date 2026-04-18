import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * 将 userData 指到 E 盘（或任意目录）须在 app ready 之前调用。
 * 在项目根目录 `.env` 中设置：AI_AGENT_USER_DATA_PATH=E:\\你的路径
 */
const tryLoadDotenvNearProject = (): void => {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      loadDotenv({ path: p });
      break;
    }
  }
};

tryLoadDotenvNearProject();

const raw = process.env.AI_AGENT_USER_DATA_PATH?.trim();
if (raw) {
  try {
    app.setPath('userData', path.resolve(raw));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[setup-user-data] Failed to set userData path:', error);
  }
}
