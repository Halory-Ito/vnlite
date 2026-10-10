/**
 * 收藏的数据层（React Query 托管）。
 *
 * 数据存在本地 SQLite（`lib/db/dao/favorite`），读写都走 React Query，
 * 与浏览历史同一套：
 *   - 列表分页用 `useInfiniteQuery`（每页 `FAVORITE_PAGE_SIZE`），滚到底自动加载
 *   - 收藏 / 取消 / 清空成功后失效 `favorite.all`，列表与详情页按钮自动刷新
 *
 * `useToggleFavorite` 在详情页用：读「是否已收藏」+ 切开关，一处把逻辑收齐。
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  addFavorite,
  clearFavorites,
  getFavoritesPage,
  isFavorite,
  removeFavorite,
  type FavoriteType,
} from "@/lib/db/dao/favorite";
import { queryKeys } from "@/lib/query/keys";

import { FAVORITE_TAB_TYPES, type FavoriteTab } from "./favorite-constants";

/** 每页条数 */
export const FAVORITE_PAGE_SIZE = 20;

/** 收藏元数据（收藏列表要展示的信息） */
export interface FavoriteMeta {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
}

/** 写入后的统一失效 */
function useInvalidateFavorite(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.favorite.all });
  }, [client]);
}

/**
 * 某档位的分页列表（收藏时间倒序，滚到底加载下一页）。
 */
export function useFavoritesInfinite(tab: FavoriteTab) {
  const types = FAVORITE_TAB_TYPES[tab];
  return useInfiniteQuery({
    queryKey: queryKeys.favorite.list(tab),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getFavoritesPage(types, pageParam, FAVORITE_PAGE_SIZE),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= FAVORITE_PAGE_SIZE ? allPages.length * FAVORITE_PAGE_SIZE : undefined,
    // 本地库读取即时完成，不必缓存
    staleTime: 0,
  });
}

export interface ToggleFavoriteResult {
  /** 是否已收藏 */
  isFavorite: boolean;
  /** 切换收藏状态；可传 React Query 的 `onSuccess` / `onError` 回调做反馈 */
  toggle: (options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => void;
  /** 切换进行中 */
  isPending: boolean;
  /** 初始读取中 */
  isLoading: boolean;
}

/**
 * 详情页的收藏开关：读状态 + 切换。
 *
 * `meta` 在收藏时写入本地库（标题 / 副标题 / 图），`entryId` 为空时开关失效。
 */
export function useToggleFavorite(
  type: FavoriteType,
  entryId: string,
  meta: FavoriteMeta
): ToggleFavoriteResult {
  const invalidate = useInvalidateFavorite();

  const stateQuery = useQuery({
    queryKey: queryKeys.favorite.state(type, entryId),
    enabled: Boolean(entryId),
    queryFn: () => isFavorite(type, entryId),
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        await addFavorite(type, entryId, meta.title, meta.subtitle, meta.imageUrl);
      } else {
        await removeFavorite(type, entryId);
      }
      return next;
    },
    onSuccess: invalidate,
  });

  const current = stateQuery.data ?? false;
  return {
    isFavorite: current,
    toggle: (options) => mutation.mutate(!current, options),
    isPending: mutation.isPending,
    isLoading: Boolean(entryId) && stateQuery.isLoading,
  };
}

/** 清空若干档位的收藏 */
export function useClearFavorites() {
  const invalidate = useInvalidateFavorite();
  return useMutation({
    mutationFn: (tabs: FavoriteTab[]) =>
      clearFavorites(tabs.flatMap((tab) => FAVORITE_TAB_TYPES[tab])),
    onSuccess: invalidate,
  });
}

/** 取消收藏单条 */
export function useRemoveFavorite() {
  const invalidate = useInvalidateFavorite();
  return useMutation({
    mutationFn: ({ type, entryId }: { type: FavoriteType; entryId: string }) =>
      removeFavorite(type, entryId),
    onSuccess: invalidate,
  });
}
