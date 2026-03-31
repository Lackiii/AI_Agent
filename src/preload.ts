import { contextBridge, ipcRenderer } from 'electron';
import type {
  CreateReminderInput,
  OcrEngineStatus,
  Reminder,
  ScreenshotCaptureStartOptions,
  ScreenshotCaptureStatus,
  ScreenshotListFilter,
  ScreenshotRecord,
} from './shared/types/domain';
import type { GreetingSettingsDTO } from './shared/types/greeting';
import type { ChatMessage } from './shared/types/llm';
import type { VaultReadResult } from './shared/types/vault';

contextBridge.exposeInMainWorld('assistantApi', {
  llm: {
    chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
  },
  memory: {
    clear: () => ipcRenderer.invoke('memory:clear') as Promise<boolean>,
    list: () => ipcRenderer.invoke('memory:list') as Promise<ChatMessage[]>,
    remove: (messageId: string) => ipcRenderer.invoke('memory:remove', messageId) as Promise<boolean>,
  },
  navigation: {
    onAppNavigate: (callback: (path: string) => void) => {
      const listener = (_e: unknown, path: string) => callback(path);
      ipcRenderer.on('app:navigate', listener);
      return () => {
        ipcRenderer.removeListener('app:navigate', listener);
      };
    },
  },
  persona: {
    reset: () => ipcRenderer.invoke('persona:reset') as Promise<boolean>,
  },
  reminders: {
    list: () => ipcRenderer.invoke('reminder:list') as Promise<Reminder[]>,
    create: (input: CreateReminderInput) =>
      ipcRenderer.invoke('reminder:create', input) as Promise<Reminder>,
    remove: (id: string) => ipcRenderer.invoke('reminder:delete', id) as Promise<boolean>,
  },
  screenshots: {
    list: (filter?: ScreenshotListFilter) =>
      ipcRenderer.invoke('screenshot:list', filter) as Promise<ScreenshotRecord[]>,
    captureNow: () => ipcRenderer.invoke('screenshot:captureNow') as Promise<ScreenshotRecord>,
    start: (options: ScreenshotCaptureStartOptions) =>
      ipcRenderer.invoke('screenshot:start', options) as Promise<ScreenshotCaptureStatus>,
    stop: () => ipcRenderer.invoke('screenshot:stop') as Promise<ScreenshotCaptureStatus>,
    status: () => ipcRenderer.invoke('screenshot:status') as Promise<ScreenshotCaptureStatus>,
    ocrStatus: () => ipcRenderer.invoke('screenshot:ocrStatus') as Promise<OcrEngineStatus>,
    remove: (id: string) => ipcRenderer.invoke('screenshot:delete', id) as Promise<boolean>,
    removeAll: () => ipcRenderer.invoke('screenshot:deleteAll') as Promise<number>,
  },
  greeting: {
    getSettings: () => ipcRenderer.invoke('greeting:getSettings') as Promise<GreetingSettingsDTO>,
    setSettings: (patch: Partial<GreetingSettingsDTO>) =>
      ipcRenderer.invoke('greeting:setSettings', patch) as Promise<GreetingSettingsDTO>,
    sendTestNotification: () =>
      ipcRenderer.invoke('greeting:testNotification') as Promise<
        { ok: true } | { ok: false; error: string }
      >,
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list') as Promise<string[]>,
    read: (relativePath: string) =>
      ipcRenderer.invoke('vault:read', relativePath) as Promise<VaultReadResult>,
    delete: (relativePath: string) => ipcRenderer.invoke('vault:delete', relativePath) as Promise<boolean>,
  },
});

/** 兼容旧前端调用 */
contextBridge.exposeInMainWorld('deepseekApi', {
  chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
});
