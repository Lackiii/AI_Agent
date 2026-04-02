import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

type PickedRegion = { x: number; y: number; width: number; height: number };

let pickerWindow: BrowserWindow | null = null;
let deferred:
  | {
      resolved: boolean;
      resolve: (value: PickedRegion | null) => void;
      promise: Promise<PickedRegion | null>;
    }
  | null = null;

const finishPick = (value: PickedRegion | null) => {
  if (!deferred || deferred.resolved) return;
  deferred.resolved = true;
  const win = pickerWindow;
  pickerWindow = null;
  const resolve = deferred.resolve;
  const cleanup = () => {
    deferred = null;
  };

  try {
    resolve(value);
  } finally {
    cleanup();
    try {
      win?.close();
    } catch {
      // ignore
    }
  }
};

export const openRegionPickerWindow = (): Promise<PickedRegion | null> => {
  if (deferred) {
    return deferred.promise;
  }

  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreen: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  pickerWindow = win;

  deferred = (() => {
    let resolve!: (value: PickedRegion | null) => void;
    const promise = new Promise<PickedRegion | null>((r) => {
      resolve = r;
    });
    return { resolved: false, resolve, promise };
  })();

  win.on('closed', () => {
    // If user closed the window without explicit submit/cancel, treat as cancel.
    finishPick(null);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/page/region-picker`);
  } else {
    const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    win.loadURL(`file://${indexPath}#/page/region-picker`);
  }

  return deferred.promise;
};

export const submitRegionPick = (region: PickedRegion | null): void => {
  finishPick(region);
};

