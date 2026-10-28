import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { queryTopVns } from "@/lib/api/endpoints/vn";
import { byTag } from "@/lib/api/filters";
import type { QueryResponse, VnSummary } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import {
  getTagPoolState,
  subscribeTagPool,
  type TagPoolState,
} from "@/features/ranking/lib/tag-pool";

/** 榜单前 N */
export const RANKING_TOP_N = 10;

/** 年度榜：某一年发售的作品按评分排 */
export function useYearRanking(year: number): UseQueryResult<QueryResponse<VnSummary>> {
  return useQuery({
    queryKey: queryKeys.ranking.year(year),
    queryFn: ({ signal }) =>
      queryTopVns(
        [
          ["released", ">=", `${year}-01-01`],
          ["released", "<=", `${year}-12-31`],
        ],
        { results: RANKING_TOP_N, signal }
      ),
    staleTime: STALE_TIME.vn,
  });
}

/**
 * 题材榜：一组标签下的作品按评分排。
 *
 * 多个标签之间是 **AND**（作品得全都命中，见 `compileVnFilters` 的 tag 语义），
 * 所以选的组合越大榜单越小 —— 这正是组合题材（如「奇幻 + 悬疑」）的意思。
 * 空组合不请求（没选标签就无榜可排）。
 */
export function useTagRanking(tagIds: readonly string[]): UseQueryResult<QueryResponse<VnSummary>> {
  return useQuery({
    queryKey: queryKeys.ranking.tag(tagIds),
    enabled: tagIds.length > 0,
    queryFn: ({ signal }) =>
      queryTopVns(
        tagIds.map((id) => byTag(id)),
        { results: RANKING_TOP_N, signal }
      ),
    staleTime: STALE_TIME.vn,
  });
}

/** 题材列表的共享状态（面板增删、屏幕共用同一份） */
export function useTagPool(): TagPoolState {
  return useSyncExternalStore(subscribeTagPool, getTagPoolState);
}
