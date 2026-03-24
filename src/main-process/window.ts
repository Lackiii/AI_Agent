import { BrowserWindow } from 'electron';
import path from 'node:path';
import { setDesktopNotificationWindow } from './desktop-notification.service';

export const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
  setDesktopNotificationWindow(mainWindow);
  return mainWindow;
};
