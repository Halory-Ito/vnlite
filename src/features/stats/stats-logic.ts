/**
 * 收藏统计的纯逻辑：把「我的清单」聚合成图表数据。
 *
 * 全是纯函数（`bun run smoke:db` 直接测）：不碰网络、不碰 React。
 * 数据源是 `/ulist` 的一行行条目，字段集见 `lib/api/fields.ts#ULIST_STATS_FIELDS`。
 */

import { BUILTIN_LABEL } from "@/lib/api/enums";
import type { UListItem, UListLabel } from "@/lib/api/types";
import { releasedYear } from "@/utils/format";

/** 年代分布的一块饼（十年一档） */
export interface DecadeBucket {
  /** 起始年（如 1990） */
  start: number;
  /** 展示文案（如 `1990-1999`） */
  label: string;
  count: number;
}

/** 清单标签分布的一块饼 */
export interface LabelBucket {
  id: number;
  name: string;
  count: number;
}

/** 游戏类型分布的一块饼（VNDB 的类型标签 id 是 `g` 开头） */
export interface TypeBucket {
  id: string;
  name: string;
  count: number;
}

/** 厂商分布的一条横条 */
export interface DeveloperBucket {
  id: string;
  name: string;
  count: number;
}

/** 概览数字 */
export interface CollectionSummary {
  total: number;
  /** 打过分的条数 */
  voted: number;
  /** 标了「已完成」的条数 */
  finished: number;
  /** 我的平均分（10–100），没打过分时 null */
  averageVote: number | null;
}

/** 虚拟标签：0 = No label、7 = Voted，两者都不进「标签分布」 */
const VIRTUAL_LABELS = new Set<number>([BUILTIN_LABEL.NO_LABEL, BUILTIN_LABEL.VOTED]);

/**
 * 按发售**年代**分布（十年一档，如 `1990-1999`）。
 *
 * 逐年的柱状图在收藏上其实很难读：横跨三十年时一根柱子只有几像素，
 * 而且大多数年份是空的。十年一档既能看出「哪个年代的作品多」，饼图也放得下。
 * 只保留有数据的年代，升序 —— 图表从左到右就是时间线。
 */
export function byReleaseDecade(items: readonly UListItem[]): DecadeBucket[] {
  const counts = new Map<number, number>();
  for (const item of items) {
    const year = releasedYear(item.vn?.released);
    if (year == null) continue;
    const start = Math.floor(year / 10) * 10;
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([start, count]) => ({ start, label: `${start}-${start + 9}`, count }))
    .sort((a, b) => a.start - b.start);
}

/**
 * 「游戏类型」标签清单（ADV / NVL / RPG …）。
 *
 * VNDB 没有独立的 genre 字段 —— 类型是 **Technical 类里的顶层标签**。
 * 这里用一份固定清单：id 是 VNDB 全局固定的，2026-09-30 用 `GET /tag` 核过
 * （`scripts/smoke-api.ts` 有对照检查，名字对不上会红）。
 *
 * ⚠️ 一个作品可能同时命中多个类型（ADV + RPG），所以类型饼图是
 * 「标签计数」而不是互斥划分 —— 和清单标签饼图是同一个语义。
 */
export const GAME_TYPE_TAGS: readonly { id: string; name: string }[] = [
  { id: "g32", name: "ADV" },
  { id: "g43", name: "NVL" },
  { id: "g709", name: "Kinetic Novel" },
  { id: "g31", name: "Action Game" },
  { id: "g35", name: "RPG" },
  { id: "g34", name: "Simulation Game" },
  { id: "g33", name: "Strategy Game" },
  { id: "g37", name: "Fighting Game" },
];

/** 按游戏类型分布：只看固定清单里的类型标签，计数降序 */
export function byGameType(items: readonly UListItem[]): TypeBucket[] {
  const nameOf = new Map(GAME_TYPE_TAGS.map((type) => [type.id, type.name]));
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.vn?.tags ?? []) {
      if (!nameOf.has(tag.id)) continue;
      counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: nameOf.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);
}

/** 按清单标签分布（Playing / Finished / 自建标签…），计数降序 */
export function byListLabel(
  items: readonly UListItem[],
  labels: readonly UListLabel[]
): LabelBucket[] {
  const nameOf = new Map(labels.map((label) => [label.id, label.label]));
  const counts = new Map<number, number>();

  for (const item of items) {
    for (const label of item.labels ?? []) {
      if (VIRTUAL_LABELS.has(label.id)) continue;
      counts.set(label.id, (counts.get(label.id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: nameOf.get(id) ?? `Label ${id}`, count }))
    .sort((a, b) => b.count - a.count);
}

/** 厂商 Top N：一个作品可能有多家厂商，各自 +1 */
export function topDevelopers(items: readonly UListItem[], limit = 8): DeveloperBucket[] {
  const counts = new Map<string, DeveloperBucket>();

  for (const item of items) {
    for (const developer of item.vn?.developers ?? []) {
      const current = counts.get(developer.id);
      if (current) current.count += 1;
      else counts.set(developer.id, { id: developer.id, name: developer.name, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** 概览数字：总数 / 打分数 / 已通关数 / 我的均分 */
export function summarizeCollection(items: readonly UListItem[]): CollectionSummary {
  const votes: number[] = [];
  let finished = 0;

  for (const item of items) {
    if (item.vote != null) votes.push(item.vote);
    if ((item.labels ?? []).some((label) => label.id === BUILTIN_LABEL.FINISHED)) finished += 1;
  }

  return {
    total: items.length,
    voted: votes.length,
    finished,
    averageVote: votes.length > 0 ? votes.reduce((sum, v) => sum + v, 0) / votes.length : null,
  };
}
