/**
 * 用户用自然语言结束工作、道别时，关闭定时问候（不依赖模型是否调用工具）。
 */
export const shouldDisableTimedGreeting = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;

  const explicitOff =
    /不用.+提醒|别.+叫我|不要.+叫我|关掉.+问候|关闭.+定时|暂停.+问候|先别.+烦我|取消.+问候|停止.+问候/i;
  if (explicitOff.test(t)) return true;

  const offWork = /下班|收工|先走|不写了|今天先到|今天先这样|收摊|关机|休息去|不加班|收工啦/i;
  const bye = /明天见|晚安|拜拜|再见|回见|bye|see\s*you/i;

  if (bye.test(t) && offWork.test(t)) return true;

  return false;
};
