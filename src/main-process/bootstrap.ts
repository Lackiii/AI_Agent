import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { loadProjectEnvironment } from './env';
import { registerIpcHandlers } from './ipc/register';
import { createMainWindow } from './window';
import { connectBackendReminderNotifications } from './backend-ws';

/**
 * 环境加载失败不应阻止 IPC 注册，否则渲染进程会出现 “No handler registered”。
 */
const bootstrapCore = (): void => {
  try {
    loadProjectEnvironment();
  } catch (error) {
    console.error('[env] Failed to load project environment:', error);
  }
  registerIpcHandlers();
};

if (started) {
  bootstrapCore();
  app.quit();
} else {
  app.whenReady().then(() => {
    bootstrapCore();
    createMainWindow();
    connectBackendReminderNotifications();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
