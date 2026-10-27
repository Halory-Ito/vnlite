/**
 * 清单的 React 数据层（**服务端驱动**，2026-09-30 架构调整）。
 *
 * Master 决定：**视觉小说清单数据不落本地库**，每次从 vndb.org 现拉现读：
 *   - 列表：`useInfiniteQuery` 直查 `/ulist`，排序固定「加入时间新 → 旧」
 *     （排序 UI 已按 Master 要求移除）
 *   - 单条：`useUlistItem` 直查 `/ulist`（`filters: id = v…`）
 *   - 写入：直接 PATCH / DELETE / PATCH /rlist，成功后失效相关查询、从服务端重取
 *
 * ## 标签筛选改在**本地**做（Master 要求）
 *
 * 原来是把 `label` 过滤器下推给 Kana：每切一个标签就换一个 queryKey → 重新请求
 * + 回到全屏 loading。可清单本来就整份拉回来了（分页），切标签只是**换个过滤
 * 条件**，没必要重新请求 —— 现在只查**不带 label 过滤**的清单，筛选走
 * `filterByLabel()`：切换零请求、零 loading。
 *
 * 代价与对策：本地只能筛「**已经加载**的条目」（一页 50 条）。所以筛选态下
 * 列表底部会说明「已加载的 N 条里筛出 M 条（该标签共 X 条）」并给一个「加载更多」
 * —— 补的是**未过滤**清单的下一页（`fetchNextPage`），筛出的结果随之变多。
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
import type { UListItem, UListLabel } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

/** 每页条数：清单通常上百条，50 是请求数与首屏速度的折中 */
const PAGE_SIZE = 50;

/* -------------------------------------------------------------------------- */
/* 读                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 清单列表（无限滚动，**不带标签过滤**）。
 *
 * 标签筛选是纯客户端行为（见文件头），所以这个查询的 key 固定 —— 切标签不会换 key，
 * 也就不会重新请求、更不会回到 loading。
 */
export function useUlistInfinite() {
  return useInfiniteQuery({
    queryKey: queryKeys.ulist.list(),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryList({
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
