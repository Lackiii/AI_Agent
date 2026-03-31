/**
 * 判断区间内是否包含「长假」片段，用于启动问候逻辑（国庆固定；春节按国务院安排逐年维护）。
 * 仅覆盖常见春节与国庆，未覆盖清明/五一调休等；可按年份扩展 SPRING_FESTIVAL_RANGES。
 */

export type IsoDateRange = { start: string; end: string };

/** 春节：农历新年法定假日前后大致区间（YYYY-MM-DD，含端点） */
const SPRING_FESTIVAL_RANGES: IsoDateRange[] = [
  { start: '2025-01-28', end: '2025-02-04' },
  { start: '2026-02-15', end: '2026-02-23' },
  { start: '2027-02-06', end: '2027-02-12' },
  { start: '2028-01-24', end: '2028-01-30' },
];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 本地日期 → YYYY-MM-DD */
export const toLocalYmd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const ymdToUtcNoon = (ymd: string): number => {
  const [y, m, day] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, day, 12, 0, 0);
};

/** a、b 为 YYYY-MM-DD，返回 b - a 的日历天数差 */
export const diffCalendarDays = (aYmd: string, bYmd: string): number => {
  const ms = ymdToUtcNoon(bYmd) - ymdToUtcNoon(aYmd);
  return Math.round(ms / 86400000);
};

const nationalDayRange = (year: number): IsoDateRange => ({
  start: `${year}-10-01`,
  end: `${year}-10-07`,
});

const enumerateYmdInRange = (startYmd: string, endYmd: string): string[] => {
  const out: string[] = [];
  let t = ymdToUtcNoon(startYmd);
  const end = ymdToUtcNoon(endYmd);
  while (t <= end) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
    t += 86400000;
  }
  return out;
};

/**
 * 在开区间 (lastYmd, todayYmd) 内是否存在任意一天落在长假期内。
 * lastYmd / todayYmd 为本地日历 YYYY-MM-DD。
 */
export const longHolidayStrictlyBetween = (lastYmd: string, todayYmd: string): boolean => {
  if (lastYmd >= todayYmd) {
    return false;
  }
  const allDays = new Set<string>();
  for (const r of SPRING_FESTIVAL_RANGES) {
    for (const d of enumerateYmdInRange(r.start, r.end)) {
      allDays.add(d);
    }
  }
  const yStart = Number(lastYmd.slice(0, 4));
  const yEnd = Number(todayYmd.slice(0, 4));
  for (let y = yStart; y <= yEnd + 1; y += 1) {
    const nd = nationalDayRange(y);
    for (const d of enumerateYmdInRange(nd.start, nd.end)) {
      allDays.add(d);
    }
  }
  for (const d of allDays) {
    if (d > lastYmd && d < todayYmd) {
      return true;
    }
  }
  return false;
};
