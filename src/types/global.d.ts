import type { CreateReminderInput, Reminder, ScreenshotListFilter, ScreenshotRecord } from '../shared/types/domain';

export {};

declare global {
  interface Window {
    assistantApi: {
      llm: {
        chat: (prompt: string) => Promise<string>;
      };
      memory: {
        clear: () => Promise<boolean>;
      };
      persona: {
        reset: () => Promise<boolean>;
      };
      reminders: {
        list: () => Promise<Reminder[]>;
        create: (input: CreateReminderInput) => Promise<Reminder>;
        remove: (id: string) => Promise<boolean>;
      };
      screenshots: {
        list: (filter?: ScreenshotListFilter) => Promise<ScreenshotRecord[]>;
      };
    };
    /** @deprecated 请使用 assistantApi.llm.chat */
    deepseekApi: {
      chat: (prompt: string) => Promise<string>;
    };
  }
}
