/**
 * 过滤器编译器：把 UI 的筛选状态编译成 Kana 谓词。
 *
 * UI 层永远不接触裸谓词数组，只描述「我要筛什么」，由这里负责生成合法结构。
 * 这样做的原因正是为了隔离 Kana 的三个大坑：
 *
 *   1. **嵌套过滤器的值是谓词，不是标量**
 *      `["vn","=","v17"]` → 400。必须写成 `["vn","=",["id","=","v17"]]`
 *   2. **单个谓词不能直接当 filters**
 *      `["id","=","v17"]` → 400 `Invalid query`。必须包一层 `["and", ...]`
 *   3. **顶层字段名不能错**
 *      `/staff` 没有 `sex`（那是 `/character` 的字段）
 *
 * 另外 `vote` 只能用于 `sort`，不能过滤 —— `UListFilterState.voteRange`
 * 因此只能在前端取回后本地截断。
 */

import { type CharacterRole, type Language, type Length, type Platform } from "./enums";
import type { Predicate, SimplePredicate } from "./types";

/* -------------------------------------------------------------------------- */
/* 基础谓词构造                                                                */
/* -------------------------------------------------------------------------- */

/** 简单谓词 `[field, op, value]` */
export function pred(
  field: string,
  op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "~",
  value: unknown
): SimplePredicate {
  return [field, op, value] as const;
}

/** `and` 组合。0 个返回 undefined，1 个自动包一层，≥2 个显式 and */
export function and(...preds: (Predicate | undefined | false | null)[]): Predicate | undefined {
  const list = preds.filter((p): p is Predicate => Boolean(p));
  if (list.length === 0) return undefined;
  if (list.length === 1) return ["and", list[0] as Predicate] as const;
  return ["and", ...list] as const;
}

/** `or` 组合 */
export function or(...preds: (Predicate | undefined | false | null)[]): Predicate | undefined {
  const list = preds.filter((p): p is Predicate => Boolean(p));
  if (list.length === 0) return undefined;
  if (list.length === 1) return ["and", list[0] as Predicate] as const;
  return ["or", ...list] as const;
}

/** 多选字段 → 一组 `or` 谓词。空数组返回 undefined */
export function anyOf<T extends string | number>(
  field: string,
  values: readonly T[]
): Predicate | undefined {
  if (values.length === 0) return undefined;
  if (values.length === 1) return pred(field, "=", values[0]);
  return or(...values.map((v) => pred(field, "=", v)));
}

/* -------------------------------------------------------------------------- */
/* 嵌套过滤器（坑 1 的唯一出口）                                                */
/* -------------------------------------------------------------------------- */

/**
 * 生成嵌套过滤器谓词。
 *
 * Kana 的嵌套过滤器（`/vn` 的 `release`/`character`/`staff`/`developer`，
 * `/release` 的 `vn`/`producer`，`/character` 的 `vn`/`seiyuu`）的值
 * 必须是另一个谓词，外层运算符固定为 `=`。
 */
function nested(field: string, sub: Predicate): SimplePredicate {
  // 正确形状：[field, "=", <谓词>]，例如 ["vn", "=", ["id", "=", "v17"]]
  return [field, "=", sub] as unknown as SimplePredicate;
}

/** `/release` 的 `vn` 嵌套，如「属于某个 VN 的发行版」 */
export const byVn = (vnId: string): SimplePredicate => nested("vn", pred("id", "=", vnId));

/** `/release` 的 `vn` 嵌套，按发行时间 */
export const byVnReleased = (op: "=" | ">" | ">=" | "<" | "<=", value: string): SimplePredicate =>
  nested("vn", pred("released", op, value));

/** `/release` 的 `producer` 嵌套 */
export const byProducer = (producerId: string): SimplePredicate =>
  nested("producer", pred("id", "=", producerId));

/**
 * `/character` 的 `vn` 嵌套：**找出某个 VN 里都有哪些角色**。
 *
 * ⚠️ 反过来的需求（某个角色出演过哪些 VN）要用 `vnWithCharacter` ——
 * 两个字段名长得像，放到错的端点上就是 400（踩过）。
 * `/vn` 上根本没有 `vn` 过滤器。
 */
