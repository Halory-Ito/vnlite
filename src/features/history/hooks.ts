/**
 * 浏览历史的数据层（React Query 托管）。
 *
 * 数据存在本地 SQLite（`lib/db/dao/history`），但**读写都走 React Query**，
 * 与项目其它数据层保持一致：
 *   - 列表分页用 `useInfiniteQuery`（每页 `HISTORY_PAGE_SIZE`），滚到底自动加载
 *   - 写操作（记录浏览 / 删除 / 清空）成功后失效 `history.all`，列表自动刷新
 *
 * `useRecordHistory` 在详情页调用，记录一次浏览；重复浏览同一条只更新 `viewed_at`。
 */

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  clearHistory,
  deleteHistoryEntry,
  getHistoryPage,
  recordView,
  type HistoryType,
} from "@/lib/db/dao/history";
import { queryKeys } from "@/lib/query/keys";

import {
  dateFilterBounds,
  HISTORY_TAB_TYPES,
  type HistoryDateFilter,
  type HistoryTab,
} from "./history-constants";

/** 每页条数 */
export const HISTORY_PAGE_SIZE = 20;

/** 记录历史后的统一失效 */
function useInvalidateHistory(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.history.all });
  }, [client]);
}

/**
 * 记录一次浏览。返回的函数可在详情页的 `useEffect` 里调用。
 *
 * ```ts
 * const recordView = useRecordHistory();
 * useEffect(() => {
 *   if (vn) recordView("vn", vn.id, vn.title, vn.alttitle, vn.image?.thumbnail);
 * }, [vn, recordView]);
 * ```
 */
export function useRecordHistory() {
  const invalidate = useInvalidateHistory();
  return useCallback(
    (
      type: HistoryType,
      entryId: string,
      title: string,
      subtitle?: string | null,
      imageUrl?: string | null
    ) => {
      void recordView(type, entryId, title, subtitle, imageUrl).then(invalidate);
    },
    [invalidate]
  );
}

/**
 * 某个档位 + 日期筛选的分页列表（浏览时间倒序，滚到底加载下一页）。
 *
 * 时间上下界用 `useMemo` 稳定住：每次渲染现算会让分页的每一页落到不同的边界，
 * 也会让查询参数抖动。
 */
export function useHistoryInfinite(tab: HistoryTab, filter: HistoryDateFilter) {
  const types = HISTORY_TAB_TYPES[tab];
  const { start, end } = filter;
  const { since, until } = useMemo(() => dateFilterBounds({ start, end }), [start, end]);
  return useInfiniteQuery({
    queryKey: queryKeys.history.list(tab, start, end),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getHistoryPage(types, pageParam, HISTORY_PAGE_SIZE, { since, until }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= HISTORY_PAGE_SIZE ? allPages.length * HISTORY_PAGE_SIZE : undefined,
    // 本地库读取即时完成，不必缓存
    staleTime: 0,
  });
}

/** 清空某个档位的历史 */
export function useClearHistory() {
  const invalidate = useInvalidateHistory();
  return useMutation({
    mutationFn: (tab: HistoryTab) => clearHistory(HISTORY_TAB_TYPES[tab]),
    onSuccess: invalidate,
  });
}

/** 删除单条历史 */
export function useRemoveHistoryEntry() {
  const invalidate = useInvalidateHistory();
  return useMutation({
    mutationFn: ({ type, entryId }: { type: HistoryType; entryId: string }) =>
      deleteHistoryEntry(type, entryId),
    onSuccess: invalidate,
  });
}
