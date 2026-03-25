/**
 * 大模型无法获知真实「今天」，需在每次请求中注入本机本地日期时间。
 */
export const buildLocalDateTimeSystemMessage = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const d = now.getDate();
  const isoLocal = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const zhDate = now.toLocaleDateString('zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hm = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return [
    '当前时刻以用户电脑的本地时区为准。用户询问「今天几号」「星期几」「现在几点」等时，必须严格使用下面数据回答，禁止凭训练数据猜测或编造日期。',
    `- 本地日期（建议用于回答）：${isoLocal}（即 ${y}年${mo}月${d}日）`,
    `- 本地日期（中文）：${zhDate}`,
    `- 本地时间：${hm}`,
  ].join('\n');
};
