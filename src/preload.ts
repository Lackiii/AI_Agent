import { contextBridge, ipcRenderer } from 'electron';
import type { CreateReminderInput, Reminder, ScreenshotListFilter, ScreenshotRecord } from './shared/types/domain';

contextBridge.exposeInMainWorld('assistantApi', {
  llm: {
    chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
  },
  memory: {
    clear: () => ipcRenderer.invoke('memory:clear') as Promise<boolean>,
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
  },
});

/** 兼容旧前端调用 */
contextBridge.exposeInMainWorld('deepseekApi', {
  chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
});
