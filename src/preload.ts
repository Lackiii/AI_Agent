import { contextBridge, ipcRenderer } from 'electron';
import type { CreateReminderInput, Reminder, ScreenshotListFilter, ScreenshotRecord } from './shared/types/domain';
import type { GreetingSettingsDTO } from './shared/types/greeting';
import type { ChatMessage } from './shared/types/llm';

contextBridge.exposeInMainWorld('assistantApi', {
  llm: {
    chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
  },
  memory: {
    clear: () => ipcRenderer.invoke('memory:clear') as Promise<boolean>,
    list: () => ipcRenderer.invoke('memory:list') as Promise<ChatMessage[]>,
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
  greeting: {
    getSettings: () => ipcRenderer.invoke('greeting:getSettings') as Promise<GreetingSettingsDTO>,
    setSettings: (patch: Partial<GreetingSettingsDTO>) =>
      ipcRenderer.invoke('greeting:setSettings', patch) as Promise<GreetingSettingsDTO>,
  },
});

/** 兼容旧前端调用 */
contextBridge.exposeInMainWorld('deepseekApi', {
  chat: (prompt: string) => ipcRenderer.invoke('llm:chat', prompt) as Promise<string>,
});
