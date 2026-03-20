import { Notification } from 'electron';
import WebSocket from 'ws';

const getBackendBaseUrl = (): string => {
  return process.env.BACKEND_BASE_URL?.trim() || 'http://127.0.0.1:8000';
};

const toWsUrl = (httpUrl: string): string => {
  if (httpUrl.startsWith('https://')) return httpUrl.replace(/^https:\/\//, 'wss://');
  if (httpUrl.startsWith('http://')) return httpUrl.replace(/^http:\/\//, 'ws://');
  return httpUrl;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const connectBackendReminderNotifications = (): void => {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
  const wsUrl = `${toWsUrl(baseUrl)}/ws`;

  let socket: WebSocket | null = null;
  let attempt = 0;

  const connect = async (): Promise<void> => {
    attempt += 1;
    try {
      socket = new WebSocket(wsUrl);

      socket.on('open', () => {
        attempt = 0;
        // eslint-disable-next-line no-console
        console.log('[backend-ws] connected:', wsUrl);
      });

      socket.on('message', (data) => {
        try {
          const text = data.toString('utf8');
          const msg = JSON.parse(text) as { type?: string; reminder?: any };
          if (msg.type !== 'reminder_fired') return;

          const reminder = msg.reminder || {};
          const title = reminder.title ? String(reminder.title) : '提醒';
          const dueAt = reminder.dueAt ? String(reminder.dueAt) : '';
          const body = dueAt ? `到点啦：${dueAt}` : '到点啦！';

          new Notification({ title, body }).show();
        } catch {
          // ignore
        }
      });

      socket.on('close', () => {
        // reconnect with backoff
        void (async () => {
          const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
          await sleep(delay);
          void connect();
        })();
      });
      socket.on('error', () => {
        // Let 'close' handle reconnect
        try {
          socket?.close();
        } catch {
          // ignore
        }
      });
    } catch {
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      await sleep(delay);
      void connect();
    }
  };

  void connect();
};

