/**
 * 同一次用户发送中，notification_show 需在 appendExchange 之前写入记忆。
 */
export type PendingNotificationMemory = { title?: string; body: string };

const pending: PendingNotificationMemory[] = [];

export const queueNotificationMemory = (item: PendingNotificationMemory): void => {
  const body = item.body.trim().slice(0, 280);
  if (!body) return;
  pending.push({
    body,
    title: item.title?.trim().slice(0, 64) || undefined,
  });
};

export const takePendingNotifications = (): PendingNotificationMemory[] => {
  if (pending.length === 0) return [];
  const out = [...pending];
  pending.length = 0;
  return out;
};
