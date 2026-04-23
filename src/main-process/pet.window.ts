import { app, BrowserWindow, Menu, screen } from 'electron';
import path from 'node:path';
import { loadWindowRoute, openMainWindowToChat } from './window';
import type { DesktopPetSettingsDTO } from '../shared/types/pet';
import type { AssistantEmotion } from '../shared/types/emotion';

let petWindowRef: BrowserWindow | null = null;
const PET_MARGIN = 18;
const MAX_BUBBLE_LEN = 120;
const DEFAULT_SETTINGS: DesktopPetSettingsDTO = {
  showOnStartup: true,
  size: 220,
  opacity: 1,
};
let petWindowSettings: DesktopPetSettingsDTO = { ...DEFAULT_SETTINGS };

const positionPetWindow = (win: BrowserWindow): void => {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const size = Math.round(petWindowSettings.size);
  win.setBounds({
    x: x + width - size - PET_MARGIN,
    y: y + height - size - PET_MARGIN,
    width: size,
    height: size,
  });
};

const showPetMenu = (win: BrowserWindow): void => {
  const menu = Menu.buildFromTemplate([
    {
      label: '打开对话',
      click: () => openMainWindowToChat(),
    },
    {
      label: '隐藏桌宠',
      click: () => hideDesktopPetWindow(),
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => app.quit(),
    },
  ]);
  menu.popup({ window: win });
};

export const isDesktopPetVisible = (): boolean => {
  if (!petWindowRef || petWindowRef.isDestroyed()) return false;
  return petWindowRef.isVisible();
};

export const showDesktopPetWindow = (): BrowserWindow => {
  const win = createDesktopPetWindow();
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
  return win;
};

export const setDesktopPetWindowSettings = (next: DesktopPetSettingsDTO): void => {
  petWindowSettings = {
    showOnStartup: next.showOnStartup,
    size: Math.round(next.size),
    opacity: next.opacity,
  };
  if (!petWindowRef || petWindowRef.isDestroyed()) return;
  petWindowRef.setOpacity(petWindowSettings.opacity);
  positionPetWindow(petWindowRef);
};

export const getDesktopPetWindowSettings = (): DesktopPetSettingsDTO => ({ ...petWindowSettings });

export const hideDesktopPetWindow = (): void => {
  if (!petWindowRef || petWindowRef.isDestroyed()) return;
  petWindowRef.hide();
};

export const toggleDesktopPetWindow = (): boolean => {
  if (isDesktopPetVisible()) {
    hideDesktopPetWindow();
    return false;
  }
  showDesktopPetWindow();
  return true;
};

export const pushDesktopPetBubble = (text: string): void => {
  if (!text.trim()) return;
  const win = createDesktopPetWindow();
  const body = text.replace(/\s+/g, ' ').trim().slice(0, MAX_BUBBLE_LEN);
  win.webContents.send('pet:bubble', body);
};

export const pushDesktopPetEmotion = (emotion: AssistantEmotion): void => {
  const win = createDesktopPetWindow();
  win.webContents.send('pet:emotion', emotion);
};

export const createDesktopPetWindow = (): BrowserWindow => {
  if (petWindowRef && !petWindowRef.isDestroyed()) {
    petWindowRef.show();
    petWindowRef.focus();
    return petWindowRef;
  }

  const win = new BrowserWindow({
    width: Math.round(petWindowSettings.size),
    height: Math.round(petWindowSettings.size),
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setOpacity(petWindowSettings.opacity);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setMenuBarVisibility(false);
  positionPetWindow(win);
  loadWindowRoute(win, '/page/pet');

  win.webContents.on('context-menu', () => showPetMenu(win));
  win.on('closed', () => {
    if (petWindowRef === win) {
      petWindowRef = null;
    }
  });

  petWindowRef = win;
  return win;
};
