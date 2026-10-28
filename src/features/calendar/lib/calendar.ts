/**
 * 发售日历的纯逻辑（冒烟可直接测）。
 *
 * 只处理「月」这一层：翻月、算月份区间、把按月拉回来的作品按天分组。
 * VNDB 的 `released` 可能是 `2026-10-27` / `2026-10` / `2026` / `TBA`，
 * 日历只处理**精确到日**的条目（见 `groupByDay`）。
 */

/** 年月（month 是 1–12，不是 Date 的 0–11） */
export interface MonthRef {
  year: number;
  month: number;
}

/** 本地今天的年月 */
export function currentMonth(now: Date = new Date()): MonthRef {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** 翻月（delta 可正可负，跨年自动处理） */
export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const zeroBased = ref.year * 12 + (ref.month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** `2026-10`：queryKey 用 */
export function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, "0")}`;
}

/**
 * 日历能翻的年份范围。
 *
 * `CalendarList` 的月份列表按「初始月份 ± N 个月」生成，范围写死就不用在
 * 翻到边界时动态补月份。
 */
export const CALENDAR_MIN_YEAR = 1950;
export const CALENDAR_MAX_YEAR = 2100;

/** 把任意年月夹进日历范围（「跳转」输入 1200 年也不至于翻出界） */
export function clampMonth(ref: MonthRef): MonthRef {
  const min = CALENDAR_MIN_YEAR * 12;
  const max = CALENDAR_MAX_YEAR * 12 + 11;
  const raw = Math.max(min, Math.min(max, ref.year * 12 + (ref.month - 1)));
  return { year: Math.floor(raw / 12), month: (raw % 12) + 1 };
}

/** 从某个月往前到日历起点还有几个月（`CalendarList` 的 `pastScrollRange`） */
export function monthsBeforeMonth(ref: MonthRef): number {
  return (ref.year - CALENDAR_MIN_YEAR) * 12 + (ref.month - 1);
}

/** 从某个月往后到日历终点还有几个月（`CalendarList` 的 `futureScrollRange`） */
export function monthsAfterMonth(ref: MonthRef): number {
  return (CALENDAR_MAX_YEAR - ref.year) * 12 + (12 - ref.month);
}

/** 某月的首尾日期（`YYYY-MM-DD`，含首尾），Kana 的 `released` 过滤器用 */
export function monthRange(ref: MonthRef): { from: string; to: string } {
  const lastDay = new Date(ref.year, ref.month, 0).getDate();
  return {
    from: `${monthKey(ref)}-01`,
    to: `${monthKey(ref)}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** 日历里的一天 */
export interface DayGroup<T> {
  /** `YYYY-MM-DD` */
  day: string;
  items: T[];
}

/** 某月的天数 */
export function daysInMonth(ref: MonthRef): number {
  return new Date(ref.year, ref.month, 0).getDate();
}

/**
 * 按发售日分组（保持传入顺序）。
 *
 * 只收精确到日的条目：`2026-10`（整月）与 `TBA` 没有具体哪天，
 * 放进日历会把它们全堆在某一天上，不如不显示。
 */
export function groupByDay<T extends { released?: string | null }>(
  items: readonly T[]
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const day = item.released ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
