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
