/**
 * 清单的 React 数据层（**服务端驱动**，2026-09-30 架构调整）。
 *
 * Master 决定：**视觉小说清单数据不落本地库**，每次从 vndb.org 现拉现读：
 *   - 列表：`useInfiniteQuery` 直查 `/ulist`（标签筛选下推给 Kana；
 *     排序固定「加入时间新 → 旧」—— 排序 UI 已按 Master 要求移除）
 *   - 单条：`useUlistItem` 直查 `/ulist`（`filters: id = v…`）
 *   - 写入：直接 PATCH / DELETE / PATCH /rlist，成功后失效相关查询、从服务端重取
 *
 * 代价：离线不可读（有意的取舍，VNDB 是唯一数据源）；内存里仍有 React Query
 * 缓存（`gcTime`），切页/返回不会重复请求。
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  addOrUpdateListItem,
  getListLabels,
  getListItem,
  queryList,
  removeFromList,
  removeRelease,
  setReleaseStatus,
  type UListPatch,
} from "@/lib/api/endpoints/ulist";
import { pred } from "@/lib/api/filters";
import type { UListItem, UListLabel } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

/** 每页条数：清单通常上百条，50 是请求数与首屏速度的折中 */
const PAGE_SIZE = 50;

/* -------------------------------------------------------------------------- */
/* 读                                                                         */
/* -------------------------------------------------------------------------- */

/** 清单列表（无限滚动）。标签筛选是**服务端**行为；排序固定加入时间新 → 旧 */
export function useUlistInfinite(options: { labelId: number | null }) {
  const { labelId } = options;

  return useInfiniteQuery({
    queryKey: queryKeys.ulist.list(labelId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryList({
        filters: labelId != null ? pred("label", "=", labelId) : undefined,
        sort: "added",
        reverse: true,
        results: PAGE_SIZE,
        page: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage, allPages) => (lastPage.more ? allPages.length + 1 : undefined),
    staleTime: STALE_TIME.ulist,
  });
}

/** 清单里的单条（清单编辑页 / VN 详情入口用）。VNDB 上没有 → data = null */
export function useUlistItem(vnId: string, enabled = true): UseQueryResult<UListItem | null> {
  return useQuery({
    queryKey: queryKeys.ulist.item(vnId),
    queryFn: async ({ signal }) => {
      const remote = await getListItem(vnId, undefined, signal);
      return remote.results[0] ?? null;
    },
    staleTime: STALE_TIME.ulist,
    enabled: enabled && Boolean(vnId),
  });
}

/** 清单标签（服务端返回什么就显示什么 —— 保持 VNDB 的英文原名） */
export function useUlistLabels(): UseQueryResult<UListLabel[]> {
  return useQuery({
    queryKey: queryKeys.ulist.labels(),
    queryFn: ({ signal }) => getListLabels(undefined, signal),
    staleTime: STALE_TIME.taxonomy,
  });
}

/* -------------------------------------------------------------------------- */
/* 写                                                                         */
/* -------------------------------------------------------------------------- */

/** 清单条目写入（打分 / 标签 / 备注 / 日期；`{}` = 把作品加入清单） */
export function useUlistMutations(vnId: string) {
  const client = useQueryClient();
  const invalidate = (): void => {
    void client.invalidateQueries({ queryKey: queryKeys.ulist.all });
  };

  const updateEntry = useMutation({
    mutationFn: (patch: UListPatch) => addOrUpdateListItem(vnId, patch),
    onSuccess: invalidate,
  });

  const removeEntry = useMutation({
    mutationFn: () => removeFromList(vnId),
    onSuccess: invalidate,
  });

  return { updateEntry, removeEntry };
}

/** 发行版持有状态（`status: null` = 移除记录） */
export function useUlistReleaseHold() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, status }: { releaseId: string; status: number | null }) =>
      status === null ? removeRelease(releaseId) : setReleaseStatus(releaseId, status),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.ulist.all });
    },
  });
}
