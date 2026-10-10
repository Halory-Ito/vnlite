/**
 * 浏览页的排序选项。
 *
 * 字段直接对应 VNDB `/vn` 支持的远程排序，但只放**浏览页用得上的四个**：
 *
 *   - `votecount` 人气（默认：评价人数降序）
 *   - `rating`    评分
 *   - `released`  发行日期
 *   - `id`        ID 顺序（越新的条目 ID 越大）
 *
 * 两个刻意排除的：
 *   - `title`：VNDB 的标题是译名，同一作品常有多个别名，按字面排序没意义（反馈过）
 *   - `searchrank`：只有顶层过滤器是 `search` 时才允许排序，只在搜索页有意义
 *
 * 方向由用户在排序面板里选，`reverse` 是**该字段的默认方向**（true = 高 / 新在前）。
 */

import type { TranslationKey } from "@/lib/i18n/translate";
import type { BrowseSortField } from "@/lib/storage/preferences";

export interface SortOption {
  value: BrowseSortField;
  /** 字段名翻译键（模块级不存文案，面板渲染时 `t(key)`） */
  labelKey: TranslationKey;
  /** 该字段的默认方向：true = 降序（高 / 新在前） */
  reverse: boolean;
}

/** 浏览页可选排序字段（数组顺序 = 面板里的展示顺序） */
export const BROWSE_SORT_OPTIONS: readonly SortOption[] = [
  { value: "votecount", labelKey: "browse.sort.option.votecount", reverse: true },
  { value: "rating", labelKey: "browse.sort.option.rating", reverse: true },
  { value: "released", labelKey: "browse.sort.option.released", reverse: true },
  { value: "id", labelKey: "browse.sort.option.id", reverse: true },
];

/** 默认排序：人气降序（Master 定） */
export const DEFAULT_BROWSE_SORT: SortOption = BROWSE_SORT_OPTIONS[0]!;

/** 按 value 找选项，找不到给默认 */
export function findSortOption(value: BrowseSortField): SortOption {
  return BROWSE_SORT_OPTIONS.find((option) => option.value === value) ?? DEFAULT_BROWSE_SORT;
}
