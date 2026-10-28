/**
 * 全站作品数最多的**内容大标签**（`category === "cont"`）。
 *
 * 「浏览」的题材筛选和「排行榜」的题材列表用的是同一份候选清单 ——
 * `tech` 是 ADV / NVL 这种玩法分类，`ero` 不适合当「题材」摆在一排里，
 * 所以只留内容标签，再按作品数取前 24。
 *
 * 放在全局 hooks 不在某个 feature 里，是因为两个模块都引用它：
 * 查询 key 也归到 `queryKeys.tag.top`（一份缓存两处共享）。
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { queryTags } from "@/lib/api/endpoints/catalog";
import type { Tag } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

/** 候选数量上限（全站作品数排序后的前 24 个内容标签） */
const POOL_SIZE = 24;

export function usePopularTags(): UseQueryResult<Tag[]> {
  return useQuery({
    queryKey: queryKeys.tag.top(),
    queryFn: ({ signal }) => queryTags({ sort: "vn_count", reverse: true, results: 60, signal }),
    select: (data) => data.results.filter((tag) => tag.category === "cont").slice(0, POOL_SIZE),
    staleTime: STALE_TIME.catalog,
  });
}
