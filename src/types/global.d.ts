import type { CreateReminderInput, Reminder, ScreenshotListFilter, ScreenshotRecord } from '../shared/types/domain';
import type { GreetingSettingsDTO } from '../shared/types/greeting';
import type { ChatMessage } from '../shared/types/llm';

export {};

declare global {
  interface Window {
    assistantApi: {
      llm: {
        chat: (prompt: string) => Promise<string>;
      };
      memory: {
        clear: () => Promise<boolean>;
        list: () => Promise<ChatMessage[]>;
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
      greeting: {
        getSettings: () => Promise<GreetingSettingsDTO>;
        setSettings: (patch: Partial<GreetingSettingsDTO>) => Promise<GreetingSettingsDTO>;
      };
    };
    /** @deprecated 请使用 assistantApi.llm.chat */
    deepseekApi: {
      chat: (prompt: string) => Promise<string>;
    };
  }
}
