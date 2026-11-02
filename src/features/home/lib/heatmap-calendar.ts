import { localDayKey } from "./play-summary";

/** 周日到周六纵向排列，年界外的格子留空；日期按日历递增以兼容夏令时。 */
export function contributionWeeks(year: number) {
  const offset = new Date(year, 0, 1).getDay();
  const total = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  return Array.from({ length: Math.ceil((offset + total) / 7) }, (_, week) => {
    let month: number | null = null;
    const days = Array.from({ length: 7 }, (_day, weekday) => {
      const day = week * 7 + weekday - offset + 1;
      if (day < 1 || day > total) return null;
      const date = new Date(year, 0, day);
      if (date.getDate() === 1) month = date.getMonth();
      return localDayKey(date);
    });
    return { key: `${year}-${week}`, days, month };
  });
}
