import { BrowserWindow, Notification } from 'electron';

let mainWindow: BrowserWindow | null = null;

export const setDesktopNotificationWindow = (win: BrowserWindow | null): void => {
  mainWindow = win;
};

/** 仅负责弹出 Toast 与点击聚焦；记忆由调用方写入。 */
export const showDesktopNotification = (title: string, body: string): void => {
  const safeTitle = title.slice(0, 64);
  const safeBody = body.replace(/\s+/g, ' ').slice(0, 280);

  if (!Notification.isSupported()) {
    return;
  }

  try {
    const n = new Notification({ title: safeTitle, body: safeBody });
    n.on('click', () => {
      const w = mainWindow;
      if (w && !w.isDestroyed()) {
        if (w.isMinimized()) w.restore();
        w.show();
        w.focus();
        w.webContents.send('app:navigate', '/page/chat');
      }
    });
    n.show();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[desktop-notification]', e);
  }
};
