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
  const applyFilterAndSort = (rows: ScreenshotRecord[]): ScreenshotRecord[] => {
    const from = filter?.from;
    const to = filter?.to;
    let filtered = rows.slice();
    if (from) filtered = filtered.filter((r) => r.capturedAt >= from);
    if (to) filtered = filtered.filter((r) => r.capturedAt <= to);
    return filtered.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  };

  // Prefer backend; merge local fallback records to avoid losing transient captures.
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams();
    if (filter?.from) params.set('from', filter.from);
    if (filter?.to) params.set('to', filter.to);

    const res = await fetch(`${baseUrl}/screenshots?${params.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error(`backend error: ${res.status}`);

    const data = (await res.json()) as ScreenshotRecord[];
    const mergedById = new Map<string, ScreenshotRecord>();
    for (const local of inMemoryTrail) mergedById.set(local.id, local);
    for (const remote of data) mergedById.set(remote.id, remote);
    return applyFilterAndSort([...mergedById.values()]);
  } catch {
    return applyFilterAndSort([...inMemoryTrail]);
  }
};

export const removeScreenshot = async (id: string): Promise<boolean> => {
  const screenshotId = String(id ?? '').trim();
  if (!screenshotId) return false;
  const removeLocal = (): boolean => {
    const idx = inMemoryTrail.findIndex((r) => r.id === screenshotId);
    if (idx < 0) return false;
    inMemoryTrail.splice(idx, 1);
    return true;
  };
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/screenshots/${encodeURIComponent(screenshotId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`backend error: ${res.status}`);
    const data = (await res.json()) as { deleted?: boolean };
    if (data.deleted) {
      removeLocal();
      return true;
    }
  } catch {
    // fallback to local in-memory trail
  }
  return removeLocal();
};

export const removeAllScreenshots = async (): Promise<number> => {
  try {
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/screenshots`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`backend error: ${res.status}`);
    const data = (await res.json()) as { deletedCount?: number };
    if (Number.isFinite(data.deletedCount)) {
      const deletedLocal = inMemoryTrail.length;
      inMemoryTrail.splice(0, inMemoryTrail.length);
      return Math.max(Number(data.deletedCount), deletedLocal);
    }
  } catch {
    // fallback to local in-memory trail
  }
  const deleted = inMemoryTrail.length;
  inMemoryTrail.splice(0, inMemoryTrail.length);
  return deleted;
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
  try {
    const imageBase64 = await capturePrimaryScreenAsDataUrl();
    const saved = await postScreenshotOcr(imageBase64, capturedAt);
    captureStatus = { ...captureStatus, lastCapturedAt: saved.capturedAt || capturedAt };
    return saved;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const fallback: ScreenshotRecord = {
      id: `local-${Date.now()}`,
      capturedAt,
      ocrText: '',
      ocrStatus: 'backend_unreachable',
      ocrError: reason ? `截图或 OCR 失败：${reason}` : '截图或 OCR 失败',
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
  if (isInsideCaptureWindow(new Date(), windowStart, windowEnd)) {
    void captureScreenshotNow();
  }
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

const toPreview = (v: string | undefined, maxLen = 120): string => {
  if (!v) return '';
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > maxLen ? `${t.slice(0, maxLen)}...` : t;
};

const formatLocalDateTime = (isoLike: string): string => {
  if (!isoLike) return '';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds(),
  )}`;
};

export const runScreenshotTool = async (name: string, argsJson: string): Promise<string> => {
  if (name !== 'screenshot_search') {
    return JSON.stringify({ ok: false, error: `Unknown screenshot tool: ${name}` });
  }
  try {
    const raw = argsJson?.trim() ? JSON.parse(argsJson) : {};
    const keyword = String(raw?.keyword ?? '').trim().toLowerCase();
    const from = raw?.from ? String(raw.from) : undefined;
    const to = raw?.to ? String(raw.to) : undefined;
    const status = raw?.status ? String(raw.status) : undefined;
    const limitRaw = Number(raw?.limit ?? 6);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 6;

    let rows = await listScreenshots({ from, to });
    rows = rows.slice().sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    if (status) {
      rows = rows.filter((r) => (r.ocrStatus || 'unknown') === status);
    }
    if (keyword) {
      rows = rows.filter((r) => {
        const haystack = `${r.ocrText || ''} ${r.ocrError || ''} ${r.filePath || ''}`.toLowerCase();
        return haystack.includes(keyword);
      });
    }
    const picked = rows.slice(0, limit).map((r) => ({
      id: r.id,
      capturedAt: r.capturedAt,
      capturedAtLocal: formatLocalDateTime(r.capturedAt),
      ocrStatus: r.ocrStatus || 'unknown',
      ocrTextPreview: toPreview(r.ocrText),
      ocrErrorPreview: toPreview(r.ocrError, 80),
      filePath: r.filePath || '',
    }));
    const timeline = picked.map(
      (x, i) =>
        `${i + 1}) ${x.capturedAtLocal} | ${x.ocrStatus} | ${x.ocrTextPreview || '（无 OCR 文本）'}${
          x.ocrErrorPreview ? ` | err=${x.ocrErrorPreview}` : ''
        }`,
    );
    const statusCounter = rows.reduce(
      (acc, r) => {
        const s = r.ocrStatus || 'unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const statusSummary = Object.entries(statusCounter)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    return JSON.stringify({
      ok: true,
      total: rows.length,
      returned: picked.length,
      query: { keyword, from, to, status, limit },
      statusSummary,
      timeline,
      items: picked,
      guidance:
        '回答用户时优先引用 timeline；若没有命中，明确说明“未检索到相关截图证据”。若命中含 ocr_error，请给出 1-3 条简短排查建议。',
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
