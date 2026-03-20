import type { ScreenshotListFilter, ScreenshotRecord } from '../shared/types/domain';

/**
 * 开题报告中的「定时截图 + OCR + 轨迹检索」占位实现。
 * 后续可接入：desktopCapturer、本地文件存储、PaddleOCR 或调用 Python 服务。
 */
const inMemoryTrail: ScreenshotRecord[] = [];

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
