import { desktopCapturer } from 'electron';
import type {
  OcrEngineStatus,
  ScreenshotCaptureStartOptions,
  ScreenshotCaptureStatus,
  ScreenshotListFilter,
  ScreenshotRecord,
} from '../shared/types/domain';

/**
 * 开题报告中的「定时截图 + OCR + 轨迹检索」占位实现。
 * 后续可接入：desktopCapturer、本地文件存储、PaddleOCR 或调用 Python 服务。
 */
const inMemoryTrail: ScreenshotRecord[] = [];
let captureTimer: NodeJS.Timeout | null = null;
let captureStatus: ScreenshotCaptureStatus = { running: false };

const getBackendBaseUrl = (): string => {
  return process.env.BACKEND_BASE_URL?.trim() || 'http://127.0.0.1:8000';
};

export const listScreenshots = async (filter?: ScreenshotListFilter): Promise<ScreenshotRecord[]> => {
  // Prefer backend; fallback to local in-memory placeholder.
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams();
    if (filter?.from) params.set('from', filter.from);
    if (filter?.to) params.set('to', filter.to);

    const res = await fetch(`${baseUrl}/screenshots?${params.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error(`backend error: ${res.status}`);

    const data = (await res.json()) as ScreenshotRecord[];
    return data.slice().sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  } catch {
    let rows = [...inMemoryTrail];
    const from = filter?.from;
    const to = filter?.to;
    if (from) rows = rows.filter((r) => r.capturedAt >= from);
    if (to) rows = rows.filter((r) => r.capturedAt <= to);
    return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }
};

export const registerScreenshotStub = (record: ScreenshotRecord): void => {
  inMemoryTrail.push(record);
};

const postScreenshotOcr = async (imageBase64: string, capturedAt: string): Promise<ScreenshotRecord> => {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/screenshots/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, capturedAt }),
  });
  if (!res.ok) {
    throw new Error(`backend error: ${res.status}`);
  }
  return (await res.json()) as ScreenshotRecord;
};

export const getOcrEngineStatus = async (): Promise<OcrEngineStatus> => {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/screenshots/ocr/status`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`backend error: ${res.status}`);
  }
  return (await res.json()) as OcrEngineStatus;
};

const capturePrimaryScreenAsDataUrl = async (): Promise<string> => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    fetchWindowIcons: false,
    thumbnailSize: { width: 1600, height: 900 },
  });
  if (!sources.length) {
    throw new Error('No screen source found');
  }
  const source = sources[0];
  return source.thumbnail.toDataURL();
};

const isValidHm = (v?: string): boolean => {
  if (!v) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
};

const hmToMinutes = (v: string): number => {
  const [h, m] = v.split(':').map((x) => Number(x));
  return h * 60 + m;
};

const isInsideCaptureWindow = (now: Date, windowStart?: string, windowEnd?: string): boolean => {
  if (!windowStart || !windowEnd) return true;
  if (!isValidHm(windowStart) || !isValidHm(windowEnd)) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = hmToMinutes(windowStart);
  const end = hmToMinutes(windowEnd);
  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
};

export const captureScreenshotNow = async (): Promise<ScreenshotRecord> => {
  const capturedAt = new Date().toISOString();
  const imageBase64 = await capturePrimaryScreenAsDataUrl();
  try {
    const saved = await postScreenshotOcr(imageBase64, capturedAt);
    captureStatus = { ...captureStatus, lastCapturedAt: saved.capturedAt || capturedAt };
    return saved;
  } catch {
    const fallback: ScreenshotRecord = {
      id: `local-${Date.now()}`,
      capturedAt,
      ocrText: '',
      ocrStatus: 'backend_unreachable',
      ocrError: '后端不可达或 OCR 接口调用失败',
    };
    inMemoryTrail.push(fallback);
    captureStatus = { ...captureStatus, lastCapturedAt: capturedAt };
    return fallback;
  }
};

export const startScreenshotCapture = (options: ScreenshotCaptureStartOptions): ScreenshotCaptureStatus => {
  const safeInterval =
    Number.isFinite(options.intervalMinutes) && options.intervalMinutes > 0 ? options.intervalMinutes : 5;
  const windowStart = options.windowStart?.trim() || undefined;
  const windowEnd = options.windowEnd?.trim() || undefined;
  if ((windowStart && !windowEnd) || (!windowStart && windowEnd)) {
    throw new Error('采集窗口需同时设置开始与结束时间');
  }
  if (!isValidHm(windowStart) || !isValidHm(windowEnd)) {
    throw new Error('采集窗口时间格式错误，应为 HH:mm');
  }
  if (captureTimer) {
    clearInterval(captureTimer);
  }
  captureTimer = setInterval(() => {
    if (!isInsideCaptureWindow(new Date(), windowStart, windowEnd)) {
      return;
    }
    void captureScreenshotNow();
  }, safeInterval * 60 * 1000);
  captureStatus = { ...captureStatus, running: true, intervalMinutes: safeInterval, windowStart, windowEnd };
  return captureStatus;
};

export const stopScreenshotCapture = (): ScreenshotCaptureStatus => {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  captureStatus = { ...captureStatus, running: false, intervalMinutes: undefined, windowStart: undefined, windowEnd: undefined };
  return captureStatus;
};

export const getScreenshotCaptureStatus = (): ScreenshotCaptureStatus => {
  return { ...captureStatus };
};
