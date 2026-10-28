/**
 * 清单分析的纯逻辑（冒烟可直接测）。
 *
 * 数据源是「我的清单」（`/ulist`，字段见 `ULIST_STATS_FIELDS`）——
 * 与收藏统计同源，但这页回答的是另外几个问题：
 *
 *   - 我处于各状态的作品各有多少？（在玩 / 已通关 / 搁置 / 抛弃 / 想玩 / 黑名单）
 *   - 我的打分分布长什么样？
 *   - 还有多少没玩、大概要多少小时？
 *   - 我比社区平均分更宽容还是更严格？
 *
 * ⚠️ 时长是**估算**：VNDB 的 `vn.length` 只有 1–5 档（<2h / 2–10h / 10–30h /
 * 30–50h / >50h），这里取每档的中位数。不要把它当成精确值展示。
 */

import { BUILTIN_LABEL, BUILTIN_LABEL_NAME } from "@/lib/api/enums";
import type { UListItem } from "@/lib/api/types";

/** 状态分布的一行 */
export interface StatusBucket {
  /** 内置标签 id（1–6） */
  id: number;
  /** 英文名（与 vndb.org 一致，不做翻译） */
  name: string;
  count: number;
}

/** 内置状态标签的顺序（与官网清单页一致） */
const STATUS_ORDER = [
  BUILTIN_LABEL.PLAYING,
  BUILTIN_LABEL.FINISHED,
  BUILTIN_LABEL.STALLED,
  BUILTIN_LABEL.DROPPED,
  BUILTIN_LABEL.PLANNED,
  BUILTIN_LABEL.BLACKLIST,
] as const;

/**
 * 状态分布：六个内置状态各有多少部。
 *
 * 一个条目只会属于一个状态（VNDB 保证互斥），所以这里是**互斥**计数，
 * 与收藏统计里「标签计数」的语义不同。
 */
export function statusBuckets(items: readonly UListItem[]): StatusBucket[] {
  const counts = new Map<number, number>();
  for (const item of items) {
    for (const label of item.labels ?? []) {
      if (!STATUS_ORDER.includes(label.id as (typeof STATUS_ORDER)[number])) continue;
      counts.set(label.id, (counts.get(label.id) ?? 0) + 1);
      break; // 理论上只有一个状态；脏数据也只算第一个
    }
  }
  return STATUS_ORDER.map((id) => ({
    id,
    name: BUILTIN_LABEL_NAME[id] ?? String(id),
    count: counts.get(id) ?? 0,
  }));
}

/** 评分分布：1–10 分各有多少部（0 不算，未打分不算） */
export interface VoteBucket {
  score: number;
  count: number;
}

export function voteBuckets(items: readonly UListItem[]): VoteBucket[] {
  const buckets: VoteBucket[] = Array.from({ length: 10 }, (_, index) => ({
    score: index + 1,
    count: 0,
  }));

  for (const item of items) {
    if (item.vote == null) continue;
    // VNDB 的 vote 是 10–100，按 10 分制取整档
    const bucket = Math.min(10, Math.max(1, Math.round(item.vote / 10)));
    const target = buckets[bucket - 1];
    if (target) target.count += 1;
  }

  return buckets;
}

/**
 * 每档时长的中位数（小时）。
 *
 * VNDB 的说明：1 = <2h，2 = 2–10h，3 = 10–30h，4 = 30–50h，5 = >50h。
 * 最后一档没有上界，取 60 小时兜底。
 */
const LENGTH_HOURS: Record<number, number> = { 1: 1, 2: 6, 3: 20, 4: 40, 5: 60 };
/** 没填时长时按中篇估（3 档） */
const DEFAULT_LENGTH = 3;

/** 待玩清单的规模与预计时长 */
export interface BacklogSummary {
  /** 还没通关、也没抛弃的作品数 */
  count: number;
  /** 预计总时长（小时，四舍五入） */
  hours: number;
  /** 其中填了时长的条数（用来提示估算的覆盖率） */
  known: number;
}

/**
 * 待玩 backlog：**没通关、也没抛弃 / 拉黑**的都算（在玩 / 搁置 / 想玩 / 无状态）。
 *
 * 为什么不算已抛弃与黑名单：那两类用户已经不打算玩了，算进 backlog 只会虚高。
 */
export function backlogSummary(items: readonly UListItem[]): BacklogSummary {
  let count = 0;
  let hours = 0;
  let known = 0;

  for (const item of items) {
    const labels = (item.labels ?? []).map((label) => label.id);
    if (
      labels.includes(BUILTIN_LABEL.FINISHED) ||
      labels.includes(BUILTIN_LABEL.DROPPED) ||
      labels.includes(BUILTIN_LABEL.BLACKLIST)
    ) {
      continue;
    }
    count += 1;
    if (item.vn?.length != null) known += 1;
    hours += LENGTH_HOURS[item.vn?.length ?? DEFAULT_LENGTH] ?? LENGTH_HOURS[DEFAULT_LENGTH]!;
  }

  return { count, hours: Math.round(hours), known };
}

/** 我的评分 vs 社区平均分 */
export interface VoteComparison {
  /** 两边都有分的条目数 */
  count: number;
  /** 我的平均分（10 分制，保留一位小数） */
  mine: number | null;
  /** 社区平均分（同样换算成 10 分制） */
  community: number | null;
  /** 我的 − 社区（正数 = 我更宽容） */
  delta: number | null;
}

/**
 * 我的评分 vs 社区评分。
 *
 * 只比较**两边都有分**的条目 —— 拿我的 8 分去比一部没人打分的作品的 0 分会失真。
 * Kana 里 `vote` 是 10–100、`vn.rating` 是 0–100，这里统一换成 10 分制。
 */
export function voteComparison(items: readonly UListItem[]): VoteComparison {
  let count = 0;
  let mineTotal = 0;
  let communityTotal = 0;

  for (const item of items) {
    if (item.vote == null || item.vn?.rating == null) continue;
    count += 1;
    mineTotal += item.vote / 10;
    communityTotal += item.vn.rating / 10;
  }

  if (count === 0) return { count: 0, mine: null, community: null, delta: null };

  const mine = mineTotal / count;
  const community = communityTotal / count;
  return {
    count,
    mine: round1(mine),
    community: round1(community),
    delta: round1(mine - community),
  };
}

/** 完成率：已通关 /（总数 − 黑名单） */
export interface CompletionSummary {
  total: number;
  finished: number;
  /** 0–1；分母为 0 时是 0 */
  rate: number;
}

export function completionSummary(items: readonly UListItem[]): CompletionSummary {
  let finished = 0;
  let blacklist = 0;

  for (const item of items) {
    const labels = (item.labels ?? []).map((label) => label.id);
    if (labels.includes(BUILTIN_LABEL.FINISHED)) finished += 1;
    if (labels.includes(BUILTIN_LABEL.BLACKLIST)) blacklist += 1;
  }

  const denominator = items.length - blacklist;
  return {
    total: items.length,
    finished,
    rate: denominator > 0 ? finished / denominator : 0,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
