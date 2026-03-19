import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { parse as parseEnv } from 'dotenv';
import { assistantPersona } from './config/persona';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type EnvLoadReport = {
  loadedFrom: string | null;
  parsedKeys: string[];
  triedPaths: string[];
};

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

const loadProjectEnv = (): EnvLoadReport => {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve('.', '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(app.getAppPath(), '.env'),
  ];

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

  return { loadedFrom, parsedKeys, triedPaths };
};

const envLoadReport = loadProjectEnv();
if (!process.env.LLM_API_KEY) {
  const localEnvContent = fs.existsSync(path.resolve(process.cwd(), '.env'))
    ? fs.readFileSync(path.resolve(process.cwd(), '.env'))
    : null;
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
      const value = trimmedLine.slice(trimmedLine.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env.LLM_API_KEY = value;
    }
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

ipcMain.handle('deepseek:chat', async (_event, prompt: string) => {
  const apiKey = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '';
  const baseUrl = process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const model = process.env.LLM_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

  if (!apiKey) {
    throw new Error(
      `LLM_API_KEY is missing. envLoadedFrom=${envLoadReport.loadedFrom ?? 'none'} parsedKeys=${envLoadReport.parsedKeys.join(',') || 'none'} cwd=${process.cwd()} triedPaths=${envLoadReport.triedPaths.join('|') || 'none'}`,
    );
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: assistantPersona,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  const data = (await response.json()) as DeepSeekResponse;
  if (!response.ok) {
    const message = data.error?.message ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data.choices?.[0]?.message?.content ?? '';
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
