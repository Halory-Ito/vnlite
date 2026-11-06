/**
 * QueryClient 配置。
 *
 * 缓存策略与 C1 决策一致：**只缓存用户数据到磁盘**，业务数据留在内存。
 * 好处是用户随时可以「清缓存」且不会丢清单；同时离线时仍能看自己的清单。
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import { handleUnauthorized } from "@/lib/storage/session";

/** 业务数据保鲜时长；无人订阅后的内存回收时间由 gcTime 单独控制。 */
export const STALE_TIME = {
  /** VN 列表 / 详情：30 分钟 */
  vn: 30 * 60 * 1000,
  /** 角色 / 制作者 / staff：1 小时 */
  catalog: 60 * 60 * 1000,
  /** 标签 / 特性：6 小时 */
  taxonomy: 6 * 60 * 60 * 1000,
  /** 语录：6 小时 */
  quote: 6 * 60 * 60 * 1000,
  /** 攻略：6 小时（静态 JSON，更新以月计；比它自己的 24h 落盘 TTL 更短，保证回前台能拿到新的） */
  walkthrough: 6 * 60 * 60 * 1000,
  /** 用户清单：2 分钟；应用内写入成功后主动失效刷新 */
  ulist: 2 * 60 * 1000,
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
      // 查询无人订阅满 1 小时后回收，与应用是否在前台无关
      gcTime: 60 * 60 * 1000,
    },
    mutations: {
      // 写操作绝不自动重试：PATCH 不是幂等的，重复提交会出问题
      retry: false,
    },
  },
});

export type CacheCategory =
  | "vn"
  | "character"
  | "producer"
  | "staff"
  | "screenshots"
  | "taxonomy"
  | "community"
  | "ranking"
  | "other";

const CATEGORY_KEYS: Record<CacheCategory, readonly string[]> = {
  vn: ["vn"],
  character: ["character"],
  producer: ["producer"],
  staff: ["staff"],
  taxonomy: ["tag", "trait"],
  community: ["user", "discussion", "review"],
  ranking: ["ranking", "similar", "home", "database"],
  other: ["quote", "catalog"],
  screenshots: [],
};

export function getQueryCacheStats(): Record<CacheCategory, { count: number; bytes: number }> {
  const result = Object.fromEntries(
    Object.keys(CATEGORY_KEYS).map((key) => [key, { count: 0, bytes: 0 }])
  ) as Record<CacheCategory, { count: number; bytes: number }>;
  for (const query of queryClient.getQueryCache().getAll()) {
    const category = (Object.keys(CATEGORY_KEYS) as CacheCategory[]).find((key) =>
      CATEGORY_KEYS[key].includes(String(query.queryKey[0]))
    );
    if (!category) continue;
    result[category].count += 1;
    try {
      result[category].bytes += new TextEncoder().encode(JSON.stringify(query.state.data)).length;
    } catch {
      /* non-serializable query data contributes no estimate */
    }
  }
  return result;
}

export async function clearQueryCacheCategory(category: CacheCategory): Promise<void> {
  const keys = CATEGORY_KEYS[category];
  queryClient.removeQueries({ predicate: (query) => keys.includes(String(query.queryKey[0])) });
}

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
