/**
 * queryKeys 工厂。
 *
 * 集中管理是为了让失效（invalidate）不会漏写。约定：
 *   第 0 段是资源名，第 1 段起是具体标识
 *   `list` / `detail` 分开，便于分别设 staleTime 与精确失效
 */

import type { VnFilterState } from "@/lib/api/filters";

/** 把筛选状态序列化成稳定的 key（对象顺序会影响 key，这里手动排序） */
function normalizeFilters(state: VnFilterState | undefined): string {
  if (!state) return "none";
  return Object.keys(state)
    .sort()
    .map((k) => `${k}=${JSON.stringify((state as Record<string, unknown>)[k])}`)
    .join("&");
}

export const queryKeys = {
  /* ---- VN ---- */
  vn: {
    all: ["vn"] as const,
    list: (filters: VnFilterState | null, sort?: string, page?: number) =>
      ["vn", "list", normalizeFilters(filters ?? undefined), sort ?? "id", page ?? 1] as const,
    detail: (id: string) => ["vn", "detail", id] as const,
    byIds: (ids: readonly string[]) => ["vn", "byIds", [...ids].sort().join(",")] as const,
    releases: (vnId: string) => ["vn", "releases", vnId] as const,
    characters: (vnId: string) => ["vn", "characters", vnId] as const,
    random: (round = 0) => ["vn", "random", round] as const,
  },

  /* ---- 角色 / 制作者 / staff ---- */
  character: {
    all: ["character"] as const,
    list: (search?: string, page?: number) =>
      ["character", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["character", "detail", id] as const,
    vns: (id: string) => ["character", "vns", id] as const,
    byIds: (ids: readonly string[]) => ["character", "byIds", [...ids].sort().join(",")] as const,
  },
  producer: {
    all: ["producer"] as const,
    list: (search?: string, page?: number) =>
      ["producer", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["producer", "detail", id] as const,
  },
  staff: {
    all: ["staff"] as const,
    list: (search?: string, page?: number) => ["staff", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["staff", "detail", id] as const,
  },

  /* ---- 标签 / 特性 ---- */
  tag: {
    all: ["tag"] as const,
    list: (search?: string, page?: number) => ["tag", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["tag", "detail", id] as const,
    vns: (id: string, direct: boolean) =>
      ["tag", "vns", id, direct ? "direct" : "inherit"] as const,
    byIds: (ids: readonly string[]) => ["tag", "byIds", [...ids].sort().join(",")] as const,
  },
  trait: {
    all: ["trait"] as const,
    list: (search?: string, page?: number) => ["trait", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["trait", "detail", id] as const,
  },

  /* ---- 语录 ---- */
  quote: {
    all: ["quote"] as const,
    /** 每日语录（key 里带本地日期，跨天自动换新） */
    ofTheDay: (dateKey: string) => ["quote", "ofTheDay", dateKey] as const,
    byVn: (vnId: string) => ["quote", "byVn", vnId] as const,
  },

  /* ---- 用户清单（服务端驱动，不落本地库） ---- */
  ulist: {
    all: ["ulist"] as const,
    /** 列表页（标签筛选进 key；排序固定加入时间，不进 key） */
    list: (labelId: number | null) => ["ulist", "list", labelId ?? 0] as const,
    labels: () => ["ulist", "labels"] as const,
    item: (vnId: string) => ["ulist", "item", vnId] as const,
    /** 收藏统计（整份清单的聚合，与列表页分开缓存） */
    stats: () => ["ulist", "stats"] as const,
    /** 收藏统计 · 游戏类型分布（带 tags 的那一趟，单独缓存） */
    statsTypes: () => ["ulist", "statsTypes"] as const,
  },

  /* ---- 账号 ---- */
  account: {
    all: ["account"] as const,
    authInfo: () => ["account", "authinfo"] as const,
    user: (id: string) => ["account", "user", id] as const,
    stats: () => ["account", "stats"] as const,
    ratingRank: () => ["account", "ratingRank"] as const,
  },
} as const;