export const characterInVn = (vnId: string): SimplePredicate => nested("vn", pred("id", "=", vnId));

/** `/character` 的 `seiyuu` 嵌套（配 `role=seiyuu` 使用） */
export const withSeiyuu = (staffId: string): SimplePredicate =>
  nested("seiyuu", pred("id", "=", staffId));

/** `/quote` 的 `vn` / `character` 嵌套 */
export const quoteFromVn = (vnId: string): SimplePredicate => nested("vn", pred("id", "=", vnId));
export const quoteFromCharacter = (characterId: string): SimplePredicate =>
  nested("character", pred("id", "=", characterId));

/** `/vn` 的 `character` 嵌套 */
export const vnWithCharacter = (characterId: string): SimplePredicate =>
  nested("character", pred("id", "=", characterId));

/** `/vn` 的 `developer` 嵌套 */
export const vnWithDeveloper = (producerId: string): SimplePredicate =>
  nested("developer", pred("id", "=", producerId));

/* -------------------------------------------------------------------------- */
/* 标签                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `tag` / `dtag` 的值可以是纯 id，也可以是元组
 * `[tag_id, max_spoiler(0-2), min_tag_level(0-3)]`。
 * `dtag` 表示只看直接标签，不含父标签继承。
 */
export type TagTuple = [tagId: string, maxSpoiler: 0 | 1 | 2, minTagLevel: 0 | 1 | 2 | 3];

export const byTag = (
  tagId: string,
  opts: { spoiler?: 0 | 1 | 2; level?: 0 | 1 | 2 | 3; direct?: boolean } = {}
): SimplePredicate => {
  const field = opts.direct ? "dtag" : "tag";
  if (opts.spoiler === undefined && opts.level === undefined) return pred(field, "=", tagId);
  return pred(field, "=", [tagId, opts.spoiler ?? 2, opts.level ?? 0]);
};

/* -------------------------------------------------------------------------- */
/* UI 筛选状态                                                                 */
/* -------------------------------------------------------------------------- */

/** VN 搜索/筛选页的完整状态 */
export interface VnFilterState {
  /** 关键词，走 `search` 过滤器。注意必须包一层 and，见 `compile` */
  search?: string;
  tags?: string[];
  /** 只看直接标签 */
  directTagsOnly?: boolean;
  /** 原始语言 olang */
  olang?: Language[];
  /** 有该语言版本 */
  lang?: Language[];
  /** 有该平台版本 */
  platform?: Platform[];
  /** 评分区间（贝叶斯 10–100） */
  ratingRange?: [number, number];
  /** 发布年代区间 */
  releasedFrom?: string;
  releasedTo?: string;
  /** 时长 1–5 */
  length?: Length[];
  /** 开发状态 */
  devstatus?: number[];
  /** 至少有这个数值的评价数 */
  minVotecount?: number;
  /** 至少一个发行版满足 */
  releasePlatforms?: Platform[];
  /** 至少一个角色满足 */
  characterRole?: CharacterRole[];
  /** 有制作方 */
  developerIds?: string[];
  /** 只要有简介的作品 */
  hasDescription?: boolean;
  /** 只要有截图的作品 */
  hasScreenshot?: boolean;
  /** 只要有配音的作品 */
  hasVoiced?: boolean;
}

function dateBound(op: ">" | ">=" | "<" | "<=", value: string): SimplePredicate {
  return pred("released", op, value);
}

