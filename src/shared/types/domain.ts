/** 与开题报告模块对齐的领域模型（后续可对接 SQLite / FastAPI） */

export type Reminder = {
  id: string;
  title: string;
  /** ISO 8601，可选：自然语言解析后填入 */
  dueAt?: string;
  /** 用户原始输入，便于追溯 */
  rawText?: string;
  createdAt: string;
};

/** 截图轨迹元数据（OCR 文本、文件路径等可在后续接入 PaddleOCR / 本地文件后补全） */
export type ScreenshotRecord = {
  id: string;
  capturedAt: string;
  /** 本地保存路径或占位 */
  filePath?: string;
  ocrText?: string;
  ocrStatus?: 'ok' | 'no_text' | 'engine_unavailable' | 'ocr_error' | 'backend_unreachable' | 'unknown';
  ocrError?: string;
};

export type CreateReminderInput = {
  title: string;
  dueAt?: string;
  rawText?: string;
};

export type ScreenshotListFilter = {
  from?: string;
  to?: string;
};

export type ScreenshotCaptureStatus = {
  running: boolean;
  intervalMinutes?: number;
  lastCapturedAt?: string;
  windowStart?: string;
  windowEnd?: string;
  captureRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ScreenshotCaptureStartOptions = {
  intervalMinutes: number;
  /** HH:mm，例如 09:00 */
  windowStart?: string;
  /** HH:mm，例如 18:00 */
  windowEnd?: string;
  /**
   * 截图裁剪范围（可选）。
   * 坐标系基于 `desktopCapturer` 的缩略图尺寸（当前实现固定请求 1600x900）。
   * 例如要裁掉顶部标签/地址栏，可设置 y>0、height 更小。
   */
  captureRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type OcrEngineStatus = {
  available: boolean;
  engine: string;
  error?: string;
};
