/**
 * 排序选项。
 *
 * 拆成两套（借鉴 vndb-lite 的 `LOCAL_SORTABLE_DATA` / `REMOTE_SORTABLE_DATA`），
 * 因为两边可用的字段根本不同：
 *
 *   远程（`/vn`）  有 searchrank（搜索相关度），但没有 started / added
 *   本地（`/ulist`）有 started / added / length_minutes / vote，但没有 searchrank
 *
 * 之前我们把两者混在一起，导致搜索页和清单页都能选到对方不支持的字段。
 */

import type { VnQueryOptions } from "@/lib/api/endpoints/vn";
import type { UListQueryOptions } from "@/lib/api/endpoints/ulist";

export interface SortOption<T extends string> {
  value: T;
  label: string;
  /** true = 默认降序 */
  reverse: boolean;
  /** 该字段在本地（离线）排序里是否可用 */
  local: boolean;
  /** 该字段在远程 API 排序里是否可用 */
  remote: boolean;
}

/**
 * 远程（`/vn`）排序。
 *
 * `searchrank` 显示成「相关度」而不是英文原名。
 * 顺带说明：它**只有**在顶层过滤器是 `search` 时才允许排序，
 * 所以它只能出现在搜索页，不能作为浏览页的通用排序。
 *
 * ⚠️ 不含 `title`：标题是 VNDB 的译名，同一作品常有多个别名，
 * 按字面排序既不直观也基本没有意义（反馈：移除「标题」列）。
 */
export const VN_SORT_OPTIONS: SortOption<NonNullable<VnQueryOptions["sort"]>>[] = [
  { value: "released", label: "发行日期", reverse: true, local: true, remote: true },
  { value: "rating", label: "评分", reverse: true, local: true, remote: true },
  { value: "votecount", label: "人气", reverse: true, local: true, remote: true },
  { value: "searchrank", label: "相关度", reverse: false, local: false, remote: true },
];

/**
 * 本地清单排序。
 *
 * 比远程多出「加入时间」「打分时间」「开始游玩」「完成日期」「我的打分」，
 * 这些是 `/ulist` 独有的字段。同样不含 `title`。
 */
export const ULIST_SORT_OPTIONS: SortOption<NonNullable<UListQueryOptions["sort"]>>[] = [
  { value: "added", label: "加入时间", reverse: true, local: true, remote: true },
  { value: "voted", label: "打分时间", reverse: true, local: true, remote: true },
  { value: "vote", label: "我的打分", reverse: true, local: true, remote: true },
  { value: "started", label: "开始游玩", reverse: true, local: true, remote: true },
  { value: "finished", label: "完成日期", reverse: true, local: true, remote: true },
  { value: "released", label: "发行日期", reverse: true, local: true, remote: true },
  { value: "rating", label: "评分", reverse: true, local: true, remote: true },
];

/** 浏览页可用的排序（排除只能用于搜索的 searchrank） */
export const BROWSE_SORT_OPTIONS = VN_SORT_OPTIONS.filter((o) => o.value !== "searchrank");

export function findSort<T extends string>(
  options: SortOption<T>[],
  value: T | undefined,
  fallback: SortOption<T>
): SortOption<T> {
  return options.find((o) => o.value === value) ?? fallback;
}