/** 把 VnFilterState 编译成一个谓词（内部已处理 and 包装）。空状态返回 undefined */
export function compileVnFilters(state: VnFilterState | undefined): Predicate | undefined {
  if (!state) return undefined;
  const parts: (Predicate | undefined)[] = [];

  if (state.search?.trim()) {
    // 坑 2：search 必须作为 "and" 的成员出现，不能单独当顶层 filters
    parts.push(pred("search", "=", state.search.trim()));
  }
  if (state.tags?.length) {
    // 多个 tag 之间是 AND（每个都得有）
    for (const tagId of state.tags) parts.push(byTag(tagId, { direct: state.directTagsOnly }));
  }
  parts.push(anyOf("olang", state.olang ?? []));
  parts.push(anyOf("lang", state.lang ?? []));
  parts.push(anyOf("platform", state.platform ?? []));

  if (state.ratingRange) {
    const [lo, hi] = state.ratingRange;
    if (lo > 0) parts.push(pred("rating", ">=", lo));
    if (hi > 0 && hi < 100) parts.push(pred("rating", "<=", hi));
  }
  if (state.releasedFrom) parts.push(dateBound(">=", state.releasedFrom));
  if (state.releasedTo) parts.push(dateBound("<=", state.releasedTo));
  if (state.length?.length) parts.push(anyOf("length", state.length));
  if (state.devstatus?.length) parts.push(anyOf("devstatus", state.devstatus));
  if (state.minVotecount) parts.push(pred("votecount", ">=", state.minVotecount));

  for (const platform of state.releasePlatforms ?? []) {
    parts.push(nested("release", pred("platform", "=", platform)));
  }
  for (const role of state.characterRole ?? []) {
    parts.push(nested("character", pred("role", "=", role)));
  }
  for (const producerId of state.developerIds ?? []) {
    parts.push(nested("developer", pred("id", "=", producerId)));
  }

  // `has_*` 类过滤器只接受 1，用 `!=` 取反
  if (state.hasDescription) parts.push(pred("has_description", "=", 1));
  if (state.hasScreenshot) parts.push(pred("has_screenshot", "=", 1));
  if (state.hasVoiced) parts.push(pred("has_voiced", "=", 1));

  return and(...parts);
}

/* -------------------------------------------------------------------------- */
/* 排序                                                                        */
/* -------------------------------------------------------------------------- */

/** `/vn` 可用排序值 */
export const VN_SORT_FIELDS = [
  "id",
  "title",
  "released",
  "rating",
  "votecount",
  "searchrank",
] as const;
export type VnSortField = (typeof VN_SORT_FIELDS)[number];

/** `/ulist` 可用排序值。注意不含 `rating`（那是 VN 的） */
export const ULIST_SORT_FIELDS = [
  "id",
  "title",
  "released",
  "rating",
  "votecount",
  "voted",
  "vote",
  "added",
  "lastmod",
  "started",
  "finished",
  "searchrank",
] as const;
export type UListSortField = (typeof ULIST_SORT_FIELDS)[number];

/**
 * `searchrank` 有个限制：只有当顶层过滤器是 `search` 时才允许用它排序。
 * 首页「热门」用不了它，所以走 `rating` / `votecount`。
 */
export function canUseSearchrank(filters: Predicate | Predicate[] | undefined): boolean {
  if (!filters) return false;
  const list =
    Array.isArray(filters) && !isPredicateTuple(filters) ? filters : [filters as Predicate];
  return list.some((f) => isSearchPredicate(f));
}

function isPredicateTuple(value: unknown): value is SimplePredicate {
  return (
    Array.isArray(value) &&
    typeof value[0] === "string" &&
    value.length === 3 &&
    typeof value[1] === "string"
  );
}

function isSearchPredicate(p: Predicate): boolean {
  if (Array.isArray(p) && p[0] === "and") {
    const members = (p as readonly ["and", ...Predicate[]]).slice(1) as Predicate[];
    return members.some(isSearchPredicate);
  }
  return isPredicateTuple(p) && p[0] === "search";
}

/* -------------------------------------------------------------------------- */
/* 清单筛选                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 本地截断用：`/ulist` 取回后按自己的打分过滤。
 * 之所以必须本地做，是因为 `vote` 只能用于 `sort`，当过滤器会报
 * `400 Invalid 'vote' filter: Unknown field`。
 */
export function filterByVote<T extends { vote?: number | null }>(
  items: T[],
  min: number,
  max = 100
): T[] {
  return items.filter((item) => item.vote != null && item.vote >= min && item.vote <= max);
}
