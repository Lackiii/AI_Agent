import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { loadProjectEnvironment } from './env';
import { registerIpcHandlers } from './ipc/register';
import { createMainWindow } from './window';
import { connectBackendReminderNotifications } from './backend-ws';
import { sendTestNotification } from './greeting-notification.service';
import { restartGreetingScheduler } from './greeting-scheduler.service';

// Windows Toast 依赖固定 App User Model ID；未设置时用户即使「允许通知」也可能收不到弹窗
if (process.platform === 'win32') {
  app.setAppUserModelId('com.ai_agent.desktop');
}

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
  // 单独注册：避免仅主进程未重启时与其它 IPC 不同步；且便于确认该通道一定存在
  ipcMain.removeHandler('greeting:testNotification');
  ipcMain.handle('greeting:testNotification', async () => sendTestNotification());
};

if (started) {
  bootstrapCore();
  app.quit();
} else {
  app.whenReady().then(() => {
    bootstrapCore();
    createMainWindow();
    connectBackendReminderNotifications();
    restartGreetingScheduler();
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
