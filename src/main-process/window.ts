import { BrowserWindow } from 'electron';
import path from 'node:path';
import { setDesktopNotificationWindow } from './desktop-notification.service';

let mainWindowRef: BrowserWindow | null = null;

const loadRendererRoute = (window: BrowserWindow, routePath?: string): void => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = routePath
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, '')}/#${routePath}`
      : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    window.loadURL(url);
    return;
  }
  window.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    routePath ? { hash: routePath } : undefined,
  );
};

export const createMainWindow = (): BrowserWindow => {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.show();
    mainWindowRef.focus();
    return mainWindowRef;
  }

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadRendererRoute(mainWindow);

  mainWindow.webContents.openDevTools();
  setDesktopNotificationWindow(mainWindow);
  mainWindowRef = mainWindow;
  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });
  return mainWindow;
};

export const openMainWindowToChat = (): void => {
  const mainWindow = createMainWindow();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('app:navigate', '/page/chat');
};

export const loadWindowRoute = loadRendererRoute;
