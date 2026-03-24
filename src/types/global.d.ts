import type { CreateReminderInput, Reminder, ScreenshotListFilter, ScreenshotRecord } from '../shared/types/domain';
import type { GreetingSettingsDTO } from '../shared/types/greeting';
import type { ChatMessage } from '../shared/types/llm';
import type { VaultReadResult } from '../shared/types/vault';

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
        remove: (messageId: string) => Promise<boolean>;
      };
      navigation: {
        onAppNavigate: (callback: (path: string) => void) => () => void;
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
        sendTestNotification: () => Promise<{ ok: true } | { ok: false; error: string }>;
      };
      vault: {
        list: () => Promise<string[]>;
        read: (relativePath: string) => Promise<VaultReadResult>;
      };
    };
    /** @deprecated 请使用 assistantApi.llm.chat */
    deepseekApi: {
      chat: (prompt: string) => Promise<string>;
    };
  }
}
