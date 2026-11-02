import type { PlaySession } from "@/lib/db/dao/play-session";
import type { UListItem } from "@/lib/api/types";

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 与现有记录统计一致：会话归属开始日期，时长不含暂停。 */
export function dailyPlaySummary(sessions: readonly PlaySession[]) {
  const days = new Map<string, { ms: number; count: number; games: Set<string> }>();
  for (const session of sessions) {
    if (!Number.isFinite(session.startedAt) || session.durationMs <= 0) continue;
    const key = localDayKey(new Date(session.startedAt));
    const day = days.get(key) ?? { ms: 0, count: 0, games: new Set<string>() };
    day.ms += session.durationMs;
    day.count += 1;
    day.games.add(session.vnId);
    days.set(key, day);
  }
  return days;
}

export function yearlyFinished(items: readonly UListItem[], year: number): number {
  return new Set(
    items
      .filter(
        (item) =>
          item.finished?.startsWith(`${year}-`) && item.labels?.some((label) => label.id === 2)
      )
      .map((item) => item.id)
  ).size;
}

export function heatLevel(ms: number): number {
  return ms <= 0 ? 0 : ms < 1800000 ? 1 : ms < 3600000 ? 2 : ms < 7200000 ? 3 : 4;
}
