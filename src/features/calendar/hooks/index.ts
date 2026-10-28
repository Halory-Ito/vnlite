/**
 * 发售日历的数据层。
 *
 * 一个月最多几百部作品，分页拉完（每页 100），拉完再按天分组。
 * 缓存 key 带月份：翻回看过的月份直接命中缓存。
 */

import { useInfiniteQuery, type UseInfiniteQueryResult } from "@tanstack/react-query";

import { queryVnsByReleaseRange } from "@/lib/api/endpoints/vn";
import type { VnSummary } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { monthKey, monthRange, type MonthRef } from "@/features/calendar/lib/calendar";

/** 最多翻 5 页（500 部），再多的月份也不至于漏掉重点 */
const MAX_PAGES = 5;

export function useMonthReleases(
  ref: MonthRef,
  options: { enabled?: boolean } = {}
): UseInfiniteQueryResult<{ pages: { results: VnSummary[] }[] }> {
  const range = monthRange(ref);

  return useInfiniteQuery({
    queryKey: queryKeys.calendar.month(monthKey(ref)),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryVnsByReleaseRange(range.from, range.to, { page: pageParam, signal }),
    getNextPageParam: (last, all) =>
      last.more && all.length < MAX_PAGES ? all.length + 1 : undefined,
    staleTime: STALE_TIME.vn,
    /** 翻页器只给自己和左右各一个月的页子预取，别的月份等滑到附近再拉 */
    enabled: options.enabled ?? true,
  });
}
