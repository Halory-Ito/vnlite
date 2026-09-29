/**
 * VN 数据获取的 React hooks。
 *
 * 设计要点：
 *   1. 列表用 `useInfiniteQuery` + `page` 翻页。Kana 的 `page` 参数对
 *      非 `id` 排序不太可靠，所以默认排序用 `id`（最稳）。
 *   2. 详情用 `useQuery`，字段集是全量字段，返回内容很大，
 *      所以 staleTime 拉长到 10 分钟。
 *   3. 搜索走 `searchrank` 排序时必须顶层带 `search` 过滤器，
 *      这一点由 `compileVnFilters` 保证。
 */

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  queryCharactersByVn,
  queryReleasesByVn,
  queryVns,
  getVns,
  getVn,
  type VnQueryOptions,
} from "@/lib/api/endpoints/vn";
import { compileVnFilters, type VnFilterState } from "@/lib/api/filters";
import type {
  Character,
  Release,
  UListLabel,
  UListRelease,
  VnDetail,
  VnSummary,
} from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { SAFE_PAGE_SIZE } from "@/utils/format";

/* -------------------------------------------------------------------------- */
/* 列表                                                                        */
/* -------------------------------------------------------------------------- */

export interface UseVnListOptions {
  filters?: VnFilterState;
  sort?: VnQueryOptions["sort"];
  reverse?: boolean;
  pageSize?: number;
  enabled?: boolean;
}

export function useVnList({
  filters,
  sort = "id",
  reverse = false,
  pageSize = SAFE_PAGE_SIZE,
  enabled = true,
}: UseVnListOptions = {}) {
  const compiled = compileVnFilters(filters);

  return useInfiniteQuery({
    queryKey: queryKeys.vn.list(filters ?? null, sort, 1),
    enabled,
    // 搜索时用 searchrank，其余用 id（page 翻页对 id 排序最可靠）
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryVns({
        filters: compiled,
        sort,
        reverse,
        results: pageSize,
        page: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.more) return undefined;
      // 同一筛选条件下翻页递增；若改了筛选条件，key 变了会自动重置
      return allPages.length + 1;
    },
    staleTime: STALE_TIME.vn,
  });
}

/** 扁平化分页数据，交给 FlashList */
export function flattenPages<T>(pages: { results: T[] }[] | undefined): T[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.results);
}

/* -------------------------------------------------------------------------- */
/* 详情                                                                        */
/* -------------------------------------------------------------------------- */

export function useVnDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.vn.detail(id),
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) => getVn(id, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results[0] as VnDetail | undefined,
  });
}

export function useVnReleases(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.vn.releases(id),
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) => queryReleasesByVn(id, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results as Release[],
  });
}

export function useVnCharacters(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.vn.characters(id),
    enabled: enabled && Boolean(id),
    queryFn: ({ signal }) => queryCharactersByVn(id, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results as Character[],
  });
}

/* -------------------------------------------------------------------------- */
/* 批量                                                                        */
/* -------------------------------------------------------------------------- */

export function useVnsByIds(ids: readonly string[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.vn.byIds(ids),
    enabled: enabled && ids.length > 0,
    queryFn: ({ signal }) => getVns(ids, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results as VnSummary[],
  });
}

/** 数据变了之后手动失效（比如 M3 清单写入后） */
export function useInvalidateVn() {
  const client = useQueryClient();
  return {
    invalidateDetail: (id: string) =>
      client.invalidateQueries({ queryKey: queryKeys.vn.detail(id) }),
    invalidateList: () => client.invalidateQueries({ queryKey: queryKeys.vn.all }),
  };
}

/* -------------------------------------------------------------------------- */
/* 本地辅助类型                                                                */
/* -------------------------------------------------------------------------- */

export type { UListLabel, UListRelease };
