import type { ScreenshotListFilter, ScreenshotRecord } from '../shared/types/domain';

/**
 * 开题报告中的「定时截图 + OCR + 轨迹检索」占位实现。
 * 后续可接入：desktopCapturer、本地文件存储、PaddleOCR 或调用 Python 服务。
 */
const inMemoryTrail: ScreenshotRecord[] = [];

export const listScreenshots = (filter?: ScreenshotListFilter): ScreenshotRecord[] => {
  let rows = [...inMemoryTrail];
  const from = filter?.from;
  const to = filter?.to;
  if (from) {
    rows = rows.filter((r) => r.capturedAt >= from);
  }
  if (to) {
    rows = rows.filter((r) => r.capturedAt <= to);
  }
  return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
};

export const registerScreenshotStub = (record: ScreenshotRecord): void => {
  inMemoryTrail.push(record);
};
