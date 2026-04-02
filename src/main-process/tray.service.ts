import { app, Menu, nativeImage, Tray } from 'electron';
import { toggleDesktopPetWindow } from './pet.window';
import { openMainWindowToChat } from './window';

let trayRef: Tray | null = null;

const createAppTrayIcon = () => {
  // Reuse executable icon to avoid extra platform-specific tray assets.
  const icon = nativeImage.createFromPath(process.execPath);
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 });
};

const buildTrayMenu = (): Menu =>
  Menu.buildFromTemplate([
    {
      label: '打开对话',
      click: () => openMainWindowToChat(),
    },
    {
      label: '显示/隐藏桌宠',
      click: () => void toggleDesktopPetWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]);

export const initAppTray = (): void => {
  if (trayRef) return;
  trayRef = new Tray(createAppTrayIcon());
  trayRef.setToolTip('拉文杜拉');
  trayRef.setContextMenu(buildTrayMenu());
  trayRef.on('double-click', () => {
    openMainWindowToChat();
  });
};
