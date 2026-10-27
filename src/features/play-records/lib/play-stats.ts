/**
 * 游玩记录的统计聚合（纯函数，冒烟直接测）。
 */

import type { PlaySession } from "@/lib/db/dao/play-session";

export interface PlayStats {
  /** 累计时长（毫秒，不含暂停） */
  totalMs: number;
  /** 会话次数 */
  count: number;
  /** 平均每次时长（毫秒） */
  averageMs: number;
  /** 最长一次时长（毫秒） */
  longestMs: number;
  /** 最近一次开始时间（unix 毫秒），无记录为 null */
  lastPlayedAt: number | null;
}

export function summarizeSessions(sessions: readonly PlaySession[]): PlayStats {
  if (sessions.length === 0) {
    return { totalMs: 0, count: 0, averageMs: 0, longestMs: 0, lastPlayedAt: null };
  }
  let totalMs = 0;
  let longestMs = 0;
  let lastPlayedAt = 0;
  for (const session of sessions) {
    totalMs += session.durationMs;
    if (session.durationMs > longestMs) longestMs = session.durationMs;
    if (session.startedAt > lastPlayedAt) lastPlayedAt = session.startedAt;
  }
  return {
    totalMs,
    count: sessions.length,
    averageMs: Math.round(totalMs / sessions.length),
    longestMs,
    lastPlayedAt,
  };
}

export interface WeeklyBucket {
  /** 唯一 key（年-月-周序号） */
  key: string;
  /** 周序号（0 起） */
  index: number;
  /** 日期范围 `1-7` / `29-31` */
  range: string;
  /** 该周累计时长（毫秒） */
  ms: number;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 该月的天数（1–31） */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * 某月的周次划分：从 1 号起每 7 天一档，最后一档收到月末。
 *
 * 按实际月长切，所以 28 天的月份只有 4 周、31 天有 5 周（不会出现空的第 5 周）。
 */
export function weeksOfMonth(year: number, monthIndex: number): { start: number; end: number }[] {
  const total = daysInMonth(year, monthIndex);
  const weeks: { start: number; end: number }[] = [];
  for (let start = 1; start <= total; start += 7) {
    weeks.push({ start, end: Math.min(start + 6, total) });
  }
  return weeks;
}

/** 会话是否落在指定年月（本地时区） */
function inMonth(session: PlaySession, year: number, monthIndex: number): boolean {
  const date = new Date(session.startedAt);
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}

/** 某个月按周次聚合的时长（升序，周数随月长变化） */
export function weeklyBuckets(
  sessions: readonly PlaySession[],
  year: number,
  monthIndex: number
): WeeklyBucket[] {
  const weeks = weeksOfMonth(year, monthIndex);
  const buckets: WeeklyBucket[] = weeks.map((week, index) => ({
    key: `${year}-${pad2(monthIndex + 1)}-W${index + 1}`,
    index,
    range: `${week.start}-${week.end}`,
    ms: 0,
  }));

  for (const session of sessions) {
    if (!inMonth(session, year, monthIndex)) continue;
    const day = new Date(session.startedAt).getDate();
    const index = weeks.findIndex((week) => day >= week.start && day <= week.end);
    if (index >= 0) buckets[index]!.ms += session.durationMs;
  }

  return buckets;
}

/** 某月的总时长（毫秒，本地时区） */
export function monthTotalMs(
  sessions: readonly PlaySession[],
  year: number,
  monthIndex: number
): number {
  let total = 0;
  for (const session of sessions) {
    if (inMonth(session, year, monthIndex)) total += session.durationMs;
  }
  return total;
}

/** 某月的游玩次数 */
export function monthSessionCount(
  sessions: readonly PlaySession[],
  year: number,
  monthIndex: number
): number {
  let count = 0;
  for (const session of sessions) {
    if (inMonth(session, year, monthIndex)) count += 1;
  }
  return count;
}

/** 当前年月（`month` 为 0–11）。给图表做默认选中月 */
export function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/**
 * 「今天」落在该月第几周（0 起）。
 *
 * 选中的不是当前月、或今天不在该月时返回 -1（不高亮任何一根柱）。
 */
export function currentWeekIndex(year: number, monthIndex: number, now = new Date()): number {
  if (now.getFullYear() !== year || now.getMonth() !== monthIndex) return -1;
  const weeks = weeksOfMonth(year, monthIndex);
  return weeks.findIndex((week) => now.getDate() >= week.start && now.getDate() <= week.end);
}
