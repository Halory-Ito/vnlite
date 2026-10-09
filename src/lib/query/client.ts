/**
 * QueryClient 配置。
 *
 * 缓存策略与 C1 决策一致：**只缓存用户数据到磁盘**，业务数据留在内存。
 * 好处是用户随时可以「清缓存」且不会丢清单；同时离线时仍能看自己的清单。
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import { handleUnauthorized } from "@/lib/storage/session";

/** 业务数据的内存缓存时长。VNDB 条目几乎不变，可以放很久 */
export const STALE_TIME = {
  /** VN 列表 / 详情：10 分钟 */
  vn: 10 * 60 * 1000,
  /** 角色 / 制作者 / staff：30 分钟 */
  catalog: 30 * 60 * 1000,
  /** 标签 / 特性：1 小时 */
  taxonomy: 60 * 60 * 1000,
  /** 语录：1 小时 */
  quote: 60 * 60 * 1000,
  /** 攻略：6 小时（静态 JSON，更新以月计；比它自己的 24h 落盘 TTL 更短，保证回前台能拿到新的） */
  walkthrough: 6 * 60 * 60 * 1000,
  /** 用户清单：30 秒（写操作很频繁） */
  ulist: 30 * 1000,
  /** 账号信息：5 分钟 */
  account: 5 * 60 * 1000,
} as const;

/** 401 统一处理：清 Token 退回游客。只有 401 会走这里（见 session.handleUnauthorized） */
function onUnauthorized(error: unknown): void {
  if (error instanceof ApiError && error.needsAuth) void handleUnauthorized();
}

export const queryClient = new QueryClient({
  // 运行时任意请求出现 401（如用户在使用中于 vndb.org 删除 Token）都即时登出，
  // 不必等到下次冷启动
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: {
    queries: {
      // 业务数据默认不重试，避免白白消耗限流配额
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (
            error.kind === "unauthorized" ||
            error.kind === "bad_request" ||
            error.kind === "not_found"
          )
            return false;
          return error.isRetryable && failureCount < 2;
        }
        return failureCount < 2;
      },
      // 退避策略：1s / 2s / 4s
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // 不在后台刷新时请求，节省限流配额
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // 退到后台 5 分钟后丢弃
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      // 写操作绝不自动重试：PATCH 不是幂等的，重复提交会出问题
      retry: false,
    },
  },
});

/** 设置页「清空业务数据缓存」用。保留 user 相关的键 */
export async function clearContentCache(): Promise<void> {
  const keep = ["ulist", "account"];
  await queryClient.invalidateQueries({
    predicate: (query) => !keep.some((prefix) => query.queryKey[0] === prefix),
  });
  await queryClient.removeQueries({
    predicate: (query) => !keep.some((prefix) => query.queryKey[0] === prefix),
  });
}
