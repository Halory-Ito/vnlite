/**
 * 搜索页的数据 hooks：按范围分四路。
 *
 *   作品   —— 复用 `features/vn/hooks#useVnList`（`search` 过滤器 + `searchrank` 排序）
 *   人员   —— `/staff`，额外加 `ismain = 1` 去重（多姓名 staff 会重复出现）
 *   制作者 —— `/producer`
 *   用户   —— `GET /user`，**只能精确匹配**，最多一条，不翻页（见 search-logic）
 *
 * 三个列表档都用 `useInfiniteQuery` + `page` 翻页，页大小取 `SAFE_PAGE_SIZE`（25）。
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryProducers, queryStaff } from "@/lib/api/endpoints/catalog";
import { findUser } from "@/lib/api/endpoints/ulist";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { SAFE_PAGE_SIZE } from "@/utils/format";

/** 翻页：还有下一页就 +1。筛选条件变了 queryKey 变，整条链自然重置 */
function nextPage(last: { more: boolean }, all: unknown[]): number | undefined {
  return last.more ? all.length + 1 : undefined;
}

/** 制作人员（`searchrank` 排序；同一人的多行由 `toStaffEntries` 按 id 去重） */
export function useStaffSearch(keyword: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.staff.list(keyword),
    enabled: enabled && keyword.length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryStaff({
        search: keyword,
        results: SAFE_PAGE_SIZE,
        page: pageParam,
        signal,
      }),
    getNextPageParam: nextPage,
    staleTime: STALE_TIME.catalog,
  });
}

/** 制作者 */
export function useProducerSearch(keyword: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.producer.list(keyword),
    enabled: enabled && keyword.length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryProducers({
        search: keyword,
        sort: "searchrank",
        results: SAFE_PAGE_SIZE,
        page: pageParam,
        signal,
      }),
    getNextPageParam: nextPage,
    staleTime: STALE_TIME.catalog,
  });
}

/**
 * 按完整用户名 / 用户 ID 查一个人。
 *
 * ⚠️ Kana 没有用户模糊搜索（`findUser` 的注释），所以这里没有分页：
 * 最多一条结果，搜不到就是 null。
 */
export function useUserLookup(keyword: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.user.search(keyword),
    enabled: enabled && keyword.length > 0,
    queryFn: ({ signal }) => findUser(keyword, signal),
    staleTime: STALE_TIME.catalog,
  });
}
