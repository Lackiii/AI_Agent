export {};

declare global {
  interface Window {
    deepseekApi: {
      chat: (prompt: string) => Promise<string>;
    };
  }
}
