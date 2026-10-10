/**
 * 记录统计 · 游玩数据的聚合（纯函数，冒烟直接测）。
 *
 * 数据源是本地的 `play_session`（游戏计时器每「结束」一次写一条），
 * 与「收藏统计」那套 `UListItem` 聚合无关，所以单独一个文件。
 *
 * 类型时长分布复用 `stats-logic` 里的 `GAME_TYPE_TAGS`（VNDB 全局固定的类型标签 id）。
 */

import type { PlaySession } from "@/lib/db/dao/play-session";

import { GAME_TYPE_TAGS } from "./stats-logic";

/* -------------------------------------------------------------------------- */
/* 游玩时长排名                                                                */
/* -------------------------------------------------------------------------- */

/** 单个作品的累计游玩时长 */
export interface VnPlaytimeBucket {
  vnId: string;
  ms: number;
}

/** 按作品累计游玩时长（降序） */
export function playtimeByVn(sessions: readonly PlaySession[]): VnPlaytimeBucket[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.vnId, (totals.get(session.vnId) ?? 0) + session.durationMs);
  }
  return [...totals.entries()]
    .map(([vnId, ms]) => ({ vnId, ms }))
    .sort((a, b) => b.ms - a.ms || a.vnId.localeCompare(b.vnId));
}

/* -------------------------------------------------------------------------- */
/* 游戏类型时长分布                                                            */
/* -------------------------------------------------------------------------- */

/** 某个游戏类型的累计游玩时长 */
export interface TypePlaytimeBucket {
  id: string;
  name: string;
  ms: number;
}

/**
 * 按游戏类型累计游玩时长（降序）。
 *
 * `typesByVn` 是「作品 → 类型标签 id 列表」的映射（由 `/vn` 的 `tags.id` 构建）。
 * 一个作品可能同时命中多个类型，所以各类型时长之和会**大于**总时长 ——
 * 与收藏统计的类型饼图同一语义（标签计数而非互斥划分）。
 */
export function playtimeByGameType(
  sessions: readonly PlaySession[],
  typesByVn: ReadonlyMap<string, readonly string[]>
): TypePlaytimeBucket[] {
  const nameOf = new Map(GAME_TYPE_TAGS.map((type) => [type.id, type.name]));
  const totals = new Map<string, number>();

  for (const session of sessions) {
    for (const typeId of typesByVn.get(session.vnId) ?? []) {
      if (!nameOf.has(typeId)) continue;
      totals.set(typeId, (totals.get(typeId) ?? 0) + session.durationMs);
    }
  }

  return [...totals.entries()]
    .map(([id, ms]) => ({ id, name: nameOf.get(id) ?? id, ms }))
    .sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------------------- */
/* 按月 / 按周聚合                                                             */
/* -------------------------------------------------------------------------- */

/** 一个月的游玩时长（`month` 为 0–11） */
export interface MonthlyPlayBucket {
  year: number;
  month: number;
  /** 该月累计时长（毫秒） */
  ms: number;
}

/**
 * 近 `months` 个月（含当月）的每月游玩时长，升序。
 *
 * 没有记录的月份也保留（值为 0），柱状图的时间轴才连续、不会跳过空月。
 */
export function monthlyPlayBuckets(
  sessions: readonly PlaySession[],
  months = 12,
  now = new Date()
): MonthlyPlayBucket[] {
  const buckets: MonthlyPlayBucket[] = [];
  const index = new Map<string, number>();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    index.set(`${date.getFullYear()}-${date.getMonth()}`, buckets.length);
    buckets.push({ year: date.getFullYear(), month: date.getMonth(), ms: 0 });
  }

  for (const session of sessions) {
    const date = new Date(session.startedAt);
    const at = index.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (at != null) buckets[at]!.ms += session.durationMs;
  }

  return buckets;
}

/** 一周的游玩时长与次数 */
export interface WeeklyPlayBucket {
  /** 该周起始（周一）的本地时间戳（unix 毫秒） */
  startAt: number;
  ms: number;
  count: number;
}

/** 某天所在周的周一 00:00（本地时区），返回 unix 毫秒 */
export function weekStartMs(date: Date): number {
  // getDay()：0=周日。转成 0=周一，回退到本周一
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset).getTime();
}

/**
 * 近 `weeks` 周（含本周，周一为一周起点）的游玩时长与次数，升序。
 *
 * 与 `play-records` 的「按月切周」不同：这里是**跨月的滚动窗口**，
 * 用来在统计页看长期的每周节奏。逐周按日历回退计算，避开夏令时导致的一小时漂移。
 */
export function recentWeekBuckets(
  sessions: readonly PlaySession[],
  weeks = 8,
  now = new Date()
): WeeklyPlayBucket[] {
  const base = new Date(weekStartMs(now));
  const buckets: WeeklyPlayBucket[] = [];
  const index = new Map<number, number>();

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset * 7);
    index.set(start.getTime(), buckets.length);
    buckets.push({ startAt: start.getTime(), ms: 0, count: 0 });
  }

  for (const session of sessions) {
    const at = index.get(weekStartMs(new Date(session.startedAt)));
    if (at != null) {
      buckets[at]!.ms += session.durationMs;
      buckets[at]!.count += 1;
    }
  }

  return buckets;
}
