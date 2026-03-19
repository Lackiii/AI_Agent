import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('deepseekApi', {
  chat: (prompt: string) => ipcRenderer.invoke('deepseek:chat', prompt),
});
